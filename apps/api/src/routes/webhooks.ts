import { Hono } from 'hono';
import type { Env } from '../types';

const webhooks = new Hono<{ Bindings: Env }>();

// EAS Build 웹훅 페이로드 타입 (주요 필드만)
interface EasBuildPayload {
  id: string;
  status: 'finished' | 'errored' | 'canceled' | 'new' | 'in-queue' | 'in-progress';
  platform: 'android' | 'ios';
  buildProfile: string;
  appVersion: string;
  gitCommitHash?: string;
  artifacts?: {
    buildUrl?: string;
    applicationArchiveUrl?: string;
  };
  error?: { errorCode?: string; message?: string };
  createdAt: string;
  completedAt?: string;
}

function buildDuration(createdAt: string, completedAt?: string): string {
  if (!completedAt) return '';
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}분 ${sec}초`;
}

// EAS HMAC-SHA256 서명 검증
async function verifyEasSignature(
  body: string,
  signature: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret || !signature) return !secret; // secret 없으면 검증 스킵
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = new Uint8Array(
    signature.replace('sha256=', '').match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(body));
}

webhooks.post('/eas', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('expo-signature') ?? null;

  const valid = await verifyEasSignature(rawBody, signature, c.env.EAS_WEBHOOK_SECRET);
  if (!valid) return c.json({ error: 'invalid_signature' }, 401);

  const payload = JSON.parse(rawBody) as EasBuildPayload;

  // 완료/실패/취소 상태만 알림 (진행 중 이벤트는 무시)
  if (!['finished', 'errored', 'canceled'].includes(payload.status)) {
    return c.json({ ok: true, skipped: true });
  }

  if (!c.env.SLACK_WEBHOOK_URL) return c.json({ ok: true, skipped: true });

  const statusIcon =
    payload.status === 'finished' ? '✅' :
    payload.status === 'errored'  ? '❌' : '⛔';

  const statusLabel =
    payload.status === 'finished' ? '빌드 성공' :
    payload.status === 'errored'  ? '빌드 실패' : '빌드 취소';

  const platformIcon = payload.platform === 'android' ? '🤖' : '🍎';
  const duration = buildDuration(payload.createdAt, payload.completedAt);

  const downloadUrl =
    payload.artifacts?.applicationArchiveUrl ??
    payload.artifacts?.buildUrl;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusIcon} 돌담 앱 ${statusLabel}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*플랫폼*\n${platformIcon} ${payload.platform}` },
        { type: 'mrkdwn', text: `*프로필*\n${payload.buildProfile}` },
        { type: 'mrkdwn', text: `*버전*\n${payload.appVersion}` },
        { type: 'mrkdwn', text: `*소요 시간*\n${duration || '-'}` },
      ],
    },
  ];

  if (payload.gitCommitHash) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*커밋*\n\`${payload.gitCommitHash.slice(0, 8)}\`` },
    });
  }

  if (payload.status === 'finished' && downloadUrl) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*다운로드*\n<${downloadUrl}|📦 APK/IPA 다운로드>` },
    });
    blocks.push({ type: 'actions', elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '📦 다운로드', emoji: true },
        url: downloadUrl,
        style: 'primary',
      },
    ]});
  }

  if (payload.status === 'errored' && payload.error?.message) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*오류*\n\`\`\`${payload.error.message.slice(0, 300)}\`\`\`` },
    });
  }

  blocks.push({ type: 'divider' });

  await fetch(c.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  return c.json({ ok: true });
});

export default webhooks;
