// Workers 런타임에서 동작하는 HS256 JWT 유틸 (의존성 없음)
// Web Crypto API 사용.

export interface JwtPayload {
  sub: string;          // userId
  scope: 'user' | 'temp_phone' | 'temp_cert';
  iat: number;
  exp: number;
  [k: string]: unknown;
}

const b64url = {
  enc(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  },
  dec(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};

function textEnc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEnc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'> & { ttlSec: number },
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const { ttlSec, ...rest } = payload;
  const full = { ...rest, iat: now, exp: now + ttlSec } as JwtPayload;

  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = b64url.enc(textEnc(JSON.stringify(header)));
  const encPayload = b64url.enc(textEnc(JSON.stringify(full)));
  const data = `${encHeader}.${encPayload}`;

  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, textEnc(data));
  const encSig = b64url.enc(new Uint8Array(sig));

  return `${data}.${encSig}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, b64url.dec(s), textEnc(`${h}.${p}`));
  if (!ok) return null;

  const payload = JSON.parse(new TextDecoder().decode(b64url.dec(p))) as JwtPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
