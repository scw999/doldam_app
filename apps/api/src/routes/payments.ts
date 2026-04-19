import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { requireAuth } from '../middleware/auth';
import { awardPoints } from '../services/points';
import { verifyAppleReceipt, verifyGoogleReceipt, PRODUCTS } from '../services/iap';

type Vars = { user: AuthedUser };
const payments = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- 상품 카탈로그 ----
payments.get('/products', (c) => {
  const items = Object.entries(PRODUCTS).map(([id, p]) => ({ id, ...p }));
  return c.json({ items });
});

// ---- 영수증 검증 + 포인트 충전 ----
payments.post('/verify', requireAuth, async (c) => {
  const user = c.get('user');
  const { platform, receipt, productId } = await c.req.json<{
    platform: 'ios' | 'android';
    receipt: string;
    productId: string;
  }>();

  const product = PRODUCTS[productId];
  if (!product) return c.json({ error: 'unknown_product' }, 400);

  const verifier = platform === 'ios' ? verifyAppleReceipt : verifyGoogleReceipt;
  const result = await verifier(c.env, receipt, productId);

  const paymentId = crypto.randomUUID();
  const now = Date.now();

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO payments (id, user_id, platform, product_id, receipt, status, created_at, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      paymentId, user.id, platform, productId, receipt,
      result.valid ? 'verified' : 'failed',
      now,
      result.valid ? now : null
    )
    .run();

  if (!result.valid) return c.json({ error: 'verification_failed', reason: result.reason }, 400);

  // 충전 시 일일 캡 무시 — 구매는 별도 흐름. Direct insert into ledger.
  const expiresAt = now + 30 * 86400 * 1000;
  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO points_ledger (id, user_id, amount, reason, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), user.id, product.points, `iap:${productId}`, now, expiresAt)
    .run();

  return c.json({ ok: true, pointsAdded: product.points });
});

export default payments;
