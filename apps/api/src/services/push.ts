import type { Env } from '../types';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export type NotifKind = 'comment' | 'reply' | 'hot_vote' | 'chat';

export async function sendPush(
  env: Env,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  kind?: NotifKind
): Promise<void> {
  // 알림 히스토리는 푸시 토큰 유무와 관계없이 항상 저장
  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO notifications (id, user_id, title, body, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, title, body, data ? JSON.stringify(data) : null, Date.now())
    .run();

  // 알림 종류별 사용자 설정 체크
  if (kind) {
    const pref = await env.DOLDAM_DB
      .prepare(`SELECT ${kind} AS enabled FROM notification_preferences WHERE user_id = ?`)
      .bind(userId)
      .first<{ enabled: number }>();
    // 설정 행이 없으면 기본값 ON, 있으면 0이면 스킵
    if (pref && pref.enabled === 0) return;
  }

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
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.error('[push] expo HTTP error', res.status, await res.text().catch(() => ''));
      return;
    }
    type PushResult = { status: 'ok' } | { status: 'error'; details?: { error?: string } };
    const json = await res.json<{ data: PushResult[] }>();
    const toDelete: string[] = [];
    (json.data ?? []).forEach((r, i) => {
      if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') {
        toDelete.push(results[i].token);
      }
    });
    if (toDelete.length > 0) {
      for (const t of toDelete) {
        await env.DOLDAM_DB.prepare('DELETE FROM push_tokens WHERE token = ?').bind(t).run().catch(() => {});
      }
      console.warn('[push] removed', toDelete.length, 'invalid tokens');
    }
  } catch (e) {
    console.error('[push] expo error', e);
  }
}
