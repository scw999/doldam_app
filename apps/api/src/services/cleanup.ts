import type { Env } from '../types';
import { POINTS } from '../utils/constants';
import { sendPush } from './push';

// 만료된 포인트 원장 정리 — 만료분은 remaining/만료일 조건으로 잔액에서 이미 빠지므로,
// 아주 오래된(만료 + 180일) 원장만 물리 삭제해서 테이블을 가볍게.
export async function cleanupExpiredPoints(env: Env): Promise<void> {
  const cutoff = Date.now() - 180 * 86400 * 1000;
  const { meta } = await env.DOLDAM_DB
    .prepare('DELETE FROM points_ledger WHERE expires_at < ?')
    .bind(cutoff).run();
  console.log('[cleanup] points pruned', meta.changes);
}

// 무상 포인트 만료 N일 전 1회 알림. expiry_notified 플래그로 중복 방지.
export async function notifyExpiringFreePoints(env: Env): Promise<void> {
  const now = Date.now();
  const soon = now + POINTS.EXPIRY_NOTIFY_DAYS * 86400 * 1000;

  // 곧 만료될 무상 lot 을 사용자별로 합산 (아직 알림 안 보낸 것)
  const { results } = await env.DOLDAM_DB
    .prepare(
      `SELECT user_id, COALESCE(SUM(remaining), 0) AS pts, MIN(expires_at) AS earliest
       FROM points_ledger
       WHERE kind = 'free' AND amount > 0 AND remaining > 0 AND expiry_notified = 0
         AND expires_at > ? AND expires_at <= ?
       GROUP BY user_id`
    )
    .bind(now, soon)
    .all<{ user_id: string; pts: number; earliest: number }>();

  for (const r of results) {
    if (r.pts <= 0) continue;
    const days = Math.max(1, Math.ceil((r.earliest - now) / (86400 * 1000)));
    await sendPush(
      env,
      r.user_id,
      '포인트 만료 예정',
      `${r.pts}P가 ${days}일 뒤 만료돼요. 만료 전에 사용해보세요!`,
      { type: 'points_expiry', points: r.pts }
    );
  }

  // 알림 보낸 lot 표시 (다음 주기 중복 발송 방지)
  const { meta } = await env.DOLDAM_DB
    .prepare(
      `UPDATE points_ledger SET expiry_notified = 1
       WHERE kind = 'free' AND amount > 0 AND remaining > 0 AND expiry_notified = 0
         AND expires_at > ? AND expires_at <= ?`
    )
    .bind(now, soon)
    .run();
  console.log('[cleanup] expiry notices sent', results.length, 'marked', meta.changes);
}

// 만료된 채팅방 → status='expired' (실제 삭제는 Durable Object에서)
export async function expireRooms(env: Env): Promise<void> {
  const now = Date.now();
  const { meta } = await env.DOLDAM_DB
    .prepare(`UPDATE rooms SET status = 'expired' WHERE expires_at < ? AND status = 'active'`)
    .bind(now).run();
  console.log('[cleanup] rooms expired', meta.changes);
}
