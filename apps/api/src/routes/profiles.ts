import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { moderate } from '../middleware/moderation';
import { spendPoints } from '../services/points';
import { POINTS } from '../utils/constants';

type Vars = { user: AuthedUser };
const profiles = new Hono<{ Bindings: Env; Variables: Vars }>();

const UNLOCKABLE_FIELDS = ['job', 'has_kids', 'intro', 'interests'] as const;
type UnlockField = typeof UNLOCKABLE_FIELDS[number];

// 내 프로필 업데이트 (유료 항목 + 닉네임 포함, 본인이니까 제한 없음)
const updateMe = async (c: any) => {
  const user = c.get('user');
  const { job, hasKids, intro, interests, nickname } = await c.req.json<{
    job?: string | null; hasKids?: boolean | null;
    intro?: string | null; interests?: string | null;
    nickname?: string | null;
  }>();

  if (nickname !== undefined && nickname !== null) {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 12) return c.json({ error: 'invalid_nickname' }, 400);
    const dup = await c.env.DOLDAM_DB
      .prepare('SELECT 1 FROM users WHERE nickname = ? AND id != ?')
      .bind(trimmed, user.id).first();
    if (dup) return c.json({ error: 'nickname_taken' }, 409);
    await c.env.DOLDAM_DB
      .prepare('UPDATE users SET nickname = ? WHERE id = ?')
      .bind(trimmed, user.id).run();
  }

  await c.env.DOLDAM_DB
    .prepare(
      `UPDATE users SET
         job = COALESCE(?, job),
         has_kids = COALESCE(?, has_kids),
         intro = COALESCE(?, intro),
         interests = COALESCE(?, interests)
       WHERE id = ?`
    )
    .bind(
      job ?? null,
      hasKids === undefined ? null : hasKids ? 1 : 0,
      intro ?? null,
      interests ?? null,
      user.id
    )
    .run();
  return c.json({ ok: true });
};
profiles.put('/me', requireAuth, moderate, updateMe);
profiles.patch('/me', requireAuth, moderate, updateMe);

// 다른 유저 프로필 — 무료 요약(별명/성별/나이대/지역) + 이미 언락한 항목
profiles.get('/:id', requireAuth, async (c) => {
  const viewer = c.get('user');
  const targetId = c.req.param('id');

  const target = await c.env.DOLDAM_DB
    .prepare(
      `SELECT id, nickname, gender, age_range, region, divorce_year, divorce_month, job, has_kids, intro, interests
       FROM users WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(targetId)
    .first<{
      id: string; nickname: string; gender: 'M' | 'F'; age_range: string; region: string;
      divorce_year: number | null; divorce_month: number | null;
      job: string | null; has_kids: number | null; intro: string | null; interests: string | null;
    }>();
  if (!target) return c.json({ error: 'not_found' }, 404);

  // 본인이면 전체 노출
  if (viewer.id === targetId) {
    return c.json({ ...target, unlocked: UNLOCKABLE_FIELDS });
  }

  const { results } = await c.env.DOLDAM_DB
    .prepare('SELECT field FROM profile_unlocks WHERE unlocker_id = ? AND target_id = ?')
    .bind(viewer.id, targetId).all<{ field: string }>();
  const unlocked = new Set(results.map((r) => r.field));

  const summary = {
    id: target.id, nickname: target.nickname,
    gender: target.gender, age_range: target.age_range, region: target.region,
    job: unlocked.has('job') ? target.job : null,
    has_kids: unlocked.has('has_kids') ? target.has_kids : null,
    intro: unlocked.has('intro') ? target.intro : null,
    interests: unlocked.has('interests') ? target.interests : null,
    unlocked: [...unlocked],
  };
  return c.json(summary);
});

// 유료 항목 언락
profiles.post('/:id/unlock', requireAuth, async (c) => {
  const viewer = c.get('user');
  const targetId = c.req.param('id');
  const { field } = await c.req.json<{ field: UnlockField }>();
  if (!UNLOCKABLE_FIELDS.includes(field)) return c.json({ error: 'invalid_field' }, 400);
  if (viewer.id === targetId) return c.json({ error: 'self_not_allowed' }, 400);

  const existing = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM profile_unlocks WHERE unlocker_id = ? AND target_id = ? AND field = ?')
    .bind(viewer.id, targetId, field)
    .first();
  if (existing) return c.json({ ok: true, alreadyUnlocked: true });

  const spent = await spendPoints(c.env, viewer.id, POINTS.COST_UNLOCK_PROFILE_ITEM, `unlock:${field}`);
  if (!spent.ok) return c.json({ error: spent.reason ?? 'cannot_spend' }, 400);

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO profile_unlocks (unlocker_id, target_id, field, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(viewer.id, targetId, field, Date.now()).run();

  return c.json({ ok: true });
});

export default profiles;
