import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { verifyJwt } from '../utils/jwt';
import { moderate } from '../middleware/moderation';
import { awardPoints } from '../services/points';
import { POINTS, CATEGORIES, type Category } from '../utils/constants';
import { REPORT_HIDE_THRESHOLD } from './reports';
import { sendPush } from '../services/push';
import { blockFilterSql, isBlocked } from '../utils/blocks';

type Vars = { user: AuthedUser };
const posts = new Hono<{ Bindings: Env; Variables: Vars }>();

async function getReqUserId(req: Request, env: Env): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const jwt = await verifyJwt(token, env.JWT_SECRET).catch(() => null);
  return jwt?.sub ?? null;
}

async function getReqGender(req: Request, env: Env): Promise<'M' | 'F' | null> {
  const userId = await getReqUserId(req, env);
  if (!userId) return null;
  const row = await env.DOLDAM_DB
    .prepare('SELECT gender FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(userId).first<{ gender: 'M' | 'F' }>();
  return row?.gender ?? null;
}

// 인기글 임계값 — app_settings에서 읽어오되 누락 시 안전 기본값으로 폴백
async function getPopularSettings(env: Env): Promise<{ minComments: number; minReactions: number; windowDays: number }> {
  const rows = await env.DOLDAM_DB
    .prepare("SELECT key, value FROM app_settings WHERE key IN ('popular_min_comments','popular_min_reactions','popular_window_days')")
    .all<{ key: string; value: string }>();
  const map = new Map(rows.results.map((r) => [r.key, Number(r.value)] as const));
  return {
    minComments:  Number.isFinite(map.get('popular_min_comments'))  ? map.get('popular_min_comments')!  : 10,
    minReactions: Number.isFinite(map.get('popular_min_reactions')) ? map.get('popular_min_reactions')! : 20,
    windowDays:   Number.isFinite(map.get('popular_window_days'))   ? map.get('popular_window_days')!   : 7,
  };
}

// ---- 목록 (커서 페이지네이션) ----
posts.get('/', async (c) => {
  const categoryParam = c.req.query('category') ?? 'free';
  const all = categoryParam === 'all';
  const popular = categoryParam === 'popular';
  if (!all && !popular && !CATEGORIES.includes(categoryParam as Category)) return c.json({ error: 'invalid_category' }, 400);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const cursor = Number(c.req.query('cursor') ?? Date.now());
  const hot = c.req.query('sort') === 'hot';

  // 차단 양방향 필터 — 인증된 요청에만 적용 (게스트는 그냥 전체)
  const meId = await getReqUserId(c.req.raw, c.env);
  const blockClause = meId ? ` AND ${blockFilterSql('p.user_id')}` : '';
  const blockBinds: unknown[] = meId ? [meId, meId] : [];

  const SEL = `SELECT p.id, p.title, p.content, p.category, p.view_count, p.like_count,
                      p.comment_count, p.created_at, u.nickname, u.gender, u.age_range, u.divorce_year, u.divorce_month
               FROM posts p JOIN users u ON u.id = p.user_id`;

  if (popular) {
    // 인기글: app_settings 임계값 기반, 최근 N일 글만, 성별 전용 카테고리는 보안상 제외
    // 정렬은 (반응+댓글) 가중치 합 내림차순 — 추후 가중치는 임계값과 별도로 튜닝 가능
    const { minComments, minReactions, windowDays } = await getPopularSettings(c.env);
    const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const sql =
      `${SEL}
       WHERE p.deleted_at IS NULL
         AND p.created_at >= ?
         AND p.report_count < ?
         AND p.category NOT IN ('men_only','women_only')
         AND (p.comment_count >= ? OR (p.empathy_count + p.funny_count) >= ?)
         ${blockClause}
       ORDER BY (p.empathy_count + p.funny_count + p.comment_count) DESC, p.created_at DESC
       LIMIT ?`;
    const { results } = await c.env.DOLDAM_DB
      .prepare(sql)
      .bind(since, REPORT_HIDE_THRESHOLD, minComments, minReactions, ...blockBinds, limit)
      .all<{ created_at: number }>();
    // 인기글은 점수 기반 정렬이라 커서 페이지네이션이 의미 없어 nextCursor=null
    return c.json({ items: results, nextCursor: null });
  }

  const ORDER = hot
    ? 'ORDER BY (p.like_count + p.comment_count) DESC, p.created_at DESC'
    : 'ORDER BY p.created_at DESC';

  const { results } = hot
    ? await c.env.DOLDAM_DB
        .prepare(
          `${SEL} WHERE ${all ? '' : 'p.category = ? AND '}p.deleted_at IS NULL AND p.report_count < ?${blockClause}
           ${ORDER} LIMIT ?`
        )
        .bind(...(all ? [REPORT_HIDE_THRESHOLD, ...blockBinds, limit] : [categoryParam, REPORT_HIDE_THRESHOLD, ...blockBinds, limit]))
        .all<{ created_at: number }>()
    : all
    ? await c.env.DOLDAM_DB
        .prepare(`${SEL} WHERE p.deleted_at IS NULL AND p.created_at < ? AND p.report_count < ?${blockClause} ${ORDER} LIMIT ?`)
        .bind(cursor, REPORT_HIDE_THRESHOLD, ...blockBinds, limit)
        .all<{ created_at: number }>()
    : await c.env.DOLDAM_DB
        .prepare(`${SEL} WHERE p.category = ? AND p.deleted_at IS NULL AND p.created_at < ? AND p.report_count < ?${blockClause} ${ORDER} LIMIT ?`)
        .bind(categoryParam, cursor, REPORT_HIDE_THRESHOLD, ...blockBinds, limit)
        .all<{ created_at: number }>();

  const nextCursor = (!hot && results.length === limit) ? results[results.length - 1].created_at : null;
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
  if (title.trim().length > 200) return c.json({ error: 'title_too_long' }, 400);
  if (content.trim().length > 5000) return c.json({ error: 'content_too_long' }, 400);

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
      `SELECT p.*, u.nickname, u.gender, u.age_range, u.divorce_year, u.divorce_month FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ? AND p.deleted_at IS NULL`
    )
    .bind(id)
    .first<{ category: string; user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);

  // 차단 양방향 필터 — 작성자와 차단 관계면 안 보이게
  const meId = await getReqUserId(c.req.raw, c.env);
  if (meId && meId !== row.user_id && await isBlocked(c.env.DOLDAM_DB, meId, row.user_id)) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (row.category === 'men_only' || row.category === 'women_only') {
    const myGender = await getReqGender(c.req.raw, c.env);
    if (row.category === 'men_only' && myGender !== 'M') return c.json({ error: 'forbidden_category' }, 403);
    if (row.category === 'women_only' && myGender !== 'F') return c.json({ error: 'forbidden_category' }, 403);
  }

  await c.env.DOLDAM_DB
    .prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?')
    .bind(id)
    .run();

  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const jwt = token ? await verifyJwt(token, c.env.JWT_SECRET).catch(() => null) : null;
  let myReaction: number | null = null;
  if (jwt?.sub) {
    const liked = await c.env.DOLDAM_DB
      .prepare('SELECT reaction FROM post_likes WHERE post_id = ? AND user_id = ?')
      .bind(id, jwt.sub).first<{ reaction: number }>();
    if (liked) myReaction = liked.reaction;
  }

  // 반응 종류별 집계 — 모든 사용자에게 동일하게 보여야 하므로 서버에서 계산
  const reactionAgg = await c.env.DOLDAM_DB
    .prepare('SELECT reaction, COUNT(*) AS n FROM post_likes WHERE post_id = ? GROUP BY reaction')
    .bind(id).all<{ reaction: number; n: number }>();
  const reactionCounts: Record<string, number> = {};
  for (const r of reactionAgg.results) reactionCounts[String(r.reaction)] = r.n;

  return c.json({ ...row, myReaction, reactionCounts });
});

// ---- 수정 (작성자만) ----
posts.patch('/:id', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { title, content, category } = await c.req.json<{ title?: string; content?: string; category?: string }>();

  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL')
    .bind(id).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  const t = title?.trim(); const ct = content?.trim();
  if (!t && !ct && !category) return c.json({ error: 'empty_content' }, 400);

  // 카테고리 검증 (기존 CATEGORIES 재사용)
  if (category !== undefined) {
    if (!CATEGORIES.includes(category as Category)) return c.json({ error: 'invalid_category' }, 400);
    if (category === 'men_only' && user.gender !== 'M') return c.json({ error: 'forbidden_category' }, 403);
    if (category === 'women_only' && user.gender !== 'F') return c.json({ error: 'forbidden_category' }, 403);
  }

  const sets: string[] = []; const vals: unknown[] = [];
  if (t) { sets.push('title = ?'); vals.push(t); }
  if (ct) { sets.push('content = ?'); vals.push(ct); }
  if (category) { sets.push('category = ?'); vals.push(category); }
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
// reaction=0(공감돼요)과 3(웃겨요)은 인기글 집계용 비정규화 카운터(empathy_count/funny_count)도 같이 갱신
posts.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { reaction = 0 } = await c.req.json<{ reaction?: number }>().catch((): { reaction?: number } => ({}));
  // 0=공감돼요 1=안아줄게요 2=힘내요 3=웃겨요
  if (![0, 1, 2, 3].includes(reaction)) return c.json({ error: 'invalid_reaction' }, 400);

  const existing = await c.env.DOLDAM_DB
    .prepare('SELECT reaction FROM post_likes WHERE post_id = ? AND user_id = ?')
    .bind(id, user.id).first<{ reaction: number }>();

  if (existing) {
    const prev = existing.reaction;
    await c.env.DOLDAM_DB
      .prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?')
      .bind(id, user.id).run();
    const decEmpathy = prev === 0 ? ', empathy_count = MAX(0, empathy_count - 1)' : '';
    const decFunny   = prev === 3 ? ', funny_count = MAX(0, funny_count - 1)'     : '';
    await c.env.DOLDAM_DB
      .prepare(`UPDATE posts SET like_count = MAX(0, like_count - 1)${decEmpathy}${decFunny} WHERE id = ?`)
      .bind(id).run();
    return c.json({ liked: false });
  }

  await c.env.DOLDAM_DB
    .prepare('INSERT INTO post_likes (post_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, user.id, reaction, Date.now()).run();
  const incEmpathy = reaction === 0 ? ', empathy_count = empathy_count + 1' : '';
  const incFunny   = reaction === 3 ? ', funny_count = funny_count + 1'     : '';
  await c.env.DOLDAM_DB
    .prepare(`UPDATE posts SET like_count = like_count + 1${incEmpathy}${incFunny} WHERE id = ?`)
    .bind(id).run();
  return c.json({ liked: true });
});

// ---- 댓글 목록 ----
posts.get('/:id/comments', async (c) => {
  const id = c.req.param('id');

  const postRow = await c.env.DOLDAM_DB
    .prepare('SELECT category FROM posts WHERE id = ? AND deleted_at IS NULL')
    .bind(id).first<{ category: string }>();
  if (!postRow) return c.json({ error: 'not_found' }, 404);
  if (postRow.category === 'men_only' || postRow.category === 'women_only') {
    const myGender = await getReqGender(c.req.raw, c.env);
    if (postRow.category === 'men_only' && myGender !== 'M') return c.json({ error: 'forbidden_category' }, 403);
    if (postRow.category === 'women_only' && myGender !== 'F') return c.json({ error: 'forbidden_category' }, 403);
  }

  // 차단 양방향 필터 — 인증된 요청에만 적용
  const meId = await getReqUserId(c.req.raw, c.env);
  const blockClause = meId ? ` AND ${blockFilterSql('cm.user_id')}` : '';
  const blockBinds: unknown[] = meId ? [meId, meId] : [];

  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT cm.id, cm.content, cm.parent_id, cm.created_at, cm.user_id, u.nickname, u.gender
       FROM comments cm JOIN users u ON u.id = cm.user_id
       WHERE cm.post_id = ? AND cm.deleted_at IS NULL AND cm.report_count < ?${blockClause}
       ORDER BY cm.created_at ASC LIMIT 200`
    )
    .bind(id, REPORT_HIDE_THRESHOLD, ...blockBinds).all();
  return c.json({ items: results });
});

// ---- 댓글 수정 ----
posts.patch('/:postId/comments/:id', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const commentId = c.req.param('id');
  const { content } = await c.req.json<{ content: string }>();
  if (!content?.trim()) return c.json({ error: 'empty_content' }, 400);

  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM comments WHERE id = ? AND deleted_at IS NULL')
    .bind(commentId).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  await c.env.DOLDAM_DB
    .prepare('UPDATE comments SET content = ? WHERE id = ?')
    .bind(content.trim(), commentId).run();
  return c.json({ ok: true });
});

// ---- 댓글 작성 ----
posts.post('/:id/comments', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const postId = c.req.param('id');
  const { content, parentId } = await c.req.json<{ content: string; parentId?: string }>();
  if (!content?.trim()) return c.json({ error: 'empty_content' }, 400);

  // 성별 전용 방 댓글 제한
  const postRow = await c.env.DOLDAM_DB
    .prepare('SELECT category FROM posts WHERE id = ? AND deleted_at IS NULL')
    .bind(postId).first<{ category: string }>();
  if (postRow?.category === 'men_only' && user.gender !== 'M') return c.json({ error: 'forbidden_category' }, 403);
  if (postRow?.category === 'women_only' && user.gender !== 'F') return c.json({ error: 'forbidden_category' }, 403);

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

  const commenter = await c.env.DOLDAM_DB
    .prepare('SELECT nickname FROM users WHERE id = ?')
    .bind(user.id).first<{ nickname: string }>();
  const nick = commenter?.nickname ?? '익명';

  // 게시글 작성자에게 알림 (응답 블로킹 없이 백그라운드 전송)
  const author = await c.env.DOLDAM_DB
    .prepare('SELECT user_id FROM posts WHERE id = ?')
    .bind(postId).first<{ user_id: string }>();

  const notifPromises: Promise<void>[] = [];
  if (author && author.user_id !== user.id) {
    notifPromises.push(
      sendPush(c.env, author.user_id, '새 댓글이 달렸어요', `${nick}: ${content.trim().slice(0, 40)}`, { postId, commentId: id }, 'comment')
    );
  }

  // 대댓글인 경우 부모 댓글 작성자에게도 알림
  if (parentId) {
    const parentComment = await c.env.DOLDAM_DB
      .prepare('SELECT user_id FROM comments WHERE id = ?')
      .bind(parentId).first<{ user_id: string }>();
    if (parentComment && parentComment.user_id !== user.id && parentComment.user_id !== author?.user_id) {
      notifPromises.push(
        sendPush(c.env, parentComment.user_id, '답글이 달렸어요', `${nick}: ${content.trim().slice(0, 40)}`, { postId, commentId: id }, 'reply')
      );
    }
  }

  c.executionCtx.waitUntil(Promise.all(notifPromises));

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
