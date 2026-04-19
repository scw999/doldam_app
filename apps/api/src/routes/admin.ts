import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

type Vars = { user: AuthedUser };
const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

admin.get('/reports', requireAuth, async (c) => {
  const { status = 'pending', limit = '50', offset = '0' } = c.req.query();
  const rows = await c.env.DOLDAM_DB
    .prepare(
      `SELECT r.*, u.nickname as reporter_nickname
       FROM reports r
       LEFT JOIN users u ON u.id = r.reporter_id
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(status, Number(limit), Number(offset))
    .all();
  return c.json(rows.results);
});

admin.patch('/reports/:id', requireAuth, async (c) => {
  const { id } = c.req.param();
  const { status } = await c.req.json<{ status: 'resolved' | 'dismissed' }>();
  if (!['resolved', 'dismissed'].includes(status)) {
    return c.json({ error: 'invalid_status' }, 400);
  }
  await c.env.DOLDAM_DB
    .prepare(`UPDATE reports SET status = ?, resolved_at = ? WHERE id = ?`)
    .bind(status, Date.now(), id)
    .run();
  return c.json({ ok: true });
});

export default admin;
