import type { Env } from '../types';
import { POINTS } from '../utils/constants';

// 포인트 종류
//  - free: 무상(적립·이벤트). 30일 만료, 일일 적립 캡 적용.
//  - paid: 유상(결제 충전). 5년 만료, 캡 미적용.
export type PointKind = 'free' | 'paid';

// 만료되지 않은 잔액 = 살아있는 적립 lot 의 remaining 합
export async function getBalance(env: Env, userId: string): Promise<number> {
  const now = Date.now();
  const row = await env.DOLDAM_DB
    .prepare(
      `SELECT COALESCE(SUM(remaining), 0) AS b FROM points_ledger
       WHERE user_id = ? AND amount > 0 AND remaining > 0 AND expires_at > ?`
    )
    .bind(userId, now)
    .first<{ b: number }>();
  return row?.b ?? 0;
}

export async function awardPoints(
  env: Env,
  userId: string,
  amount: number,
  reason: string,
  kind: PointKind = 'free'
): Promise<{ ok: boolean; reason?: string }> {
  const now = Date.now();
  const ttlDays = kind === 'paid' ? POINTS.PAID_EXPIRY_DAYS : POINTS.FREE_EXPIRY_DAYS;
  const expiresAt = now + ttlDays * 86400 * 1000;

  // 일일 캡은 무상 적립에만 적용 (유상 충전은 캡 무시)
  if (kind === 'free') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayRow = await env.DOLDAM_DB
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS n FROM points_ledger
         WHERE user_id = ? AND kind = 'free' AND amount > 0 AND created_at >= ?`
      )
      .bind(userId, startOfDay.getTime())
      .first<{ n: number }>();

    if ((todayRow?.n ?? 0) + amount > POINTS.DAILY_CAP) {
      return { ok: false, reason: 'daily_cap_exceeded' };
    }
  }

  // 적립 lot: remaining = amount 로 시작
  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at, kind, remaining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, amount, reason, now, expiresAt, kind, amount)
    .run();

  return { ok: true };
}

export async function spendPoints(
  env: Env,
  userId: string,
  amount: number,
  reason: string
): Promise<{ ok: boolean; reason?: string }> {
  const now = Date.now();

  // 소비 후보 lot: 무상 먼저(만료 임박 우선) → 유상 순서
  const { results: lots } = await env.DOLDAM_DB
    .prepare(
      `SELECT id, remaining FROM points_ledger
       WHERE user_id = ? AND amount > 0 AND remaining > 0 AND expires_at > ?
       ORDER BY (kind = 'paid') ASC, expires_at ASC, created_at ASC`
    )
    .bind(userId, now)
    .all<{ id: string; remaining: number }>();

  const total = lots.reduce((s, l) => s + l.remaining, 0);
  if (total < amount) return { ok: false, reason: 'insufficient_balance' };

  // FIFO 차감: 각 lot 의 remaining 을 깎아 나감
  let toSpend = amount;
  const stmts = [];
  for (const lot of lots) {
    if (toSpend <= 0) break;
    const take = Math.min(lot.remaining, toSpend);
    stmts.push(
      env.DOLDAM_DB
        .prepare('UPDATE points_ledger SET remaining = remaining - ? WHERE id = ?')
        .bind(take, lot.id)
    );
    toSpend -= take;
  }

  // 사용 내역 기록 (history 표시용 — amount<0, remaining=0 이라 잔액 계산엔 미반영)
  stmts.push(
    env.DOLDAM_DB
      .prepare(
        `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at, kind, remaining)
         VALUES (?, ?, ?, ?, ?, ?, 'spend', 0)`
      )
      .bind(crypto.randomUUID(), userId, -amount, reason, now, now)
  );

  await env.DOLDAM_DB.batch(stmts);
  return { ok: true };
}
