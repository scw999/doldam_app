// 양방향 차단 필터링 — 콘텐츠 조회 시 적용
// 사용: WHERE ${blockFilterSql('p.user_id')} → .bind(..., me.id, me.id)
//      또는 SQL에서 한 번만 user_id를 가질 때는 SELECT 결과를 안전하게 거름.

export function blockFilterSql(userIdColumn: string): string {
  return `(${userIdColumn} NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)
     AND ${userIdColumn} NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ?))`;
}

// 특정 두 유저가 양방향 차단 관계인지 — 프로필/글 단건 조회용
export async function isBlocked(
  db: D1Database,
  meId: string,
  otherId: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS x FROM user_blocks
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
       LIMIT 1`
    )
    .bind(meId, otherId, otherId, meId)
    .first();
  return !!row;
}
