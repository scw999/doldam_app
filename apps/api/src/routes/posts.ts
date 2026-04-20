import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { verifyJwt } from '../utils/jwt';
import { moderate } from '../middleware/moderation';
import { awardPoints } from '../services/points';
import { POINTS, CATEGORIES, type Category } from '../utils/constants';
import { REPORT_HIDE_THRESHOLD } from './reports';
import { sendPush } from '../services/push';

type Vars = { user: AuthedUser };
const posts = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 목록 (커서 페이지네이션) ----
posts.get('/', async (c) => {
  const categoryParam = c.req.query('category') ?? 'free';
  const all = categoryParam === 'all';
  if (!all && !CATEGORIES.includes(categoryParam as Category)) return c.json({ error: 'invalid_category' }, 400);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const cursor = Number(c.req.query('cursor') ?? Date.now());

  const { results } = all
    ? await c.env.DOLDAM_DB
        .prepare(
          `SELECT p.id, p.title, p.content, p.category, p.view_count, p.like_count,
                  p.comment_count, p.created_at, u.nickname, u.gender, u.age_range, u.divorce_year
           FROM posts p JOIN users u ON u.id = p.user_id
           WHERE p.deleted_at IS NULL AND p.created_at < ? AND p.report_count < ?
           ORDER BY p.created_at DESC LIMIT ?`
        )
        .bind(cursor, REPORT_HIDE_THRESHOLD, limit)
        .all<{ created_at: number }>()
    : await c.env.DOLDAM_DB
        .prepare(
          `SELECT p.id, p.title, p.content, p.category, p.view_count, p.like_count,
                  p.comment_count, p.created_at, u.nickname, u.gender, u.age_range, u.divorce_year
           FROM posts p JOIN users u ON u.id = p.user_id
           WHERE p.category = ? AND p.deleted_at IS NULL AND p.created_at < ? AND p.report_count < ?
           ORDER BY p.created_at DESC LIMIT ?`
        )
        .bind(categoryParam, cursor, REPORT_HIDE_THRESHOLD, limit)
        .all<{ created_at: number }>();

  const nextCursor = results.length === limit ? results[results.length - 1].created_at : null;
  return c.json({ items: results, nextCursor });
});

// ---- 내 글 목록 ----
posts.get('/mine', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT id, title, content, category, like_count, comment_count, created_at
       FROM posts WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 50`
    )
    .bind(user.id).all();
  return c.json({ items: results });
});

// ---- 생성 ----
posts.post('/', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const { title, content, category } = await c.req.json<{
    title: string; content: string; category: Category;
  }>();

  if (!CATEGORIES.includes(category)) return c.json({ error: 'invalid_category' }, 400);
  if (category === 'men_only' && user.gender !== 'M') return c.json({ error: 'forbidden_category' }, 403);
  if (category === 'women_only' && user.gender !== 'F') return c.json({ error: 'forbidden_category' }, 403);
  if (!title?.trim() || !content?.trim()) return c.json({ error: 'empty_content' }, 400);

  const muteRow = await c.env.DOLDAM_DB
    .prepare('SELECT muted_until FROM users WHERE id = ?')
    .bind(user.id).first<{ muted_until: number | null }>();
  if (muteRow?.muted_until && muteRow.muted_until > Date.now()) {
    return c.json({ error: 'muted', mutedUntil: muteRow.muted_until }, 403);
  }

  const id = crypto.randomUUID();
  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO posts (id, user_id, title, content, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, title.trim(), content.trim(), category, Date.now())
    .run();

  await awardPoints(c.env, user.id, POINTS.REWARD_POST_CREATE, 'post_create');
  return c.json({ id });
});

// ---- 상세 ----
posts.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DOLDAM_DB
    .prepare(
      `SELECT p.*, u.nickname, u.gender, u.age_range, u.divorce_year FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ? AND p.deleted_at IS NULL`
    )
    .bind(id)
    .first();
  if (!row) return c.json({ error: 'not_found' }, 404);

  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?')
    .bind(id)
    .run();

  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const jwt = token ? await verifyJwt(token, c.env.JWT_SECRET).catch(() => null) : null;
  let myLiked = false;
  if (jwt?.sub) {
    const liked = await c.env.DOLDAM_DB
      .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?')
      .bind(id, jwt.sub).first();
    myLiked = !!liked;
  }

  return c.json({ ...row, myLiked });
});

// ---- 수정 (작성자만) ----
posts.patch('/:id', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { title, content } = await c.req.json<{ title?: string; content?: string }>();

  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL')
    .bind(id).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  const t = title?.trim(); const ct = content?.trim();
  if (!t && !ct) return c.json({ error: 'empty_content' }, 400);

  const sets: string[] = []; const vals: unknown[] = [];
  if (t) { sets.push('title = ?'); vals.push(t); }
  if (ct) { sets.push('content = ?'); vals.push(ct); }
  vals.push(id);

  await c.env.DOLDAM_DB
    .prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals).run();

  return c.json({ ok: true });
});

// ---- 삭제 (작성자만) ----
posts.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL')
    .bind(id).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), id).run();
  return c.json({ ok: true });
});

// ---- 좋아요 토글 ----
posts.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?')
    .bind(id, user.id).first();

  if (existing) {
    await c.env.DOLDAM_DB
      .prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?')
      .bind(id, user.id).run();
    await c.env.DOLDAM_DB
      .prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?')
      .bind(id).run();
    return c.json({ liked: false });
  }

  await c.env.DOLDAM_DB
    .prepare('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)')
    .bind(id, user.id, Date.now()).run();
  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?')
    .bind(id).run();
  return c.json({ liked: true });
});

// ---- 댓글 목록 ----
posts.get('/:id/comments', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT cm.id, cm.content, cm.parent_id, cm.created_at, u.nickname, u.gender
       FROM comments cm JOIN users u ON u.id = cm.user_id
       WHERE cm.post_id = ? AND cm.deleted_at IS NULL AND cm.report_count < ?
       ORDER BY cm.created_at ASC LIMIT 200`
    )
    .bind(id, REPORT_HIDE_THRESHOLD).all();
  return c.json({ items: results });
});

// ---- 댓글 작성 ----
posts.post('/:id/comments', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const postId = c.req.param('id');
  const { content, parentId } = await c.req.json<{ content: string; parentId?: string }>();
  if (!content?.trim()) return c.json({ error: 'empty_content' }, 400);

  const muteRow2 = await c.env.DOLDAM_DB
    .prepare('SELECT muted_until FROM users WHERE id = ?')
    .bind(user.id).first<{ muted_until: number | null }>();
  if (muteRow2?.muted_until && muteRow2.muted_until > Date.now()) {
    return c.json({ error: 'muted', mutedUntil: muteRow2.muted_until }, 403);
  }

  const id = crypto.randomUUID();
  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO comments (id, post_id, user_id, content, parent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, postId, user.id, content.trim(), parentId ?? null, Date.now())
    .run();
  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?')
    .bind(postId).run();

  await awardPoints(c.env, user.id, POINTS.REWARD_COMMENT, 'comment_create');

  const author = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM posts WHERE id = ?')
    .bind(postId).first<{ user_id: string }>();
  if (author && author.user_id !== user.id) {
    const commenter = await c.env.DOLDAM_DB
      .prepare('SELECT nickname FROM users WHERE id = ?')
      .bind(user.id).first<{ nickname: string }>();
    await c.env.DOLDAM_QUEUE.send({
      type: 'notification',
      userId: author.user_id,
      title: '새 댓글이 달렸어요',
      body: `${commenter?.nickname ?? '익명'}: ${content.trim().slice(0, 40)}`,
    });
  }

  return c.json({ id });
});

// ---- 댓글 삭제 ----
posts.delete('/:postId/comments/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const commentId = c.req.param('id');
  const postId = c.req.param('postId');
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM comments WHERE id = ? AND deleted_at IS NULL')
    .bind(commentId).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  await c.env.DOLDAM_DB
    .prepare('UPDATE comments SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), commentId).run();
  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?')
    .bind(postId).run();
  return c.json({ ok: true });
});

export default posts;
