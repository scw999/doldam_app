-- 사용자 차단 — 양방향(서로 안 보임)
-- 앱스토어 심사 필수: 사용자 콘텐츠 앱은 신고 + 차단 둘 다 제공해야 함.

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id  TEXT NOT NULL,                -- 차단한 사람
  blocked_id  TEXT NOT NULL,                -- 차단당한 사람
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- 조회 인덱스: '내가 차단한 사람들' (목록 화면, 필터링)
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id, created_at DESC);

-- 역방향 인덱스: '나를 차단한 사람들' (양방향 필터링용)
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);
