DELETE FROM reports WHERE id IN ('test-report-1','test-report-2','test-report-3','test-r1','test-r2','test-r3');

INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES
  ('test-r1','user-f1','post','post-01','욕설/혐오 발언','pending',1745100000000),
  ('test-r2','user-m2','comment','cmt-01','스팸/홍보','pending',1745110000000),
  ('test-r3','user-f2','post','post-05','개인정보 포함','pending',1745120000000);

UPDATE posts SET report_count = 2 WHERE id = 'post-01';
