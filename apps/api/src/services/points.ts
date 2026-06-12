import type { Env } from '../types';
import { POINTS } from '../utils/constants';

const DAY_MS = 86400 * 1000;
const KST_OFFSET_MS = 9 * 3600 * 1000;

// 일일 캡 기준일은 한국시간 자정 (Workers는 UTC로 동작)
function startOfKstDay(now: number): number {
  return Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
}

// 캡 미적용 직접 적립 (구매 충전, 환불 보상 등)
export async function grantPoints(
  env: Env,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  const now = Date.now();
  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at, remaining)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, amount, reason, now, now + POINTS.EXPIRY_DAYS * DAY_MS, amount)
    .run();
}

export async function awardPoints(
  env: Env,
  userId: string,
  amount: number,
  reason: string
): Promise<{ ok: boolean; reason?: string }> {
  const now = Date.now();

  // 일일 캡 체크 (KST 자정 기준)
  const todayRow = await env.DOLDAM_DB
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS n FROM points_ledger
       WHERE user_id = ? AND amount > 0 AND created_at >= ?`
    )
    .bind(userId, startOfKstDay(now))
    .first<{ n: number }>();

  if ((todayRow?.n ?? 0) + amount > POINTS.DAILY_CAP) {
    return { ok: false, reason: 'daily_cap_exceeded' };
  }

  await grantPoints(env, userId, amount, reason);
  return { ok: true };
}

export async function getBalance(env: Env, userId: string): Promise<number> {
  const row = await env.DOLDAM_DB
    .prepare(
      `SELECT COALESCE(SUM(remaining), 0) AS b FROM points_ledger
       WHERE user_id = ? AND amount > 0 AND expires_at > ?`
    )
    .bind(userId, Date.now())
    .first<{ b: number }>();
  return row?.b ?? 0;
}

// FIFO 소진: 오래된 적립분(lot)부터 remaining을 차감.
// remaining CHECK(>= 0) 제약 + D1 batch(트랜잭션) 덕분에 동시 요청이
// 같은 lot을 초과 차감하면 batch 전체가 롤백됨 → 재시도.
export async function spendPoints(
  env: Env,
  userId: string,
  amount: number,
  reason: string
): Promise<{ ok: boolean; reason?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = Date.now();
    const { results: lots } = await env.DOLDAM_DB
      .prepare(
        `SELECT id, remaining FROM points_ledger
         WHERE user_id = ? AND amount > 0 AND remaining > 0 AND expires_at > ?
         ORDER BY created_at ASC, id ASC`
      )
      .bind(userId, now)
      .all<{ id: string; remaining: number }>();

    let left = amount;
    const plan: { id: string; take: number }[] = [];
    for (const lot of lots) {
      if (left <= 0) break;
      const take = Math.min(lot.remaining, left);
      plan.push({ id: lot.id, take });
      left -= take;
    }
    if (left > 0) return { ok: false, reason: 'insufficient_balance' };

    const stmts = plan.map((p) =>
      env.DOLDAM_DB
        .prepare('UPDATE points_ledger SET remaining = remaining - ? WHERE id = ?')
        .bind(p.take, p.id)
    );
    stmts.push(
      env.DOLDAM_DB
        .prepare(
          `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at, remaining)
           VALUES (?, ?, ?, ?, ?, ?, 0)`
        )
        .bind(crypto.randomUUID(), userId, -amount, reason, now, now)
    );

    try {
      await env.DOLDAM_DB.batch(stmts);
      return { ok: true };
    } catch {
      // 동시 차감 충돌 (CHECK 위반으로 롤백) — 최신 lot 상태로 재시도
    }
  }
  return { ok: false, reason: 'conflict_retry_exceeded' };
}
