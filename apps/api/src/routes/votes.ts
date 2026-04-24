import { Hono } from 'hono';
import type { Env, AuthedUser, Gender } from '../types';
import { requireAuth } from '../middleware/auth';
import { verifyJwt } from '../utils/jwt';
import { moderate } from '../middleware/moderation';
import { awardPoints } from '../services/points';
import { buildVoteCardSvg } from '../services/shareCard';
import { sendPush } from '../services/push';
import { POINTS } from '../utils/constants';

const HOT_VOTE_THRESHOLD = 10;

type Vars = { user: AuthedUser };
const votes = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 목록 ----
votes.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
  const gender = c.req.query('gender') as 'M' | 'F' | undefined;

  // JOIN + GROUP BY 로 N+1 서브쿼리 제거 (30개 조회 시 90쿼리 → 1쿼리)
  // 방 전용 투표(room_id IS NOT NULL)는 해당 채팅방에서만 보이므로 전역 목록에서 제외
  const sql = gender
    ? `SELECT v.id, v.question, v.description, v.options, v.created_at, v.expires_at,
              u.nickname,
              COUNT(vr.vote_id) AS total,
              COALESCE(SUM(CASE WHEN vr.choice = 'agree' THEN 1 ELSE 0 END), 0) AS agree,
              COALESCE(SUM(CASE WHEN vr.choice = 'disagree' THEN 1 ELSE 0 END), 0) AS disagree
       FROM votes v JOIN users u ON u.id = v.user_id
       LEFT JOIN vote_responses vr ON vr.vote_id = v.id AND vr.gender = ?
       WHERE v.room_id IS NULL
       GROUP BY v.id, v.question, v.description, v.options, v.created_at, v.expires_at, u.nickname
       ORDER BY v.created_at DESC LIMIT ?`
    : `SELECT v.id, v.question, v.description, v.options, v.created_at, v.expires_at,
              u.nickname,
              COUNT(vr.vote_id) AS total,
              COALESCE(SUM(CASE WHEN vr.choice = 'agree' THEN 1 ELSE 0 END), 0) AS agree,
              COALESCE(SUM(CASE WHEN vr.choice = 'disagree' THEN 1 ELSE 0 END), 0) AS disagree
       FROM votes v JOIN users u ON u.id = v.user_id
       LEFT JOIN vote_responses vr ON vr.vote_id = v.id
       WHERE v.room_id IS NULL
       GROUP BY v.id, v.question, v.description, v.options, v.created_at, v.expires_at, u.nickname
       ORDER BY v.created_at DESC LIMIT ?`;

  const { results } = gender
    ? await c.env.DOLDAM_DB.prepare(sql).bind(gender, limit).all()
    : await c.env.DOLDAM_DB.prepare(sql).bind(limit).all();
  c.header('Cache-Control', 'no-store');
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

  // 피어 폴: options에 담긴 user_id를 닉네임으로 매핑해 반환
  let memberInfo: Record<string, { nickname: string; gender: string | null }> | null = null;
  if (vote.kind === 'peer_poll' && options && options.length > 0) {
    const placeholders = options.map(() => '?').join(',');
    const rows = await c.env.DOLDAM_DB
      .prepare(`SELECT id, nickname, gender FROM users WHERE id IN (${placeholders})`)
      .bind(...options).all<{ id: string; nickname: string; gender: string | null }>();
    memberInfo = {};
    for (const r of rows.results) memberInfo[r.id] = { nickname: r.nickname, gender: r.gender };
  }

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

  return c.json({ ...vote, options, counts, agree, disagree, total, myChoice, memberInfo });
});

// ---- 생성 ----
votes.post('/', requireAuth, moderate, async (c) => {
  const user = c.get('user');
  const { question, description, expiresAt, options, kind, roomId } = await c.req.json<{
    question: string; description?: string; expiresAt?: number;
    options?: string[]; kind?: 'normal' | 'peer_poll'; roomId?: string;
  }>();
  if (!question?.trim()) return c.json({ error: 'empty_question' }, 400);

  const voteKind = kind === 'peer_poll' ? 'peer_poll' : 'normal';

  // roomId 지정 시 방 멤버 여부 검증 (kind 무관)
  if (roomId) {
    const member = await c.env.DOLDAM_DB
      .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
      .bind(roomId, user.id).first();
    if (!member) return c.json({ error: 'not_a_member' }, 403);
  }

  // 피어 폴: roomId 필수 + options는 방 멤버 user_id여야 함
  if (voteKind === 'peer_poll') {
    if (!roomId) return c.json({ error: 'room_required' }, 400);
    if (!Array.isArray(options) || options.length < 2) return c.json({ error: 'invalid_options' }, 400);
    const placeholders = options.map(() => '?').join(',');
    const valid = await c.env.DOLDAM_DB
      .prepare(`SELECT user_id FROM room_members WHERE room_id = ? AND user_id IN (${placeholders})`)
      .bind(roomId, ...options).all<{ user_id: string }>();
    if (valid.results.length !== options.length) return c.json({ error: 'invalid_members' }, 400);
  }

  let optionsJson: string | null = null;
  if (Array.isArray(options) && options.length > 0) {
    const clean = options.map((o) => String(o).trim()).filter(Boolean);
    if (clean.length < 2 || clean.length > 8) return c.json({ error: 'invalid_options' }, 400);
    optionsJson = JSON.stringify(clean);
  }

  const id = crypto.randomUUID();
  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO votes (id, user_id, question, description, options, kind, room_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, question.trim(), description?.trim() ?? null, optionsJson, voteKind, roomId ?? null, Date.now(), expiresAt ?? null)
    .run();

  return c.json({ id });
});

// ---- 삭제 (작성자만) ----
votes.delete('/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT user_id, kind FROM votes WHERE id = ?').bind(id).first<{ user_id: string; kind: string | null }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);

  // 피어 폴은 응답이 있으면 삭제 불가 — 유료 '나를 뽑은 사람 보기' 데이터 보호
  if (row.kind === 'peer_poll') {
    const resp = await c.env.DOLDAM_DB
      .prepare('SELECT COUNT(*) AS n FROM vote_responses WHERE vote_id = ?').bind(id)
      .first<{ n: number }>();
    if ((resp?.n ?? 0) > 0) {
      return c.json({ error: 'peer_poll_has_responses' }, 403);
    }
  }

  // 응답 먼저 삭제 후 투표 삭제 (FK 없이도 고아 데이터 방지)
  await c.env.DOLDAM_DB
    .prepare('DELETE FROM vote_responses WHERE vote_id = ?').bind(id).run();
  await c.env.DOLDAM_DB
    .prepare('DELETE FROM votes WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
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

  // 피어 폴(멤버 투표) — 뽑힌 사람에게 알림
  const voteMeta = await c.env.DOLDAM_DB
    .prepare('SELECT kind, question FROM votes WHERE id = ?').bind(id)
    .first<{ kind: string; question: string }>();
  if (voteMeta?.kind === 'peer_poll' && choice !== user.id) {
    const targetExists = await c.env.DOLDAM_DB
      .prepare('SELECT 1 FROM users WHERE id = ? AND deleted_at IS NULL').bind(choice).first();
    if (targetExists) {
      c.executionCtx.waitUntil(
        sendPush(
          c.env,
          choice,
          '💘 누군가 당신을 뽑았어요',
          voteMeta.question.slice(0, 50),
          { voteId: id },
          'hot_vote' // 기존 카테고리 재사용
        ).catch(() => {})
      );
    }
  }

  // 첫 참여만 포인트 적립 + 핫 투표 알림
  if (!existing) {
    await awardPoints(c.env, user.id, POINTS.REWARD_VOTE_CAST, 'vote_cast');

    // 정확히 threshold번째 참여 시 투표 작성자에게 핫 알림
    const countRow = await c.env.DOLDAM_DB
      .prepare('SELECT COUNT(*) AS n FROM vote_responses WHERE vote_id = ?')
      .bind(id).first<{ n: number }>();
    if (countRow?.n === HOT_VOTE_THRESHOLD) {
      const voteRow = await c.env.DOLDAM_DB
        .prepare('SELECT user_id, question FROM votes WHERE id = ?')
        .bind(id).first<{ user_id: string; question: string }>();
      if (voteRow && voteRow.user_id !== user.id) {
        c.executionCtx.waitUntil(
          sendPush(c.env, voteRow.user_id, '🔥 내 투표가 핫해요!',
            `"${voteRow.question.slice(0, 40)}" 참여자 ${HOT_VOTE_THRESHOLD}명 돌파!`,
            { voteId: id }, 'hot_vote')
        );
      }
    }
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
