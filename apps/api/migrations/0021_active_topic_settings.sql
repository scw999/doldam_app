-- "지금 가장 많이 나누는 이야기"(홈 화면 hot 정렬) 임계값 + 유효 기간 설정.
-- 인기글과 별개의 키 (active_topic_*) — 인기글은 누적/임계값, 활발한 토픽은 단기 트렌딩.
--
-- 동시에 더 이상 사용 안 하는 popular_window_days 키도 제거(인기글은 누적으로 변경됨).

INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('active_topic_min_comments',  '3', strftime('%s','now') * 1000),
  ('active_topic_min_reactions', '5', strftime('%s','now') * 1000),
  ('active_topic_window_days',   '3', strftime('%s','now') * 1000);

DELETE FROM app_settings WHERE key = 'popular_window_days';
