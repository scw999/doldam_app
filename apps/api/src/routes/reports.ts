import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

type Vars = { user: AuthedUser };
const reports = new Hono<{ Bindings: Env; Variables: Vars }>();

type Target = 'post' | 'comment' | 'user' | 'message';

const REPORT_HIDE_THRESHOLD = 5;

reports.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const { targetType, targetId, reason } = await c.req.json<{
    targetType: Target;
    targetId: string;
    reason: string;
  }>();
  if (!['post', 'comment', 'user', 'message'].includes(targetType)) {
    return c.json({ error: 'invalid_target_type' }, 400);
  }
  if (!reason?.trim()) return c.json({ error: 'reason_required' }, 400);

  // 중복 신고 방지
  const dup = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM reports WHERE reporter_id = ? AND target_id = ? AND target_type = ?')
    .bind(user.id, targetId, targetType).first();
  if (dup) return c.json({ ok: true, duplicate: true });

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(crypto.randomUUID(), user.id, targetType, targetId, reason.trim(), Date.now())
    .run();

  if (targetType === 'post') {
    await c.env.DOLDAM_DB
      .prepare('UPDATE posts SET report_count = report_count + 1 WHERE id = ?')
      .bind(targetId).run();
  } else if (targetType === 'comment') {
    await c.env.DOLDAM_DB
      .prepare('UPDATE comments SET report_count = report_count + 1 WHERE id = ?')
      .bind(targetId).run();
  }

  return c.json({ ok: true });
});

export { REPORT_HIDE_THRESHOLD };
export default reports;
