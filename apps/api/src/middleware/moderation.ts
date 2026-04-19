import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';
import { moderateWithAi } from '../services/aiModeration';

const BANNED_PATTERNS = [
  /\d{2,3}-\d{3,4}-\d{4}/,                // 전화번호
  /01[016-9]\d{7,8}/,                      // 휴대폰(하이픈 없는)
  /\d{6}-\d{7}/,                           // 주민번호
  /[\w.+-]+@[\w-]+\.[\w.-]+/,              // 이메일
  /카카오톡|카톡\s*id|텔레그램|인스타|라인\s*id/i, // 외부 플랫폼 ID 유도
];

export async function runKeywordFilter(text: string): Promise<{ ok: boolean; reason?: string }> {
  for (const re of BANNED_PATTERNS) {
    if (re.test(text)) return { ok: false, reason: `blocked:${re}` };
  }
  return { ok: true };
}

export const moderate: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const raw = await c.req.text();
  const body = raw ? JSON.parse(raw) : {};
  const text = [body.title, body.content, body.text, body.answer, body.note, body.intro, body.question, body.description]
    .filter(Boolean).join('\n');

  if (text) {
    const kw = await runKeywordFilter(text);
    if (!kw.ok) return c.json({ error: 'moderation_failed', reason: kw.reason }, 400);

    // ENV가 development거나 API 키가 없으면 AI 체크 스킵
    if (c.env.ENV === 'production' && c.env.CLAUDE_API_KEY) {
      const ai = await moderateWithAi(c.env, text);
      if (!ai.ok) return c.json({ error: 'moderation_failed', reason: ai.reason ?? 'ai_blocked' }, 400);
    }
  }

  // body를 다시 파싱할 수 있도록 request 재생성
  c.req.raw = new Request(c.req.raw, { body: raw || null });
  await next();
};
