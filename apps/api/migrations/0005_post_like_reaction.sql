-- post_likes에 reaction 인덱스 저장 (0=공감돼요, 1=안아줄게요, 2=힘내요, 3=웃겨요)
ALTER TABLE post_likes ADD COLUMN reaction INTEGER NOT NULL DEFAULT 0;
