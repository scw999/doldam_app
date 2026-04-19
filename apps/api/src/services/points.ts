import type { Env } from '../types';
import { POINTS } from '../utils/constants';

export async function awardPoints(
  env: Env,
  userId: string,
  amount: number,
  reason: string
): Promise<{ ok: boolean; reason?: string }> {
  const now = Date.now();
  const expiresAt = now + POINTS.EXPIRY_DAYS * 86400 * 1000;

  // 일일 캡 체크
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayRow = await env.DOLDAM_DB
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS n FROM points_ledger
       WHERE user_id = ? AND amount > 0 AND created_at >= ?`
    )
    .bind(userId, startOfDay.getTime())
    .first<{ n: number }>();

  if ((todayRow?.n ?? 0) + amount > POINTS.DAILY_CAP) {
    return { ok: false, reason: 'daily_cap_exceeded' };
  }

  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, amount, reason, now, expiresAt)
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
  const bal = await env.DOLDAM_DB
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS b FROM points_ledger
       WHERE user_id = ? AND expires_at > ?`
    )
    .bind(userId, now)
    .first<{ b: number }>();

  if ((bal?.b ?? 0) < amount) return { ok: false, reason: 'insufficient_balance' };

  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, -amount, reason, now, now + POINTS.EXPIRY_DAYS * 86400 * 1000)
    .run();

  return { ok: true };
}
