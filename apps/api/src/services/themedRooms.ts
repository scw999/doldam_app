import type { Env } from '../types';
import { ROOM } from '../utils/constants';

// 임계치: 최근 24시간 내 댓글 10+ 또는 좋아요 20+ 게시글, 또는 참여자 50+ 투표
const POST_HOT_COMMENT = 10;
const POST_HOT_LIKE = 20;
const VOTE_HOT_TOTAL = 50;
const LOOKBACK_MS = 24 * 3600 * 1000;

export async function detectHotAndOpenRooms(env: Env): Promise<{ created: number }> {
  const since = Date.now() - LOOKBACK_MS;
  let created = 0;

  // 인기 게시글
  const { results: hotPosts } = await env.DOLDAM_DB
    .prepare(
      `SELECT id, title, category FROM posts
       WHERE deleted_at IS NULL AND created_at >= ?
         AND (comment_count >= ? OR like_count >= ?)
         AND NOT EXISTS (
           SELECT 1 FROM rooms r WHERE r.source_ref = posts.id AND r.kind = 'themed'
         )
       LIMIT 5`
    )
    .bind(since, POST_HOT_COMMENT, POST_HOT_LIKE)
    .all<{ id: string; title: string; category: string }>();

  for (const p of hotPosts) {
    await createThemedRoom(env, {
      sourceRef: p.id,
      theme: `🔥 ${p.title.slice(0, 30)}`,
      genderMix: p.category === 'men_only' ? 'men_only' : p.category === 'women_only' ? 'women_only' : 'mixed',
    });
    created++;
  }

  // 인기 투표
  const { results: hotVotes } = await env.DOLDAM_DB
    .prepare(
      `SELECT v.id, v.question,
              (SELECT COUNT(*) FROM vote_responses WHERE vote_id = v.id) AS total
       FROM votes v
       WHERE v.created_at >= ?
         AND NOT EXISTS (
           SELECT 1 FROM rooms r WHERE r.source_ref = v.id AND r.kind = 'themed'
         )
       ORDER BY total DESC LIMIT 5`
    )
    .bind(since)
    .all<{ id: string; question: string; total: number }>();

  for (const v of hotVotes) {
    if (v.total < VOTE_HOT_TOTAL) continue;
    await createThemedRoom(env, {
      sourceRef: v.id,
      theme: `💬 ${v.question.slice(0, 30)}`,
      genderMix: 'mixed',
    });
    created++;
  }

  return { created };
}

async function createThemedRoom(
  env: Env,
  input: { sourceRef: string; theme: string; genderMix: string }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + ROOM.LIFESPAN_HOURS * 3600 * 1000;

  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO rooms (id, theme, gender_mix, kind, source_ref, created_at, expires_at, status)
       VALUES (?, ?, ?, 'themed', ?, ?, ?, 'active')`
    )
    .bind(id, input.theme, input.genderMix, input.sourceRef, now, expiresAt)
    .run();

  console.log('[themed] created', id, input.theme);
  return id;
}
