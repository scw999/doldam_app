import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

type Vars = { user: AuthedUser };
const notifications = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 푸시 토큰 등록 ----
notifications.post('/token', requireAuth, async (c) => {
  const user = c.get('user');
  const { token, platform } = await c.req.json<{ token: string; platform: 'ios' | 'android' }>();
  if (!token) return c.json({ error: 'token_required' }, 400);

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT OR REPLACE INTO push_tokens (user_id, token, platform, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(user.id, token, platform, Date.now())
    .run();

  return c.json({ ok: true });
});

// ---- 자기 자신에게 테스트 푸시 (디버그용) ----
notifications.post('/test-self', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare('SELECT token FROM push_tokens WHERE user_id = ?')
    .bind(user.id).all<{ token: string }>();
  if (results.length === 0) return c.json({ error: 'no_tokens_registered' }, 400);

  // sendPush 경유하면 notifications 테이블에도 기록됨 — 깔끔한 end-to-end 테스트
  const { sendPush } = await import('../services/push');
  await sendPush(c.env, user.id, '🔔 테스트 푸시', '정상적으로 푸시 알림이 도착했어요');
  return c.json({ ok: true, tokenCount: results.length });
});

// ---- 토큰 삭제 ----
notifications.delete('/token', requireAuth, async (c) => {
  const user = c.get('user');
  const { token } = await c.req.json<{ token: string }>();
  await c.env.DOLDAM_DB
    .prepare('DELETE FROM push_tokens WHERE user_id = ? AND token = ?')
    .bind(user.id, token).run();
  return c.json({ ok: true });
});

// ---- 알림 목록 ----
notifications.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT id, title, body, data, read_at, created_at FROM notifications
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .bind(user.id).all();
  return c.json({ items: results });
});

// ---- 안읽은 수 ----
notifications.get('/unread', requireAuth, async (c) => {
  const user = c.get('user');
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .bind(user.id).first<{ n: number }>();
  return c.json({ count: row?.n ?? 0 });
});

// ---- 전체 읽음 처리 ----
notifications.post('/read-all', requireAuth, async (c) => {
  const user = c.get('user');
  await c.env.DOLDAM_DB
    .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .bind(Date.now(), user.id).run();
  return c.json({ ok: true });
});

// ---- 읽음 처리 ----
notifications.post('/:id/read', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DOLDAM_DB
    .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?')
    .bind(Date.now(), id, user.id).run();
  return c.json({ ok: true });
});

// ---- 알림 설정 조회 ----
notifications.get('/preferences', requireAuth, async (c) => {
  const user = c.get('user');
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT comment, reply, hot_vote, chat FROM notification_preferences WHERE user_id = ?')
    .bind(user.id).first<{ comment: number; reply: number; hot_vote: number; chat: number }>();
  return c.json({
    comment:  row ? row.comment  !== 0 : true,
    reply:    row ? row.reply    !== 0 : true,
    hot_vote: row ? row.hot_vote !== 0 : true,
    chat:     row ? row.chat     !== 0 : true,
  });
});

// ---- 알림 설정 업데이트 ----
notifications.patch('/preferences', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    comment?: boolean; reply?: boolean; hot_vote?: boolean; chat?: boolean;
  }>();
  const now = Date.now();
  // 없으면 기본값 ON(1)으로 행 생성
  await c.env.DOLDAM_DB
    .prepare(`INSERT OR IGNORE INTO notification_preferences (user_id, comment, reply, hot_vote, chat, updated_at)
              VALUES (?, 1, 1, 1, 1, ?)`)
    .bind(user.id, now).run();
  // 전달된 필드만 업데이트
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [now];
  if (body.comment  !== undefined) { sets.push('comment = ?');  vals.push(body.comment  ? 1 : 0); }
  if (body.reply    !== undefined) { sets.push('reply = ?');    vals.push(body.reply    ? 1 : 0); }
  if (body.hot_vote !== undefined) { sets.push('hot_vote = ?'); vals.push(body.hot_vote ? 1 : 0); }
  if (body.chat     !== undefined) { sets.push('chat = ?');     vals.push(body.chat     ? 1 : 0); }
  vals.push(user.id);
  await c.env.DOLDAM_DB
    .prepare(`UPDATE notification_preferences SET ${sets.join(', ')} WHERE user_id = ?`)
    .bind(...vals).run();
  return c.json({ ok: true });
});

// ---- 채팅방 알림 음소거 ----
notifications.post('/rooms/:roomId/mute', requireAuth, async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  await c.env.DOLDAM_DB
    .prepare('INSERT OR IGNORE INTO room_notification_mutes (user_id, room_id) VALUES (?, ?)')
    .bind(user.id, roomId).run();
  return c.json({ ok: true });
});

notifications.delete('/rooms/:roomId/mute', requireAuth, async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  await c.env.DOLDAM_DB
    .prepare('DELETE FROM room_notification_mutes WHERE user_id = ? AND room_id = ?')
    .bind(user.id, roomId).run();
  return c.json({ ok: true });
});

// ---- 채팅방 알림 음소거 상태 조회 ----
notifications.get('/rooms/:roomId/mute', requireAuth, async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM room_notification_mutes WHERE user_id = ? AND room_id = ?')
    .bind(user.id, roomId).first();
  return c.json({ muted: !!row });
});

export default notifications;
