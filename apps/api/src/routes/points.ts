import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

const points = new Hono<{ Bindings: Env; Variables: { user: AuthedUser } }>();

points.get('/balance', requireAuth, async (c) => {
  const user = c.get('user');
  const now = Date.now();

  const row = await c.env.DOLDAM_DB
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS balance FROM points_ledger
       WHERE user_id = ? AND expires_at > ?`
    )
    .bind(user.id, now)
    .first<{ balance: number }>();

  return c.json({ balance: row?.balance ?? 0 });
});

points.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT amount, reason, created_at, expires_at FROM points_ledger
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    )
    .bind(user.id)
    .all();
  return c.json({ items: results });
});

export default points;
