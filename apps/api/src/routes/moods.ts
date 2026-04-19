import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { moderate } from '../middleware/moderation';

type Vars = { user: AuthedUser };
const moods = new Hono<{ Bindings: Env; Variables: Vars }>();

const MOOD_ENUM = ['good', 'soso', 'sad', 'angry', 'anxious', 'hopeful', 'lonely'] as const;
type Mood = typeof MOOD_ENUM[number];

// ---- 기록 ----
moods.post('/', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const { mood, note, visibility } = await c.req.json<{
    mood: Mood;
    note?: string;
    visibility: 'private' | 'friends' | 'public';
  }>();
  if (!MOOD_ENUM.includes(mood)) return c.json({ error: 'invalid_mood' }, 400);

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO moods (id, user_id, mood, note, visibility, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), user.id, mood, note?.trim() ?? null, visibility, Date.now())
    .run();
  return c.json({ ok: true });
});

// ---- 내 90일 기록 ----
moods.get('/mine', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT mood, note, visibility, created_at FROM moods
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 90`
    )
    .bind(user.id).all();
  return c.json({ items: results });
});

// ---- 주간 집계 ----
moods.get('/summary', requireAuth, async (c) => {
  const user = c.get('user');
  const since = Date.now() - 7 * 86400 * 1000;
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT mood, COUNT(*) AS n FROM moods
       WHERE user_id = ? AND created_at >= ? GROUP BY mood`
    )
    .bind(user.id, since).all<{ mood: string; n: number }>();
  return c.json({ since, items: results });
});

// ---- 공개 피드 ----
moods.get('/feed', requireAuth, async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 50);
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT m.id, m.mood, m.note, m.created_at,
              u.nickname, u.gender, u.age_range
       FROM moods m JOIN users u ON u.id = m.user_id
       WHERE m.visibility = 'public' AND u.deleted_at IS NULL
       ORDER BY m.created_at DESC LIMIT ?`
    )
    .bind(limit).all();
  return c.json({ items: results });
});

export default moods;
