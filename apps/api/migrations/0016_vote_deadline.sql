-- 채팅방 유지/폭파 투표 결정 시각
ALTER TABLE rooms ADD COLUMN vote_deadline INTEGER;
ALTER TABLE rooms ADD COLUMN vote_notif_10 INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN vote_notif_5 INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN vote_notif_1 INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN vote_resolved INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_rooms_vote_deadline ON rooms(vote_deadline) WHERE vote_resolved = 0;
