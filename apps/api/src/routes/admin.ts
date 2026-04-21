import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAdmin } from '../middleware/auth';
import { pollEasBuilds } from '../services/easPoller';
import { sendPush } from '../services/push';

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
              COALESCE(p.user_id, cm.user_id, v.user_id, CASE WHEN r.target_type='user' THEN r.target_id END) AS target_user_id,
              tu.nickname AS target_user_nickname,
              p.title     AS post_title,
              COALESCE(p.content, cm.content, v.question, CASE WHEN r.target_type='user' THEN tu2.nickname END) AS target_content
       FROM reports r
       LEFT JOIN users u   ON u.id = r.reporter_id
       LEFT JOIN posts p   ON p.id = r.target_id AND r.target_type = 'post'
       LEFT JOIN comments cm ON cm.id = r.target_id AND r.target_type = 'comment'
       LEFT JOIN votes v   ON v.id = r.target_id AND r.target_type = 'vote'
       LEFT JOIN users tu  ON tu.id = COALESCE(p.user_id, cm.user_id, v.user_id)
       LEFT JOIN users tu2 ON tu2.id = r.target_id AND r.target_type = 'user'
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

admin.delete('/votes/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('DELETE FROM votes WHERE id = ?')
    .bind(id).run();
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
  const { reason = '검증 실패' } = await c.req.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
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

  const COLS = `id, nickname, gender, age_range, region, divorce_year, divorce_month, verified, banned,
                warning_count, muted_until, created_at, job, has_kids, intro, interests`;

  if (q) {
    const { results } = await c.env.DOLDAM_DB
      .prepare(`SELECT ${COLS} FROM users WHERE nickname LIKE ? AND deleted_at IS NULL LIMIT 20`)
      .bind(`%${q}%`).all();
    return c.json({ results, total: results.length });
  }

  const [{ results }, totalRow] = await Promise.all([
    c.env.DOLDAM_DB
      .prepare(
        `SELECT ${COLS} FROM users WHERE deleted_at IS NULL
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
  const { reason } = await c.req.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
  const user = await c.env.DOLDAM_DB
    .prepare('SELECT warning_count FROM users WHERE id = ?')
    .bind(id).first<{ warning_count: number }>();
  if (!user) return c.json({ error: 'not_found' }, 404);
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET warning_count = warning_count + 1 WHERE id = ?')
    .bind(id).run();
  const newCount = user.warning_count + 1;
  const body = reason
    ? `${reason} (누적 ${newCount}회 경고)`
    : `커뮤니티 규정 위반으로 경고가 발급되었습니다. (누적 ${newCount}회)`;
  c.executionCtx.waitUntil(
    sendPush(c.env, id, '⚠️ 경고 알림', body, { type: 'admin_warn', count: newCount })
  );
  return c.json({ ok: true, warningCount: newCount });
});

admin.post('/users/:id/mute', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { days = 7, reason } = await c.req.json<{ days?: number; reason?: string }>().catch((): { days?: number; reason?: string } => ({}));
  const mutedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET muted_until = ? WHERE id = ?')
    .bind(mutedUntil, id).run();
  const body = reason
    ? `${reason} — ${days}일간 서비스 이용이 정지되었습니다.`
    : `커뮤니티 규정 위반으로 ${days}일간 서비스 이용이 정지되었습니다.`;
  c.executionCtx.waitUntil(
    sendPush(c.env, id, '🚫 이용 정지 알림', body, { type: 'admin_mute', days, mutedUntil })
  );
  return c.json({ ok: true, mutedUntil });
});

admin.post('/users/:id/ban', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { reason } = await c.req.json<{ reason?: string }>().catch((): { reason?: string } => ({}));
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET banned = 1 WHERE id = ?')
    .bind(id).run();
  const body = reason
    ? `${reason} — 계정이 영구 정지되었습니다.`
    : '커뮤니티 규정 위반으로 계정이 영구 정지되었습니다.';
  c.executionCtx.waitUntil(
    sendPush(c.env, id, '🔴 영구 정지 알림', body, { type: 'admin_ban' })
  );
  return c.json({ ok: true });
});

admin.post('/users/:id/unban', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET banned = 0, muted_until = NULL WHERE id = ?')
    .bind(id).run();
  return c.json({ ok: true });
});

admin.post('/users/:id/unmute', requireAdmin, async (c) => {
  const { id } = c.req.param();
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET muted_until = NULL WHERE id = ?')
    .bind(id).run();
  return c.json({ ok: true });
});

admin.post('/users/:id/unwarn', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const user = await c.env.DOLDAM_DB
    .prepare('SELECT warning_count FROM users WHERE id = ?')
    .bind(id).first<{ warning_count: number }>();
  if (!user) return c.json({ error: 'not_found' }, 404);
  const newCount = Math.max(0, user.warning_count - 1);
  await c.env.DOLDAM_DB
    .prepare('UPDATE users SET warning_count = ? WHERE id = ?')
    .bind(newCount, id).run();
  return c.json({ ok: true, warningCount: newCount });
});

admin.post('/poll-eas', requireAdmin, async (c) => {
  await pollEasBuilds(c.env);
  return c.json({ ok: true });
});

// ---- 테스트 푸시 알림 전송 ----
admin.post('/push-test', requireAdmin, async (c) => {
  const { userId, title = '테스트 알림', body = '돌담 푸시 알림이 작동하고 있어요!' } =
    await c.req.json<{ userId: string; title?: string; body?: string }>();
  if (!userId) return c.json({ error: 'userId_required' }, 400);

  const user = await c.env.DOLDAM_DB
    .prepare('SELECT id FROM users WHERE id = ?')
    .bind(userId).first<{ id: string }>();
  if (!user) return c.json({ error: 'user_not_found' }, 404);

  await sendPush(c.env, userId, title, body, { type: 'admin_test' });
  return c.json({ ok: true });
});

export default admin;
