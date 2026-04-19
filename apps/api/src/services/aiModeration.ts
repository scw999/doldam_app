import type { Env } from '../types';
import { sha256Hex } from '../utils/hash';

// Claude Haiku로 2차 모더레이션.
// 키워드 필터를 먼저 통과한 텍스트만 AI에 태움 — 비용 절감.
// 결과는 KV에 sha256(text) 키로 1일 캐시.

const MODEL = 'claude-haiku-4-5-20251001';
const CACHE_TTL = 86400;

export interface AiModResult {
  ok: boolean;
  reason?: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

const SYSTEM_PROMPT = `당신은 한국 돌싱 커뮤니티 앱의 개인정보 필터입니다.
다음 텍스트에 개인정보나 외부 연락 유도가 있으면 차단하세요.

차단 대상:
- 실명, 휴대폰 번호, 주민번호, 이메일, 주소
- 카카오톡/텔레그램/인스타/라인 ID 공유 유도
- 특정인 지목/비방
- 직장 실명/상세 위치(구체적 동네명)

허용:
- 직업 카테고리(회사원, 자영업 등)
- 감정, 고민, 경험담
- 일반 지역(서울, 경기 등)

출력 형식: JSON만 반환, {"ok": true} 또는 {"ok": false, "reason": "간단한_이유"}`;

export async function moderateWithAi(env: Env, text: string): Promise<AiModResult> {
  if (text.length < 20) return { ok: true }; // 너무 짧으면 AI 불필요
  if (text.length > 2000) return { ok: false, reason: 'too_long' };

  const cacheKey = `ai-mod:${await sha256Hex(text)}`;
  const cached = await env.DOLDAM_KV.get(cacheKey);
  if (cached) return JSON.parse(cached) as AiModResult;

  let result: AiModResult;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!res.ok) {
      console.error('[ai-mod] http', res.status);
      return { ok: true }; // fail-open: AI 실패 시 차단하지 않음 (키워드 필터는 통과한 상태)
    }

    const body = await res.json<ClaudeResponse>();
    const raw = body.content?.[0]?.text?.trim() ?? '{"ok":true}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    result = jsonMatch ? (JSON.parse(jsonMatch[0]) as AiModResult) : { ok: true };
  } catch (e) {
    console.error('[ai-mod] error', e);
    return { ok: true };
  }

  await env.DOLDAM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
  return result;
}
