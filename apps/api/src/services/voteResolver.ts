import type { Env } from '../types';
import { sendPush } from './push';
import { ROOM } from '../utils/constants';

export async function resolveVotesTick(env: Env, ctx: ExecutionContext): Promise<void> {
  const now = Date.now();

  // 1) 마감 임박 알림
  const upcoming = await env.DOLDAM_DB
    .prepare(`SELECT id, vote_deadline, vote_notif_10, vote_notif_5, vote_notif_1
              FROM rooms
              WHERE vote_deadline IS NOT NULL AND vote_resolved = 0 AND status IN ('active', 'revived')
                AND vote_deadline > ? AND vote_deadline <= ?`)
    .bind(now, now + 11 * 60 * 1000)
    .all<{ id: string; vote_deadline: number; vote_notif_10: number; vote_notif_5: number; vote_notif_1: number }>();

  for (const r of upcoming.results) {
    const remaining = r.vote_deadline - now;
    if (remaining <= 10 * 60 * 1000 && remaining > 5 * 60 * 1000 && !r.vote_notif_10) {
      await notifyRoom(env, r.id, '⏰ 10분 후 투표 종료', '아직 투표 안 하셨으면 지금 참여해주세요!');
      await env.DOLDAM_DB.prepare('UPDATE rooms SET vote_notif_10 = 1 WHERE id = ?').bind(r.id).run();
    } else if (remaining <= 5 * 60 * 1000 && remaining > 1 * 60 * 1000 && !r.vote_notif_5) {
      await notifyRoom(env, r.id, '⏰ 5분 후 투표 종료', '방 유지/폭파 결정 임박!');
      await env.DOLDAM_DB.prepare('UPDATE rooms SET vote_notif_5 = 1 WHERE id = ?').bind(r.id).run();
    } else if (remaining <= 1 * 60 * 1000 && remaining > 0 && !r.vote_notif_1) {
      await notifyRoom(env, r.id, '⏰ 1분 후 투표 종료', '마지막 기회!');
      await env.DOLDAM_DB.prepare('UPDATE rooms SET vote_notif_1 = 1 WHERE id = ?').bind(r.id).run();
    }
  }

  // 2) 마감 지난 방 결과 처리
  const due = await env.DOLDAM_DB
    .prepare(`SELECT id FROM rooms
              WHERE vote_deadline IS NOT NULL AND vote_resolved = 0 AND vote_deadline <= ?`)
    .bind(now).all<{ id: string }>();

  for (const r of due.results) {
    ctx.waitUntil(resolveRoom(env, r.id));
  }
}

async function notifyRoom(env: Env, roomId: string, title: string, body: string): Promise<void> {
  const { results } = await env.DOLDAM_DB
    .prepare('SELECT user_id FROM room_members WHERE room_id = ?').bind(roomId)
    .all<{ user_id: string }>();
  for (const m of results) {
    await sendPush(env, m.user_id, title, body, { roomId }, 'chat').catch(() => {});
  }
}

async function resolveRoom(env: Env, roomId: string): Promise<void> {
  // 이미 resolved 된 방은 skip (race condition 방지)
  const row = await env.DOLDAM_DB
    .prepare('SELECT vote_resolved, vote_deadline FROM rooms WHERE id = ?').bind(roomId)
    .first<{ vote_resolved: number; vote_deadline: number }>();
  if (!row || row.vote_resolved) return;

  // 투표 집계 — room_keep_votes 테이블 사용 (keep INTEGER: 1=유지, 0=폭파)
  const { results: votes } = await env.DOLDAM_DB
    .prepare('SELECT user_id, keep FROM room_keep_votes WHERE room_id = ?').bind(roomId)
    .all<{ user_id: string; keep: number }>();

  const destroyCount = votes.filter((v) => v.keep === 0).length;
  const keepCount = votes.filter((v) => v.keep === 1).length;
  const voters = new Set(votes.map((v) => v.user_id));

  // 전체 멤버
  const { results: members } = await env.DOLDAM_DB
    .prepare('SELECT user_id FROM room_members WHERE room_id = ?').bind(roomId)
    .all<{ user_id: string }>();

  const kept = destroyCount === 0 && keepCount >= 2;

  // 결과 적용
  if (kept) {
    const newExpiry = Date.now() + ROOM.KEEP_EXTEND_HOURS * 3600 * 1000;
    await env.DOLDAM_DB
      .prepare("UPDATE rooms SET expires_at = ?, status = 'active', vote_resolved = 1 WHERE id = ?")
      .bind(newExpiry, roomId).run();
    // 투표 안 한 멤버 제거
    for (const m of members) {
      if (!voters.has(m.user_id)) {
        await env.DOLDAM_DB
          .prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?')
          .bind(roomId, m.user_id).run();
      }
    }
    // 유지 알림 — 유지 투표한 사람에게만
    for (const v of votes.filter((x) => x.keep === 1)) {
      await sendPush(env, v.user_id, '🎉 방이 유지됐어요!', '3일 더 이어집니다', { roomId }, 'chat').catch(() => {});
    }
  } else {
    // 폭파
    await env.DOLDAM_DB
      .prepare("UPDATE rooms SET status = 'expired', vote_resolved = 1 WHERE id = ?")
      .bind(roomId).run();
    for (const m of members) {
      await sendPush(env, m.user_id, '💥 방이 종료됐어요',
        destroyCount > 0 ? '누군가 폭파를 선택했어요' : '유지 투표가 부족했어요',
        { roomId }, 'chat').catch(() => {});
    }
  }
}
