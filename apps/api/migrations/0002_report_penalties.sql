-- 신고 카운트 + 페널티 시스템
ALTER TABLE posts     ADD COLUMN report_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments  ADD COLUMN report_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users     ADD COLUMN warning_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users     ADD COLUMN muted_until    INTEGER;
