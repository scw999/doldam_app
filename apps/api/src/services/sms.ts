import type { Env } from '../types';

// 다날/NHN SMS SDK는 운영 전환 시 연결.
// Phase 2 동안은 ENV=development에서 OTP를 로그로 출력.
export async function sendOtp(env: Env, phone: string, code: string): Promise<void> {
  if (env.ENV === 'development' || !env.DANAL_API_KEY) {
    console.log(`[DEV SMS] ${phone} → OTP ${code}`);
    return;
  }
  // TODO: 다날 REST API 호출
  //   POST https://api.danalsms.com/send
  //   Authorization: Bearer env.DANAL_API_KEY
  throw new Error('sms_provider_not_configured');
}

export function genOtp(): string {
  // 6자리 숫자. 앞자리 0도 허용.
  const n = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000);
  return n.toString().padStart(6, '0');
}
