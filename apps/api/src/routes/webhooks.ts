import { Hono } from 'hono';
import type { Env } from '../types';

const webhooks = new Hono<{ Bindings: Env }>();

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
  if (!completedAt) return '-';
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}분 ${sec}초`;
}

async function verifyEasSignature(body: string, signature: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret) return true; // 시크릿 미설정 시 검증 스킵
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const hexStr = signature.replace('sha256=', '');
  const sigBytes = new Uint8Array(hexStr.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(body));
}

async function postToSlack(token: string, channel: string, blocks: unknown[], text: string): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
}

webhooks.post('/eas', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('expo-signature') ?? null;

  const valid = await verifyEasSignature(rawBody, signature, c.env.EAS_WEBHOOK_SECRET);
  if (!valid) return c.json({ error: 'invalid_signature' }, 401);

  const payload = JSON.parse(rawBody) as EasBuildPayload;

  if (!['finished', 'errored', 'canceled'].includes(payload.status)) {
    return c.json({ ok: true, skipped: true });
  }
  if (!c.env.SLACK_BOT_TOKEN || !c.env.SLACK_CHANNEL_ID) {
    return c.json({ ok: true, skipped: 'no_slack_config' });
  }

  const statusIcon  = payload.status === 'finished' ? '✅' : payload.status === 'errored' ? '❌' : '⛔';
  const statusLabel = payload.status === 'finished' ? '빌드 성공' : payload.status === 'errored' ? '빌드 실패' : '빌드 취소';
  const platformIcon = payload.platform === 'android' ? '🤖 Android' : '🍎 iOS';
  const downloadUrl = payload.artifacts?.applicationArchiveUrl ?? payload.artifacts?.buildUrl;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${statusIcon} 돌담 앱 ${statusLabel}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*플랫폼*\n${platformIcon}` },
        { type: 'mrkdwn', text: `*프로필*\n${payload.buildProfile}` },
        { type: 'mrkdwn', text: `*버전*\n${payload.appVersion}` },
        { type: 'mrkdwn', text: `*소요 시간*\n${buildDuration(payload.createdAt, payload.completedAt)}` },
      ],
    },
  ];

  const buildUrl = `https://expo.dev/accounts/scw999/projects/doldam/builds/${payload.id}`;
  const contextParts: string[] = [`빌드 ID: <${buildUrl}|\`${payload.id.slice(0, 8)}\`>`];
  if (payload.gitCommitHash) {
    contextParts.push(`커밋: \`${payload.gitCommitHash.slice(0, 8)}\``);
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: contextParts.join('  ·  ') }],
  });

  if (payload.status === 'finished' && downloadUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📦 APK 다운로드', emoji: true },
          url: downloadUrl,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔍 빌드 상세', emoji: true },
          url: buildUrl,
        },
      ],
    });
  }

  if (payload.status === 'errored' && payload.error?.message) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*오류*\n\`\`\`${payload.error.message.slice(0, 300)}\`\`\`` },
    });
  }

  const fallbackText = `${statusIcon} 돌담 앱 ${statusLabel} (${platformIcon} · ${payload.buildProfile})`;
  await postToSlack(c.env.SLACK_BOT_TOKEN, c.env.SLACK_CHANNEL_ID, blocks, fallbackText);

  return c.json({ ok: true });
});

export default webhooks;
