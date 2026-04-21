import { Hono } from 'hono';
import type { Env, AuthedUser, Gender } from '../types';
import { requireAuth } from '../middleware/auth';
import { verifyJwt } from '../utils/jwt';
import { moderate } from '../middleware/moderation';
import { awardPoints } from '../services/points';
import { buildVoteCardSvg } from '../services/shareCard';
import { POINTS } from '../utils/constants';

type Vars = { user: AuthedUser };
const votes = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 목록 ----
votes.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 50);
  const gender = c.req.query('gender') as 'M' | 'F' | undefined;

  const sql = gender
    ? `SELECT v.id, v.question, v.description, v.options, v.created_at, v.expires_at,
              u.nickname,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND gender = '${gender}') AS total,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND choice = 'agree' AND gender = '${gender}') AS agree,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND choice = 'disagree' AND gender = '${gender}') AS disagree
       FROM votes v JOIN users u ON u.id = v.user_id
       ORDER BY total DESC, v.created_at DESC LIMIT ?`
    : `SELECT v.id, v.question, v.description, v.options, v.created_at, v.expires_at,
              u.nickname,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id) AS total,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND choice = 'agree') AS agree,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND choice = 'disagree') AS disagree
       FROM votes v JOIN users u ON u.id = v.user_id
       ORDER BY total DESC, v.created_at DESC LIMIT ?`;

  const { results } = await c.env.DOLDAM_DB.prepare(sql).bind(limit).all();
  c.header('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
  return c.json({ items: results });
});

// ---- 상세 (성별 필터) ----
votes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const genderFilter = c.req.query('gender') as Gender | null;

  const vote = await c.env.DOLDAM_DB
    .prepare('SELECT * FROM votes WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!vote) return c.json({ error: 'not_found' }, 404);

  const options: string[] | null = vote.options ? JSON.parse(vote.options as string) : null;

  const agg = genderFilter
    ? await c.env.DOLDAM_DB
        .prepare(
          `SELECT choice, COUNT(*) AS n FROM vote_responses
           WHERE vote_id = ? AND gender = ? GROUP BY choice`
        )
        .bind(id, genderFilter).all<{ choice: string; n: number }>()
    : await c.env.DOLDAM_DB
        .prepare(
          `SELECT choice, COUNT(*) AS n FROM vote_responses
           WHERE vote_id = ? GROUP BY choice`
        )
        .bind(id).all<{ choice: string; n: number }>();

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of agg.results) {
    counts[row.choice] = row.n;
    total += row.n;
  }
  const agree = counts['agree'] ?? 0;
  const disagree = counts['disagree'] ?? 0;

  let myChoice: string | null = null;
  if (!genderFilter) {
    const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    const jwt = token ? await verifyJwt(token, c.env.JWT_SECRET).catch(() => null) : null;
    if (jwt?.sub) {
      const row = await c.env.DOLDAM_DB
        .prepare('SELECT choice FROM vote_responses WHERE vote_id = ? AND user_id = ?')
        .bind(id, jwt.sub).first<{ choice: string }>();
      myChoice = row?.choice ?? null;
    }
  }

  return c.json({ ...vote, options, counts, agree, disagree, total, myChoice });
});

// ---- 생성 ----
votes.post('/', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const { question, description, expiresAt, options } = await c.req.json<{
    question: string; description?: string; expiresAt?: number; options?: string[];
  }>();
  if (!question?.trim()) return c.json({ error: 'empty_question' }, 400);

  let optionsJson: string | null = null;
  if (Array.isArray(options) && options.length > 0) {
    const clean = options.map((o) => String(o).trim()).filter(Boolean);
    if (clean.length < 2 || clean.length > 6) return c.json({ error: 'invalid_options' }, 400);
    optionsJson = JSON.stringify(clean);
  }

  const id = crypto.randomUUID();
  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO votes (id, user_id, question, description, options, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, question.trim(), description?.trim() ?? null, optionsJson, Date.now(), expiresAt ?? null)
    .run();

  return c.json({ id });
});

// ---- 응답 ----
votes.post('/:id/respond', requireAuth, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const { choice } = await c.req.json<{ choice: string }>();

  const vote = await c.env.DOLDAM_DB
    .prepare('SELECT options FROM votes WHERE id = ?').bind(id).first<{ options: string | null }>();
  if (!vote) return c.json({ error: 'not_found' }, 404);

  if (vote.options) {
    const opts: string[] = JSON.parse(vote.options);
    if (!opts.includes(choice)) return c.json({ error: 'invalid_choice' }, 400);
  } else {
    if (!['agree', 'disagree'].includes(choice)) return c.json({ error: 'invalid_choice' }, 400);
  }

  const existing = await c.env.DOLDAM_DB
    .prepare('SELECT choice FROM vote_responses WHERE vote_id = ? AND user_id = ?')
    .bind(id, user.id).first<{ choice: string }>();

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT OR REPLACE INTO vote_responses (vote_id, user_id, choice, gender, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, choice, user.gender, Date.now()).run();

  // 첫 참여만 포인트 적립
  if (!existing) {
    await awardPoints(c.env, user.id, POINTS.REWARD_VOTE_CAST, 'vote_cast');
  }
  return c.json({ ok: true });
});

// ---- 공유카드 SVG ----
votes.get('/:id/card.svg', async (c) => {
  const id = c.req.param('id');
  const vote = await c.env.DOLDAM_DB
    .prepare('SELECT question FROM votes WHERE id = ?')
    .bind(id).first<{ question: string }>();
  if (!vote) return c.json({ error: 'not_found' }, 404);

  const agg = await c.env.DOLDAM_DB
    .prepare(
      `SELECT choice, COUNT(*) AS n FROM vote_responses WHERE vote_id = ? GROUP BY choice`
    )
    .bind(id).all<{ choice: string; n: number }>();
  const a = agg.results.find((r) => r.choice === 'agree')?.n ?? 0;
  const d = agg.results.find((r) => r.choice === 'disagree')?.n ?? 0;
  const total = a + d;
  const agree = total ? Math.round((a / total) * 100) : 0;
  const disagree = total ? 100 - agree : 0;

  const svg = buildVoteCardSvg({ question: vote.question, agree, disagree, total });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});

export default votes;
