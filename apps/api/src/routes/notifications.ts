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

// ---- 읽음 처리 ----
notifications.post('/:id/read', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DOLDAM_DB
    .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?')
    .bind(Date.now(), id, user.id).run();
  return c.json({ ok: true });
});

export default notifications;
