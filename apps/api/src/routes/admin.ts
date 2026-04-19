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

// ---- 증명서 수동 검증 ----
admin.get('/certificates', requireAuth, async (c) => {
  const list = await c.env.DOLDAM_KV.list({ prefix: 'cert:' });
  const results = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await c.env.DOLDAM_KV.get(k.name);
      if (!raw) return null;
      const data = JSON.parse(raw) as { status: string; uploadedAt: number; r2Key: string };
      return { phoneHash: k.name.replace('cert:', ''), ...data };
    })
  );
  const statusFilter = c.req.query('status') ?? 'pending';
  return c.json(results.filter((r) => r && r.status === statusFilter));
});

admin.post('/certificates/:phoneHash/approve', requireAuth, async (c) => {
  const { phoneHash } = c.req.param();
  const raw = await c.env.DOLDAM_KV.get(`cert:${phoneHash}`);
  if (!raw) return c.json({ error: 'not_found' }, 404);
  const data = JSON.parse(raw);
  await c.env.DOLDAM_KV.put(
    `cert:${phoneHash}`,
    JSON.stringify({ ...data, status: 'verified', verifiedAt: Date.now() }),
    { expirationTtl: 604800 }
  );
  return c.json({ ok: true });
});

admin.post('/certificates/:phoneHash/reject', requireAuth, async (c) => {
  const { phoneHash } = c.req.param();
  const { reason = '검증 실패' } = await c.req.json<{ reason?: string }>().catch(() => ({}));
  const raw = await c.env.DOLDAM_KV.get(`cert:${phoneHash}`);
  if (!raw) return c.json({ error: 'not_found' }, 404);
  const data = JSON.parse(raw);
  await c.env.DOLDAM_KV.put(
    `cert:${phoneHash}`,
    JSON.stringify({ ...data, status: 'rejected', reason, rejectedAt: Date.now() }),
    { expirationTtl: 86400 }
  );
  return c.json({ ok: true });
});

export default admin;
