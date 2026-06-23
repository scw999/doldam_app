import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';

type Vars = { user: AuthedUser };
const blocks = new Hono<{ Bindings: Env; Variables: Vars }>();

// 차단하기
blocks.post('/', requireAuth, async (c) => {
  const me = c.get('user');
  const { targetId } = await c.req.json<{ targetId: string }>();
  if (!targetId || targetId === me.id) return c.json({ error: 'invalid_target' }, 400);

  // 대상이 실제로 존재하는지 (탈퇴자/유령 ID 차단 방지)
  const exists = await c.env.DOLDAM_DB
    .prepare('SELECT 1 AS x FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(targetId).first();
  if (!exists) return c.json({ error: 'user_not_found' }, 404);

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at)
       VALUES (?, ?, ?)`
    )
    .bind(me.id, targetId, Date.now()).run();

  return c.json({ ok: true });
});

// 차단 해제
blocks.delete('/:targetId', requireAuth, async (c) => {
  const me = c.get('user');
  const targetId = c.req.param('targetId');
  await c.env.DOLDAM_DB
    .prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?')
    .bind(me.id, targetId).run();
  return c.json({ ok: true });
});

// 내가 차단한 사용자 목록 (관리 화면용)
blocks.get('/', requireAuth, async (c) => {
  const me = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT u.id, u.nickname, u.gender, u.age_range, u.region, b.created_at
       FROM user_blocks b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ? AND u.deleted_at IS NULL
       ORDER BY b.created_at DESC`
    )
    .bind(me.id).all();
  return c.json({ items: results });
});

export default blocks;
