-- 피어 폴링 (TBH 스타일) 지원
-- 채팅방 멤버를 선택지로 하는 투표: 가장 잘생길 것 같은 사람 등
ALTER TABLE votes ADD COLUMN kind TEXT DEFAULT 'normal';
ALTER TABLE votes ADD COLUMN room_id TEXT;
CREATE INDEX IF NOT EXISTS idx_votes_room_id ON votes(room_id);
CREATE INDEX IF NOT EXISTS idx_votes_kind ON votes(kind);
