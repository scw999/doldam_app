import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

type Vars = { user: AuthedUser };
const reports = new Hono<{ Bindings: Env; Variables: Vars }>();

type Target = 'post' | 'comment' | 'user' | 'message';

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

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(crypto.randomUUID(), user.id, targetType, targetId, reason.trim(), Date.now())
    .run();

  return c.json({ ok: true });
});

export default reports;
