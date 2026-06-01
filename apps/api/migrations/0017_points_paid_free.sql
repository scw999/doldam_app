-- 유상/무상 포인트 구분 + FIFO 잔액(remaining) + 만료 예정 알림 플래그
-- 무상(free): 30일 만료 · 일일 캡 적용 / 유상(paid): 5년 만료 · 캡 미적용
-- 소비는 무상 → 유상 순서로 FIFO 차감 (잔액 = SUM(remaining))

ALTER TABLE points_ledger ADD COLUMN kind TEXT NOT NULL DEFAULT 'free';
ALTER TABLE points_ledger ADD COLUMN remaining INTEGER NOT NULL DEFAULT 0;
ALTER TABLE points_ledger ADD COLUMN expiry_notified INTEGER NOT NULL DEFAULT 0;

-- 종류 backfill: 결제 적립분 → paid, 사용(음수) → spend, 그 외 적립 → free(기본값)
UPDATE points_ledger SET kind = 'paid'  WHERE amount > 0 AND reason LIKE 'iap:%';
UPDATE points_ledger SET kind = 'spend' WHERE amount < 0;

-- remaining 초기화: 적립 lot 은 일단 amount 만큼, 사용/0 이하 행은 0
UPDATE points_ledger SET remaining = amount WHERE amount > 0;
UPDATE points_ledger SET remaining = 0      WHERE amount <= 0;

-- 과거 '미만료 사용액'을 오래된 lot 부터 차감해 기존 잔액과 일치시킴.
--  - consumed: 사용자별, 아직 만료 안 된 음수(사용) 합
--  - lots: 사용자별 미만료 적립 lot 을 만료 임박순 누적합(cum)
--  - 각 lot 생존량 = MIN(amount, MAX(0, cum - consumed))
WITH
now_ms AS (SELECT CAST(unixepoch() AS INTEGER) * 1000 AS n),
consumed AS (
  SELECT pl.user_id, COALESCE(SUM(-pl.amount), 0) AS used
  FROM points_ledger pl, now_ms
  WHERE pl.amount < 0 AND pl.expires_at > now_ms.n
  GROUP BY pl.user_id
),
lots AS (
  SELECT pl.id, pl.user_id, pl.amount,
    SUM(pl.amount) OVER (
      PARTITION BY pl.user_id
      ORDER BY pl.expires_at ASC, pl.created_at ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cum
  FROM points_ledger pl, now_ms
  WHERE pl.amount > 0 AND pl.expires_at > now_ms.n
),
calc AS (
  SELECT l.id,
    MIN(l.amount, MAX(0, l.cum - COALESCE(c.used, 0))) AS new_remaining
  FROM lots l
  LEFT JOIN consumed c ON c.user_id = l.user_id
)
UPDATE points_ledger
SET remaining = (SELECT new_remaining FROM calc WHERE calc.id = points_ledger.id)
WHERE id IN (SELECT id FROM calc);

CREATE INDEX IF NOT EXISTS idx_pl_balance ON points_ledger(user_id, kind, expires_at) WHERE amount > 0 AND remaining > 0;
