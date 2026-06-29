-- 0019에서 추가했던 empathy_count/funny_count 비정규화 컬럼 제거.
-- 인기글 기준이 "공감+웃겨요"에서 "4종 반응 전체(=like_count)"로 바뀌었기 때문에
-- 별도 분리 집계가 더 이상 필요 없음. like_count로 충분.

ALTER TABLE posts DROP COLUMN empathy_count;
ALTER TABLE posts DROP COLUMN funny_count;
