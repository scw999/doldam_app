import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { getBalance } from '../services/points';

const points = new Hono<{ Bindings: Env; Variables: { user: AuthedUser } }>();

points.get('/balance', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ balance: await getBalance(c.env, user.id) });
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
