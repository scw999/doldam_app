-- vote_responses.choice의 CHECK 제약(agree/disagree만 허용)을 제거해 다지선다 지원
CREATE TABLE vote_responses_new (
  vote_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  choice     TEXT NOT NULL,
  gender     TEXT NOT NULL CHECK (gender IN ('M', 'F')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (vote_id, user_id)
);

INSERT INTO vote_responses_new SELECT * FROM vote_responses;
DROP TABLE vote_responses;
ALTER TABLE vote_responses_new RENAME TO vote_responses;

CREATE INDEX IF NOT EXISTS idx_vr_vote_gender ON vote_responses(vote_id, gender);
