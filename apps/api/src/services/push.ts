import type { Env } from '../types';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Expo Push API — 토큰 모으고 배치 전송
// https://docs.expo.dev/push-notifications/sending-notifications/
export async function sendPush(
  env: Env,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { results } = await env.DOLDAM_DB
    .prepare('SELECT token FROM push_tokens WHERE user_id = ?')
    .bind(userId)
    .all<{ token: string }>();
  if (results.length === 0) return;

  const messages: ExpoMessage[] = results.map((r) => ({
    to: r.token,
    title,
    body,
    data,
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error('[push] expo error', e);
  }

  // 히스토리 저장
  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO notifications (id, user_id, title, body, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, title, body, data ? JSON.stringify(data) : null, Date.now())
    .run();
}
