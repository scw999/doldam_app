CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id     TEXT PRIMARY KEY,
  comment     INTEGER NOT NULL DEFAULT 1,
  reply       INTEGER NOT NULL DEFAULT 1,
  hot_vote    INTEGER NOT NULL DEFAULT 1,
  chat        INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_notification_mutes (
  user_id  TEXT NOT NULL,
  room_id  TEXT NOT NULL,
  PRIMARY KEY (user_id, room_id)
);
