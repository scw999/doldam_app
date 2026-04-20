import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAdmin } from '../middleware/auth';
import { pollEasBuilds } from '../services/easPoller';

type Vars = { user: AuthedUser };
const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 통계 ----
admin.get('/stats', requireAdmin, async (c) => {
  const [users, posts, pendingReports] = await Promise.all([
    c.env.DOLDAM_DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) AS verified,
              SUM(CASE WHEN banned=1 THEN 1 ELSE 0 END) AS banned,
              SUM(CASE WHEN muted_until > ? THEN 1 ELSE 0 END) AS muted
       FROM users WHERE deleted_at IS NULL`
    ).bind(Date.now()).first<{ total: number; verified: number; banned: number; muted: number }>(),
    c.env.DOLDAM_DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS active
       FROM posts`
    ).first<{ total: number; active: number }>(),
    c.env.DOLDAM_DB.prepare(
      `SELECT COUNT(*) AS pending FROM reports WHERE status='pending'`
    ).first<{ pending: number }>(),
  ]);
  return c.json({ users, posts, pendingReports: pendingReports?.pending ?? 0 });
});

// ---- 신고 목록 (target 내용 포함) ----
admin.get('/reports', requireAdmin, async (c) => {
  const { status = 'pending', limit = '50', offset = '0' } = c.req.query();
  const rows = await c.env.DOLDAM_DB
    .prepare(
      `SELECT r.*,
              u.nickname  AS reporter_nickname,
              COALESCE(p.user_id, cm.user_id) AS target_user_id,
              tu.nickname AS target_user_nickname,
              p.title     AS post_title,
              COALESCE(p.content, cm.content) AS target_content
       FROM reports r
       LEFT JOIN users u  ON u.id = r.reporter_id
       LEFT JOIN posts p  ON p.id = r.target_id AND r.target_type = 'post'
       LEFT JOIN comments cm ON cm.id = r.target_id AND r.target_type = 'comment'
       LEFT JOIN users tu ON tu.id = COALESCE(p.user_id, cm.user_id)
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(status, Number(limit), Number(offset))
    .all();
  return c.json(rows.results);
});

admin.patch('/reports/:id', requireAdmin, async (c) => {
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

// ---- 콘텐츠 강제 삭제 ----
admin.delete('/posts/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), id).run();
  return c.json({ ok: true });
});

admin.delete('/comments/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('UPDATE comments SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), id).run();
  return c.json({ ok: true });
});

// ---- 증명서 목록 ----
admin.get('/certificates', requireAdmin, async (c) => {
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

// ---- 증명서 이미지 프록시 ----
admin.get('/certificates/:phoneHash/image', requireAdmin, async (c) => {
  const { phoneHash } = c.req.param();
  const raw = await c.env.DOLDAM_KV.get(`cert:${phoneHash}`);
  if (!raw) return c.json({ error: 'not_found' }, 404);
  const data = JSON.parse(raw) as { r2Key: string };
  const obj = await c.env.DOLDAM_R2.get(data.r2Key);
  if (!obj) return c.json({ error: 'not_found' }, 404);
  const bytes = await obj.arrayBuffer();
  return new Response(bytes, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
    },
  });
});

admin.post('/certificates/:phoneHash/approve', requireAdmin, async (c) => {
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

admin.post('/certificates/:phoneHash/reject', requireAdmin, async (c) => {
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

// ---- 유저 검색 / 전체 목록 ----
admin.get('/users', requireAdmin, async (c) => {
  const q = c.req.query('q') ?? '';
  const { limit = '50', offset = '0' } = c.req.query();

  if (q) {
    const { results } = await c.env.DOLDAM_DB
      .prepare(
        `SELECT id, nickname, gender, age_range, region, verified, banned,
                warning_count, muted_until, created_at
         FROM users WHERE nickname LIKE ? AND deleted_at IS NULL LIMIT 20`
      )
      .bind(`%${q}%`).all();
    return c.json({ results, total: results.length });
  }

  const [{ results }, totalRow] = await Promise.all([
    c.env.DOLDAM_DB
      .prepare(
        `SELECT id, nickname, gender, age_range, region, verified, banned,
                warning_count, muted_until, created_at
         FROM users WHERE deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(Number(limit), Number(offset)).all(),
    c.env.DOLDAM_DB
      .prepare(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL`)
      .first<{ n: number }>(),
  ]);
  return c.json({ results, total: totalRow?.n ?? 0 });
});

// ---- 유저 페널티 ----
admin.post('/users/:id/warn', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const user = await c.env.DOLDAM_DB
    .prepare('SELECT warning_count FROM users WHERE id = ?')
    .bind(id).first<{ warning_count: number }>();
  if (!user) return c.json({ error: 'not_found' }, 404);
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET warning_count = warning_count + 1 WHERE id = ?')
    .bind(id).run();
  return c.json({ ok: true, warningCount: user.warning_count + 1 });
});

admin.post('/users/:id/mute', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { days = 7 } = await c.req.json<{ days?: number }>().catch(() => ({}));
  const mutedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET muted_until = ? WHERE id = ?')
    .bind(mutedUntil, id).run();
  return c.json({ ok: true, mutedUntil });
});

admin.post('/users/:id/ban', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET banned = 1 WHERE id = ?')
    .bind(id).run();
  return c.json({ ok: true });
});

admin.post('/users/:id/unban', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET banned = 0, muted_until = NULL WHERE id = ?')
    .bind(id).run();
  return c.json({ ok: true });
});

admin.post('/poll-eas', requireAdmin, async (c) => {
  await pollEasBuilds(c.env);
  return c.json({ ok: true });
});

export default admin;
