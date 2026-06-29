-- 인기글 게시판: 공감/웃겨요 반응 카운트 비정규화 + 임계값 설정 저장소
--
-- posts.empathy_count, posts.funny_count
--   post_likes의 reaction=0(공감돼요), reaction=3(웃겨요)을 비정규화해서
--   인기글 후보 쿼리에서 매번 GROUP BY 하지 않도록 함.
--
-- app_settings
--   임계값(인기글 노출 기준 댓글/반응 수, 인기 기간 일)을 스태프 포탈에서
--   조절할 수 있도록 key-value로 저장. 코드 배포 없이 운영 중 조정 가능.

ALTER TABLE posts ADD COLUMN empathy_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN funny_count   INTEGER NOT NULL DEFAULT 0;

-- 기존 데이터 백필
UPDATE posts SET empathy_count = (
  SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = posts.id AND pl.reaction = 0
);
UPDATE posts SET funny_count = (
  SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = posts.id AND pl.reaction = 3
);

-- 인기글 후보 스캔용 인덱스 (최근 N일 + 미삭제만 필터링하므로 created_at 위주)
CREATE INDEX IF NOT EXISTS idx_posts_popular ON posts(created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('popular_min_comments',  '10', strftime('%s','now') * 1000),
  ('popular_min_reactions', '20', strftime('%s','now') * 1000),
  ('popular_window_days',   '7',  strftime('%s','now') * 1000);
