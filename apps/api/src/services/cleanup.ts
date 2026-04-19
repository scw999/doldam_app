import type { Env } from '../types';

// 만료된 포인트 원장 정리 — 단순 제거로는 음수 밸런스 계산이 꼬이므로,
// 만료 라인을 그대로 두되 쿼리에서 expires_at > now 조건으로 이미 필터됨.
// 대신 아주 오래된(만료 + 180일) 원장은 물리 삭제해서 테이블을 가볍게.
export async function cleanupExpiredPoints(env: Env): Promise<void> {
  const cutoff = Date.now() - 180 * 86400 * 1000;
  const { meta } = await env.DOLDAM_DB
    .prepare('DELETE FROM points_ledger WHERE expires_at < ?')
    .bind(cutoff).run();
  console.log('[cleanup] points pruned', meta.changes);
}

// 만료된 채팅방 → status='expired' (실제 삭제는 Durable Object에서)
export async function expireRooms(env: Env): Promise<void> {
  const now = Date.now();
  const { meta } = await env.DOLDAM_DB
    .prepare(`UPDATE rooms SET status = 'expired' WHERE expires_at < ? AND status = 'active'`)
    .bind(now).run();
  console.log('[cleanup] rooms expired', meta.changes);
}
