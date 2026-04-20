ALTER TABLE moods ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE mood_likes (
  mood_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (mood_id, user_id)
);
