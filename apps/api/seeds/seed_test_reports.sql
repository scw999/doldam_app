INSERT OR IGNORE INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at)
VALUES
  ('test-report-1', 'user-f1', 'post', 'post-1', '욕설/혐오 발언', 'pending', 1745100000000),
  ('test-report-2', 'user-m2', 'comment', 'dc1836c9-e389-4ef9-8834-08b5a0f604cb', '스팸/홍보', 'pending', 1745110000000),
  ('test-report-3', 'user-f2', 'post', 'post-5', '개인정보 포함', 'pending', 1745120000000);

UPDATE posts SET report_count = 2 WHERE id = 'post-1';
