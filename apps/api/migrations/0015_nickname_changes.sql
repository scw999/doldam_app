-- 닉네임 변경 이력 — 월 3회 제한 용
CREATE TABLE IF NOT EXISTS nickname_changes (
  user_id     TEXT NOT NULL,
  old_nick    TEXT NOT NULL,
  new_nick    TEXT NOT NULL,
  changed_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, changed_at)
);
CREATE INDEX IF NOT EXISTS idx_nickname_changes_user_time ON nickname_changes(user_id, changed_at DESC);
