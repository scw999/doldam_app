import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

const points = new Hono<{ Bindings: Env; Variables: { user: AuthedUser } }>();

points.get('/balance', requireAuth, async (c) => {
  const user = c.get('user');
  const now = Date.now();

  // 전체 잔액 + 유상/무상 분리 잔액 (만료 안 된 적립 lot 의 remaining 합)
  const row = await c.env.DOLDAM_DB
    .prepare(
      `SELECT
         COALESCE(SUM(remaining), 0) AS balance,
         COALESCE(SUM(CASE WHEN kind = 'paid' THEN remaining ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN kind = 'free' THEN remaining ELSE 0 END), 0) AS free
       FROM points_ledger
       WHERE user_id = ? AND amount > 0 AND remaining > 0 AND expires_at > ?`
    )
    .bind(user.id, now)
    .first<{ balance: number; paid: number; free: number }>();

  return c.json({
    balance: row?.balance ?? 0,
    paid: row?.paid ?? 0,
    free: row?.free ?? 0,
  });
});

points.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT amount, reason, created_at, expires_at, kind FROM points_ledger
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    )
    .bind(user.id)
    .all();
  return c.json({ items: results });
});

export default points;
