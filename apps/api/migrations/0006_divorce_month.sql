-- 이혼 월 추가 (연도만 있던 것에서 월까지 세분화)
ALTER TABLE users ADD COLUMN divorce_month INTEGER DEFAULT NULL;

-- 기존 회원 중 이혼 연도가 있는 경우 랜덤 월 배정 (1~12)
UPDATE users SET divorce_month = (ABS(RANDOM()) % 12) + 1 WHERE divorce_year IS NOT NULL;
