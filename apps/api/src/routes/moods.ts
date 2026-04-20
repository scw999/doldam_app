import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { verifyJwt } from '../utils/jwt';
import { moderate } from '../middleware/moderation';

type Vars = { user: AuthedUser };
const moods = new Hono<{ Bindings: Env; Variables: Vars }>();

const MOOD_ENUM = ['good', 'soso', 'sad', 'angry', 'anxious', 'hopeful', 'lonely', 'joyful', 'happy', 'excited'] as const;
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

// ---- 공개 피드 (mine=true 이면 내 기록 포함) ----
moods.get('/feed', requireAuth, async (c) => {
  const user = c.get('user');
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 50);
  const mine = c.req.query('mine') === 'true';

  if (mine) {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { results } = await c.env.DOLDAM_DB
      .prepare(`SELECT id, mood, note, visibility, created_at FROM moods WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?`)
      .bind(user.id, since.getTime(), limit).all();
    return c.json({ items: results });
  }

  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const jwt = token ? await verifyJwt(token, c.env.JWT_SECRET).catch(() => null) : null;
  const myUserId = jwt?.sub ?? null;

  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT m.id, m.mood, m.note, m.like_count, m.created_at,
              u.nickname, u.gender, u.age_range
       FROM moods m JOIN users u ON u.id = m.user_id
       WHERE m.visibility = 'public' AND u.deleted_at IS NULL
       ORDER BY m.created_at DESC LIMIT ?`
    )
    .bind(limit).all<Record<string, unknown>>();

  const withLiked = myUserId
    ? await Promise.all(results.map(async (r) => {
        const liked = await c.env.DOLDAM_DB
          .prepare('SELECT 1 FROM mood_likes WHERE mood_id = ? AND user_id = ?')
          .bind(r.id, myUserId).first();
        return { ...r, myLiked: !!liked };
      }))
    : results.map((r) => ({ ...r, myLiked: false }));

  return c.json({ items: withLiked });
});

// ---- 오늘 기분 수정 ----
moods.patch('/:id', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { mood, note, visibility } = await c.req.json<{
    mood?: string; note?: string; visibility?: string;
  }>();

  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM moods WHERE id = ?')
    .bind(id).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  const sets: string[] = []; const vals: unknown[] = [];
  if (mood && MOOD_ENUM.includes(mood as typeof MOOD_ENUM[number])) { sets.push('mood = ?'); vals.push(mood); }
  if (note !== undefined) { sets.push('note = ?'); vals.push(note?.trim() ?? null); }
  if (visibility) { sets.push('visibility = ?'); vals.push(visibility); }
  if (!sets.length) return c.json({ error: 'nothing_to_update' }, 400);
  vals.push(id);

  await c.env.DOLDAM_DB.prepare(`UPDATE moods SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

// ---- 기분 좋아요 토글 ----
moods.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user');
  const moodId = c.req.param('id');

  const existing = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM mood_likes WHERE mood_id = ? AND user_id = ?')
    .bind(moodId, user.id).first();

  if (existing) {
    await c.env.DOLDAM_DB.prepare('DELETE FROM mood_likes WHERE mood_id = ? AND user_id = ?').bind(moodId, user.id).run();
    await c.env.DOLDAM_DB.prepare('UPDATE moods SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(moodId).run();
    return c.json({ liked: false });
  }

  await c.env.DOLDAM_DB.prepare('INSERT INTO mood_likes (mood_id, user_id, created_at) VALUES (?, ?, ?)').bind(moodId, user.id, Date.now()).run();
  await c.env.DOLDAM_DB.prepare('UPDATE moods SET like_count = like_count + 1 WHERE id = ?').bind(moodId).run();
  return c.json({ liked: true });
});

export default moods;
