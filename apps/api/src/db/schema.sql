-- 돌담 D1 스키마
-- 적용: wrangler d1 execute DOLDAM_DB --local --file=src/db/schema.sql

-- ===== 유저 =====
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  phone_hash    TEXT UNIQUE,                 -- 휴대폰 번호 SHA-256 해시 (식별용)
  nickname      TEXT NOT NULL,
  gender        TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  age_range     TEXT NOT NULL,               -- '20s','30s','40s','50s+'
  region        TEXT NOT NULL,               -- '서울','경기' 등
  -- 유료 프로필 항목 (unlock 필요)
  job           TEXT,                         -- 직업 카테고리
  has_kids      INTEGER,                      -- 0/1
  intro         TEXT,                         -- 자기소개
  interests     TEXT,                         -- 쉼표 구분
  verified      INTEGER NOT NULL DEFAULT 0,  -- OCR 검증 플래그
  banned        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_hash);

-- ===== 본인인증 / OCR 이력 =====
CREATE TABLE IF NOT EXISTS auth_verifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('phone', 'certificate')),
  pii_hash      TEXT,                        -- 이름/생년월일 해시만
  status        TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  detail        TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_av_user ON auth_verifications(user_id);

-- ===== 게시판 =====
CREATE TABLE IF NOT EXISTS posts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL,               -- free/dating/kids/money/legal/men_only/women_only
  view_count    INTEGER NOT NULL DEFAULT 0,
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_posts_cat_created ON posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  post_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  content       TEXT NOT NULL,
  parent_id     TEXT,
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

-- ===== 찬반투표 =====
CREATE TABLE IF NOT EXISTS votes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,               -- 출제자
  question      TEXT NOT NULL,
  description   TEXT,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at DESC);

CREATE TABLE IF NOT EXISTS vote_responses (
  vote_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  choice        TEXT NOT NULL CHECK (choice IN ('agree', 'disagree')),
  gender        TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (vote_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_vr_vote_gender ON vote_responses(vote_id, gender);

-- ===== 채팅방 =====
CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  theme         TEXT,                         -- '40대 재혼' 등 자동 테마
  gender_mix    TEXT NOT NULL,                -- 'mixed','men_only','women_only'
  kind          TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'themed' (자동 개설)
  source_ref    TEXT,                         -- themed 경우 post_id / vote_id
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,             -- 3일 후 자동 폭파
  status        TEXT NOT NULL DEFAULT 'active' -- active/expired/revived
);
CREATE INDEX IF NOT EXISTS idx_rooms_expires ON rooms(expires_at);

CREATE TABLE IF NOT EXISTS room_members (
  room_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rm_user ON room_members(user_id);

CREATE TABLE IF NOT EXISTS room_keep_votes (
  room_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  keep          INTEGER NOT NULL,             -- 1 = 유지, 0 = 폭파
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

-- ===== 포인트 원장 =====
CREATE TABLE IF NOT EXISTS points_ledger (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  amount        INTEGER NOT NULL,             -- +적립 / -소비
  reason        TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL              -- 적립 시 + 30일
);
CREATE INDEX IF NOT EXISTS idx_pl_user_exp ON points_ledger(user_id, expires_at);

-- ===== Q&A 미션 =====
CREATE TABLE IF NOT EXISTS mission_questions (
  id            TEXT PRIMARY KEY,
  question      TEXT NOT NULL,
  category      TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_answers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  question_id   TEXT NOT NULL,
  round_id      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ma_user ON mission_answers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ma_round ON mission_answers(round_id);

CREATE TABLE IF NOT EXISTS mission_rounds (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  started_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,     -- started_at + 3일
  completed_at  INTEGER,              -- 10문항 완료 시
  rewarded      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mr_user ON mission_rounds(user_id, started_at DESC);

-- ===== 감정 타임라인 =====
CREATE TABLE IF NOT EXISTS moods (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  mood          TEXT NOT NULL,                -- 'happy','sad','angry' 등
  note          TEXT,
  visibility    TEXT NOT NULL CHECK (visibility IN ('private', 'friends', 'public')),
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moods_user ON moods(user_id, created_at DESC);

-- ===== 프로필 열람 =====
CREATE TABLE IF NOT EXISTS profile_unlocks (
  unlocker_id   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  field         TEXT NOT NULL,                -- 'age','region','job' 등
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (unlocker_id, target_id, field)
);

-- ===== 신고 =====
CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  reporter_id   TEXT NOT NULL,
  target_type   TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user', 'message')),
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    INTEGER NOT NULL,
  resolved_at   INTEGER
);

-- ===== 결제 =====
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  product_id    TEXT NOT NULL,
  receipt       TEXT NOT NULL,
  status        TEXT NOT NULL,                -- pending/verified/refunded/failed
  created_at    INTEGER NOT NULL,
  verified_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);

-- ===== 푸시 토큰 =====
CREATE TABLE IF NOT EXISTS push_tokens (
  user_id       TEXT NOT NULL,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL,                -- ios/android
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_tokens(user_id);

-- ===== 알림 이력 =====
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  data          TEXT,                         -- JSON
  read_at       INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
