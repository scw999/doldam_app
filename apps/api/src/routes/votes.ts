import { Hono } from 'hono';
import type { Env, AuthedUser, Gender } from '../types';
import { requireAuth } from '../middleware/auth';
import { moderate } from '../middleware/moderation';
import { awardPoints } from '../services/points';
import { buildVoteCardSvg } from '../services/shareCard';
import { POINTS } from '../utils/constants';

type Vars = { user: AuthedUser };
const votes = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 목록 ----
votes.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 50);
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT v.id, v.question, v.description, v.created_at, v.expires_at,
              u.nickname,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id) AS total,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND choice = 'agree') AS agree,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id AND choice = 'disagree') AS disagree
       FROM votes v JOIN users u ON u.id = v.user_id
       ORDER BY v.created_at DESC LIMIT ?`
    ).bind(limit).all();
  return c.json({ items: results });
});

// ---- 상세 (성별 필터) ----
votes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const genderFilter = c.req.query('gender') as Gender | null;

  const vote = await c.env.DOLDAM_DB
    .prepare('SELECT * FROM votes WHERE id = ?').bind(id).first();
  if (!vote) return c.json({ error: 'not_found' }, 404);

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

  const agree = agg.results.find((r) => r.choice === 'agree')?.n ?? 0;
  const disagree = agg.results.find((r) => r.choice === 'disagree')?.n ?? 0;
  return c.json({ ...vote, agree, disagree, total: agree + disagree });
});

// ---- 생성 ----
votes.post('/', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const { question, description, expiresAt } = await c.req.json<{
    question: string; description?: string; expiresAt?: number;
  }>();
  if (!question?.trim()) return c.json({ error: 'empty_question' }, 400);

  const id = crypto.randomUUID();
  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO votes (id, user_id, question, description, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, question.trim(), description?.trim() ?? null, Date.now(), expiresAt ?? null)
    .run();

  return c.json({ id });
});

// ---- 응답 ----
votes.post('/:id/respond', requireAuth, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const { choice } = await c.req.json<{ choice: 'agree' | 'disagree' }>();
  if (!['agree', 'disagree'].includes(choice)) return c.json({ error: 'invalid_choice' }, 400);

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
