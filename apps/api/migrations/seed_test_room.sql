-- 테스트 채팅방 생성
INSERT OR IGNORE INTO rooms (id, theme, gender_mix, kind, created_at, expires_at, status)
VALUES (
  'test-room-001',
  '돌싱 이야기 테스트방',
  'mixed',
  'normal',
  1745100000000,
  9999999999999,
  'active'
);

-- 멤버 추가: 단단한사슴148, 용감한돌담934 + 더미 2남2녀
INSERT OR IGNORE INTO room_members (room_id, user_id, joined_at) VALUES
  ('test-room-001', '52b8d4b2-0a12-41f2-98c9-6e0f358a8ef1', 1745100000000),
  ('test-room-001', 'd3cc021c-ea63-4c09-a7b1-37cc856c15d2', 1745100001000),
  ('test-room-001', 'user-m1', 1745100002000),
  ('test-room-001', 'user-m2', 1745100003000),
  ('test-room-001', 'user-f1', 1745100004000),
  ('test-room-001', 'user-f2', 1745100005000);
