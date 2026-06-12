import type { Env } from '../types';

// 포인트 원장 정리 — 잔액은 적립 행의 remaining으로 계산하므로
// 만료/소진된 지 오래된(180일) 행은 물리 삭제해서 테이블을 가볍게.
export async function cleanupExpiredPoints(env: Env): Promise<void> {
  const cutoff = Date.now() - 180 * 86400 * 1000;
  const { meta } = await env.DOLDAM_DB
    .prepare('DELETE FROM points_ledger WHERE expires_at < ?')
    .bind(cutoff).run();
  console.log('[cleanup] points pruned', meta.changes);
}

// 만료된 채팅방 → status='expired' (revived 방도 연장된 expires_at이 지나면 만료)
export async function expireRooms(env: Env): Promise<void> {
  const now = Date.now();
  const { meta } = await env.DOLDAM_DB
    .prepare(`UPDATE rooms SET status = 'expired' WHERE expires_at < ? AND status IN ('active', 'revived')`)
    .bind(now).run();
  console.log('[cleanup] rooms expired', meta.changes);
}

// D1 보관 채팅 메시지 — 90일 경과분 삭제 (보관 정책)
export async function cleanupOldChatMessages(env: Env): Promise<void> {
  const cutoff = Date.now() - 90 * 86400 * 1000;
  const { meta } = await env.DOLDAM_DB
    .prepare('DELETE FROM chat_messages WHERE ts < ?')
    .bind(cutoff).run();
  if (meta.changes > 0) console.log('[cleanup] chat messages pruned', meta.changes);
}

// 검증되지 않고 방치된 증명서 원본 정리 — 업로드 후 7일 지난 R2 객체 삭제
// (승인/반려 시에는 즉시 삭제되지만, 가입을 중단한 경우 파일이 남는 것 방지)
export async function cleanupOrphanCertificates(env: Env): Promise<void> {
  const cutoff = Date.now() - 7 * 86400 * 1000;
  const list = await env.DOLDAM_R2.list({ prefix: 'cert/', limit: 500 });
  let deleted = 0;
  for (const obj of list.objects) {
    if (obj.uploaded.getTime() < cutoff) {
      await env.DOLDAM_R2.delete(obj.key).catch(() => {});
      deleted++;
    }
  }
  if (deleted > 0) console.log('[cleanup] orphan certificates deleted', deleted);
}
