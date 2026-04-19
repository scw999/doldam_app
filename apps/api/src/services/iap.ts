import type { Env } from '../types';

// 상품 카탈로그 (포인트 충전)
export const PRODUCTS: Record<string, { points: number; priceKrw: number }> = {
  'doldam.points.500': { points: 500, priceKrw: 1200 },
  'doldam.points.1200': { points: 1200, priceKrw: 2900 },
  'doldam.points.3000': { points: 3000, priceKrw: 6900 },
  'doldam.points.8000': { points: 8000, priceKrw: 18000 },
};

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  transactionId?: string;
}

// Apple App Store Server API — Production URL
// 실제로는 server-to-server verification endpoint 사용
// https://developer.apple.com/documentation/appstoreserverapi
export async function verifyAppleReceipt(
  env: Env,
  receipt: string,
  productId: string
): Promise<VerificationResult> {
  void env; void productId;
  // Phase 7 운영 전 실제 연동. 현재는 형식만 검증.
  if (!receipt || receipt.length < 10) return { valid: false, reason: 'invalid_format' };
  return { valid: true, transactionId: `apple-${receipt.slice(0, 16)}` };
}

// Google Play Developer API - https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
export async function verifyGoogleReceipt(
  env: Env,
  receipt: string,
  productId: string
): Promise<VerificationResult> {
  void env; void productId;
  if (!receipt || receipt.length < 10) return { valid: false, reason: 'invalid_format' };
  return { valid: true, transactionId: `google-${receipt.slice(0, 16)}` };
}
