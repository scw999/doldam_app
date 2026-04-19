import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { moderate } from '../middleware/moderation';
import { awardPoints } from '../services/points';
import { MISSION, POINTS } from '../utils/constants';

type Vars = { user: AuthedUser };
const missions = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 현재 진행 라운드 or 새 라운드 시작 ----
missions.get('/current', requireAuth, async (c) => {
  const user = c.get('user');
  const now = Date.now();

  let round = await c.env.DOLDAM_DB
    .prepare(
      `SELECT * FROM mission_rounds
       WHERE user_id = ? AND completed_at IS NULL AND expires_at > ?
       ORDER BY started_at DESC LIMIT 1`
    )
    .bind(user.id, now)
    .first<{ id: string; started_at: number; expires_at: number }>();

  if (!round) {
    // 새 라운드 생성 + 10개 질문 할당
    const roundId = crypto.randomUUID();
    const expiresAt = now + MISSION.ROUND_DAYS * 86400 * 1000;
    await c.env.DOLDAM_DB
      .prepare(
        `INSERT INTO mission_rounds (id, user_id, started_at, expires_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(roundId, user.id, now, expiresAt)
      .run();
    round = { id: roundId, started_at: now, expires_at: expiresAt };
  }

  const { results: questions } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT q.id, q.question, q.category,
              (SELECT a.answer FROM mission_answers a
               WHERE a.round_id = ? AND a.question_id = q.id) AS my_answer
       FROM mission_questions q
       ORDER BY q.id LIMIT ?`
    )
    .bind(round.id, MISSION.QUESTIONS_PER_ROUND)
    .all();

  const answered = questions.filter((q) => q.my_answer).length;

  return c.json({
    round,
    questions,
    progress: { answered, total: MISSION.QUESTIONS_PER_ROUND },
  });
});

// ---- 답변 제출 ----
missions.post('/answer', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const { roundId, questionId, answer } = await c.req.json<{
    roundId: string;
    questionId: string;
    answer: string;
  }>();
  if (!answer?.trim()) return c.json({ error: 'empty_answer' }, 400);

  const round = await c.env.DOLDAM_DB
    .prepare(
      'SELECT id, expires_at, completed_at FROM mission_rounds WHERE id = ? AND user_id = ?'
    )
    .bind(roundId, user.id)
    .first<{ expires_at: number; completed_at: number | null }>();
  if (!round) return c.json({ error: 'round_not_found' }, 404);
  if (round.completed_at) return c.json({ error: 'round_already_completed' }, 400);
  if (round.expires_at < Date.now()) return c.json({ error: 'round_expired' }, 400);

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT OR REPLACE INTO mission_answers (id, user_id, question_id, round_id, answer, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), user.id, questionId, roundId, answer.trim(), Date.now())
    .run();

  const count = await c.env.DOLDAM_DB
    .prepare('SELECT COUNT(*) AS n FROM mission_answers WHERE round_id = ?')
    .bind(roundId)
    .first<{ n: number }>();

  let rewarded = false;
  if ((count?.n ?? 0) >= MISSION.QUESTIONS_PER_ROUND) {
    await c.env.DOLDAM_DB
      .prepare(
        'UPDATE mission_rounds SET completed_at = ?, rewarded = 1 WHERE id = ? AND rewarded = 0'
      )
      .bind(Date.now(), roundId)
      .run();
    const r = await awardPoints(c.env, user.id, POINTS.REWARD_MISSION_COMPLETE, 'mission_complete');
    rewarded = r.ok;
  }

  return c.json({ ok: true, answered: count?.n ?? 0, rewarded });
});

export default missions;
