import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { spendPoints } from '../services/points';
import { enqueueForMatch, cancelMatch } from '../services/matching';
import { POINTS, ROOM } from '../utils/constants';

type Vars = { user: AuthedUser };
const rooms = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 내 방 목록 ----
rooms.get('/mine', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT r.id, r.theme, r.gender_mix, r.kind, r.created_at, r.expires_at, r.status,
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS member_count
       FROM rooms r JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.user_id = ? AND r.status IN ('active', 'revived')
       ORDER BY r.created_at DESC`
    )
    .bind(user.id)
    .all();
  return c.json({ items: results });
});

// ---- 공개 테마방 목록 ----
rooms.get('/themed', requireAuth, async (c) => {
  const { results } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT r.id, r.theme, r.gender_mix, r.source_ref, r.created_at, r.expires_at,
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS member_count
       FROM rooms r
       WHERE r.kind = 'themed' AND r.status = 'active' AND r.expires_at > ?
       ORDER BY r.created_at DESC LIMIT 30`
    )
    .bind(Date.now())
    .all();
  return c.json({ items: results });
});

// ---- 테마방 가입 ----
rooms.post('/themed/:id/join', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const room = await c.env.DOLDAM_DB
    .prepare(`SELECT kind, gender_mix, expires_at FROM rooms WHERE id = ? AND status = 'active'`)
    .bind(id)
    .first<{ kind: string; gender_mix: string; expires_at: number }>();
  if (!room || room.kind !== 'themed') return c.json({ error: 'not_themed' }, 400);
  if (room.expires_at < Date.now()) return c.json({ error: 'expired' }, 400);
  if (room.gender_mix === 'men_only' && user.gender !== 'M') return c.json({ error: 'forbidden' }, 403);
  if (room.gender_mix === 'women_only' && user.gender !== 'F') return c.json({ error: 'forbidden' }, 403);

  const existing = await c.env.DOLDAM_DB
    .prepare(`SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?`)
    .bind(id, user.id).first();
  if (existing) return c.json({ ok: true, alreadyJoined: true });

  // 인원 제한 체크
  const count = await c.env.DOLDAM_DB
    .prepare(`SELECT COUNT(*) AS n FROM room_members WHERE room_id = ?`)
    .bind(id).first<{ n: number }>();
  if ((count?.n ?? 0) >= ROOM.MAX_MEMBERS) return c.json({ error: 'room_full' }, 400);

  await c.env.DOLDAM_DB
    .prepare(`INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)`)
    .bind(id, user.id, Date.now()).run();

  return c.json({ ok: true });
});

// ---- 방 상세 ----
rooms.get('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const member = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!member) return c.json({ error: 'not_a_member' }, 403);

  const room = await c.env.DOLDAM_DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first();
  if (!room) return c.json({ error: 'not_found' }, 404);

  const { results: members } = await c.env.DOLDAM_DB
    .prepare(
      `SELECT u.id, u.nickname, u.gender, u.age_range
       FROM room_members rm JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ?`
    )
    .bind(id).all();

  return c.json({ ...room, members });
});

// ---- 매칭 신청 ----
rooms.post('/match', requireAuth, async (c) => {
  const user = c.get('user');
  await enqueueForMatch(c.env, user.id);
  await c.env.DOLDAM_QUEUE.send({ type: 'matching', userId: user.id });
  return c.json({ ok: true, queued: true });
});

// ---- 매칭 취소 ----
rooms.post('/match/cancel', requireAuth, async (c) => {
  const user = c.get('user');
  await cancelMatch(c.env, user.id);
  return c.json({ ok: true });
});

// ---- WebSocket 업그레이드 passthrough ----
rooms.get('/:id/ws', async (c) => {
  const id = c.req.param('id');
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'websocket_required' }, 426);
  }
  const doId = c.env.CHAT_ROOM.idFromName(id);
  const stub = c.env.CHAT_ROOM.get(doId);
  const url = new URL(c.req.url);
  url.searchParams.set('roomId', id);
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// ---- 최근 메시지 ----
rooms.get('/:id/history', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const member = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!member) return c.json({ error: 'not_a_member' }, 403);

  const doId = c.env.CHAT_ROOM.idFromName(id);
  const stub = c.env.CHAT_ROOM.get(doId);
  return stub.fetch(new Request(new URL(`/history`, c.req.url).toString()));
});

// ---- 방 유지 투표 ----
rooms.post('/:id/keep-vote', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { keep } = await c.req.json<{ keep: boolean }>();

  const member = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!member) return c.json({ error: 'not_a_member' }, 403);

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT OR REPLACE INTO room_keep_votes (room_id, user_id, keep, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, user.id, keep ? 1 : 0, Date.now()).run();

  const agg = await c.env.DOLDAM_DB
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM room_keep_votes WHERE room_id = ? AND keep = 1) AS yes,
         (SELECT COUNT(*) FROM room_members WHERE room_id = ?) AS total`
    )
    .bind(id, id).first<{ yes: number; total: number }>();

  if (agg && agg.total > 0 && agg.yes / agg.total >= ROOM.KEEP_VOTE_THRESHOLD) {
    const newExpiry = Date.now() + ROOM.LIFESPAN_HOURS * 3600 * 1000;
    await c.env.DOLDAM_DB
      .prepare(`UPDATE rooms SET expires_at = ?, status = 'active' WHERE id = ?`)
      .bind(newExpiry, id).run();
    return c.json({ ok: true, kept: true, newExpiry });
  }

  return c.json({ ok: true, kept: false, yes: agg?.yes ?? 0, total: agg?.total ?? 0 });
});

// ---- 부활 ----
rooms.post('/:id/revive', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const member = await c.env.DOLDAM_DB
    .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!member) return c.json({ error: 'not_a_member' }, 403);

  const room = await c.env.DOLDAM_DB
    .prepare(`SELECT status FROM rooms WHERE id = ?`)
    .bind(id).first<{ status: string }>();
  if (!room) return c.json({ error: 'not_found' }, 404);
  if (room.status === 'active') return c.json({ error: 'already_active' }, 400);

  const spent = await spendPoints(c.env, user.id, POINTS.COST_REVIVE_ROOM, 'room_revive');
  if (!spent.ok) return c.json({ error: spent.reason ?? 'cannot_spend' }, 400);

  const newExpiry = Date.now() + ROOM.LIFESPAN_HOURS * 3600 * 1000;
  await c.env.DOLDAM_DB
    .prepare(`UPDATE rooms SET status = 'revived', expires_at = ? WHERE id = ?`)
    .bind(newExpiry, id).run();

  return c.json({ ok: true, newExpiry });
});

export default rooms;
