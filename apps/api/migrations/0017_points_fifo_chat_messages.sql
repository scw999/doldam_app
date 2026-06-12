-- 포인트 FIFO 만료 + 채팅 메시지 D1 보관 + 신고 중복 방지

-- 1) 포인트 원장에 lot 잔여량 컬럼 추가
--    적립(+) 행: remaining = 아직 소진되지 않은 양 (FIFO로 차감)
--    소비(-) 행: remaining = 0 (이력용으로만 보관, 잔액 계산에서 제외)
--    CHECK 제약으로 동시 차감 경합 시 초과 인출이 DB 레벨에서 거부됨
ALTER TABLE points_ledger ADD COLUMN remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0);

-- 기존 데이터 백필: 유저별 총 소비량을 오래된 적립분부터 소진한 것으로 간주
UPDATE points_ledger
SET remaining = MAX(0, MIN(
  points_ledger.amount,
  (SELECT COALESCE(SUM(p2.amount), 0) FROM points_ledger p2
   WHERE p2.user_id = points_ledger.user_id AND p2.amount > 0
     AND (p2.created_at < points_ledger.created_at
          OR (p2.created_at = points_ledger.created_at AND p2.id <= points_ledger.id)))
  - (SELECT COALESCE(SUM(-p3.amount), 0) FROM points_ledger p3
     WHERE p3.user_id = points_ledger.user_id AND p3.amount < 0)
))
WHERE amount > 0;

CREATE INDEX IF NOT EXISTS idx_pl_user_lots ON points_ledger(user_id, created_at) WHERE amount > 0;

-- 2) 채팅 메시지 D1 보관 (DO storage 유실 대비 이중화, 90일 보관 후 정리)
CREATE TABLE IF NOT EXISTS chat_messages (
  id        TEXT PRIMARY KEY,
  room_id   TEXT NOT NULL,
  user_id   TEXT NOT NULL,            -- 'system' = 아이스브레이커 질문
  nickname  TEXT NOT NULL,
  text      TEXT NOT NULL,
  vote_id   TEXT,
  reactions TEXT,                     -- JSON: { emoji: [userId...] }
  ts        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_room_ts ON chat_messages(room_id, ts);

-- 3) 신고 중복 방지 (동일인이 같은 대상 중복 신고 → report_count 중복 증가 차단)
DELETE FROM reports WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM reports GROUP BY reporter_id, target_type, target_id
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique ON reports(reporter_id, target_type, target_id);
