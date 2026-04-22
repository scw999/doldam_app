-- 성능 향상을 위한 누락된 인덱스 추가

-- 댓글: 게시글별 조회 (ASC 정렬), 사용자별 조회
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id, created_at DESC);

-- 알림: 사용자별 최신순 조회 (알림 목록, 안읽은 수)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- 푸시 토큰: 사용자별 조회 (sendPush 호출마다 실행)
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

-- 기분 타임라인: 사용자별 최신순
CREATE INDEX IF NOT EXISTS idx_moods_user_created ON moods(user_id, created_at DESC);

-- 신고: 대상별 조회
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id, target_type);

-- 미션 답변: 사용자+라운드 조회
CREATE INDEX IF NOT EXISTS idx_mission_answers_user_round ON mission_answers(user_id, round_id);

-- 투표 응답: 사용자별 (내 투표 이력)
CREATE INDEX IF NOT EXISTS idx_vote_responses_user ON vote_responses(user_id);

-- 게시글: 삭제되지 않은 글 + 카테고리+날짜 복합 (이미 있는 경우 무시)
CREATE INDEX IF NOT EXISTS idx_posts_cat_created ON posts(category, created_at DESC);
