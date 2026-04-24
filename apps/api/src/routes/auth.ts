import { Hono } from 'hono';
import type { Env, AuthedUser } from '../types';
import { randomNickname } from '../utils/nickname';
import { sha256Hex } from '../utils/hash';
import { signJwt, type JwtPayload } from '../utils/jwt';
import { genOtp, sendOtp } from '../services/sms';
import { requireAuth, requireTempPhone } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: { user: AuthedUser; jwt: JwtPayload } }>();

const OTP_TTL_SEC = 300;         // 5분
const OTP_MAX_ATTEMPTS = 5;
const TEMP_PHONE_JWT_TTL = 1800; // 30분 (증명서 업로드 + 온보딩 완료까지)
const USER_JWT_TTL = 60 * 60 * 24 * 30; // 30일

// ---- 1. OTP 발송 ----
auth.post('/phone/request', async (c) => {
  const { phone } = await c.req.json<{ phone: string }>();
  if (!/^01[016-9]\d{7,8}$/.test(phone)) return c.json({ error: 'invalid_phone' }, 400);

  const code = genOtp();
  const phoneHash = await sha256Hex(phone);
  await c.env.DOLDAM_KV.put(
    `otp:${phoneHash}`,
    JSON.stringify({ code, attempts: 0 }),
    { expirationTtl: OTP_TTL_SEC }
  );
  await sendOtp(c.env, phone, code);

  const devMode = c.env.ENV === 'development' || !c.env.DANAL_API_KEY;
  return c.json({ ok: true, ttlSec: OTP_TTL_SEC, ...(devMode && { devCode: code }) });
});

// ---- 2. OTP 검증 → temp_phone JWT ----
auth.post('/phone/verify', async (c) => {
  const { phone, code } = await c.req.json<{ phone: string; code: string }>();
  const phoneHash = await sha256Hex(phone);
  const raw = await c.env.DOLDAM_KV.get(`otp:${phoneHash}`);
  if (!raw) return c.json({ error: 'otp_expired' }, 400);

  const { code: saved, attempts } = JSON.parse(raw) as { code: string; attempts: number };
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await c.env.DOLDAM_KV.delete(`otp:${phoneHash}`);
    return c.json({ error: 'otp_too_many_attempts' }, 429);
  }
  if (saved !== code) {
    await c.env.DOLDAM_KV.put(
      `otp:${phoneHash}`,
      JSON.stringify({ code: saved, attempts: attempts + 1 }),
      { expirationTtl: OTP_TTL_SEC }
    );
    return c.json({ error: 'otp_mismatch' }, 400);
  }

  await c.env.DOLDAM_KV.delete(`otp:${phoneHash}`);

  // 기존 회원인지 확인 (phone_hash로 조회)
  const existing = await c.env.DOLDAM_DB
    .prepare('SELECT id FROM users WHERE phone_hash = ? AND deleted_at IS NULL')
    .bind(phoneHash)
    .first<{ id: string }>();

  if (existing) {
    const token = await signJwt(
      { sub: existing.id, scope: 'user', ttlSec: USER_JWT_TTL },
      c.env.JWT_SECRET
    );
    return c.json({ status: 'existing', token });
  }

  const tempToken = await signJwt(
    { sub: phoneHash, scope: 'temp_phone', ttlSec: TEMP_PHONE_JWT_TTL },
    c.env.JWT_SECRET
  );
  return c.json({ status: 'new', tempToken });
});

// ---- 3. 증명서 업로드 (temp_phone JWT 필요) ----
auth.post('/certificate', requireTempPhone, async (c) => {
  const jwt = c.get('jwt');
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'file_required' }, 400);
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'file_too_large' }, 413);

  const r2Key = `cert/${jwt.sub}/${crypto.randomUUID()}`;
  await c.env.DOLDAM_R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  // 관리자 수동 검증 대기 (7일 보관)
  await c.env.DOLDAM_KV.put(
    `cert:${jwt.sub}`,
    JSON.stringify({ r2Key, status: 'pending', uploadedAt: Date.now() }),
    { expirationTtl: 604800 }
  );

  return c.json({ ok: true, status: 'pending' });
});

// ---- 4. 증명서 검증 상태 조회 ----
auth.get('/certificate/status', requireTempPhone, async (c) => {
  const jwt = c.get('jwt');
  const raw = await c.env.DOLDAM_KV.get(`cert:${jwt.sub}`);
  if (!raw) return c.json({ status: 'not_found' }, 404);
  return c.json(JSON.parse(raw));
});

// ---- 5. 회원가입 (증명서 검증 완료 후) ----
auth.post('/signup', requireTempPhone, async (c) => {
  const jwt = c.get('jwt');
  const phoneHash = jwt.sub;

  const certRaw = await c.env.DOLDAM_KV.get(`cert:${phoneHash}`);
  if (!certRaw) return c.json({ error: 'certificate_required' }, 400);
  const cert = JSON.parse(certRaw) as { status: string };
  if (cert.status !== 'verified') return c.json({ error: 'certificate_not_verified' }, 400);

  const { gender, ageRange, region, divorceYear, divorceMonth, interests, hasKids, custody } = await c.req.json<{
    gender: 'M' | 'F';
    ageRange: string;
    region: string;
    divorceYear?: number;
    divorceMonth?: number;
    interests?: string[];
    hasKids?: boolean | null;
    custody?: string | null;
  }>();
  if (!['M', 'F'].includes(gender)) return c.json({ error: 'invalid_gender' }, 400);

  const id = crypto.randomUUID();
  const nickname = randomNickname();
  const now = Date.now();
  const interestsStr = Array.isArray(interests) && interests.length > 0
    ? interests.join(',')
    : null;

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO users (id, phone_hash, nickname, gender, age_range, region, divorce_year, divorce_month, interests, has_kids, custody, verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(id, phoneHash, nickname, gender, ageRange, region, divorceYear ?? null, divorceMonth ?? null, interestsStr, hasKids === true ? 1 : hasKids === false ? 0 : null, custody ?? null, now)
    .run();

  await c.env.DOLDAM_DB
    .prepare(
      `INSERT INTO auth_verifications (id, user_id, kind, status, created_at)
       VALUES (?, ?, 'certificate', 'success', ?)`
    )
    .bind(crypto.randomUUID(), id, now)
    .run();

  await c.env.DOLDAM_KV.delete(`cert:${phoneHash}`);

  const token = await signJwt(
    { sub: id, scope: 'user', ttlSec: USER_JWT_TTL },
    c.env.JWT_SECRET
  );
  return c.json({ userId: id, nickname, token });
});

// ---- 6. 내 정보 ----
auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const row = await c.env.DOLDAM_DB
    .prepare(
      `SELECT id, nickname, gender, age_range, region, divorce_year, divorce_month,
              interests, has_kids, custody, job, intro, verified, created_at,
              warning_count, muted_until, banned
       FROM users WHERE id = ?`
    )
    .bind(user.id)
    .first();
  return c.json(row);
});

// ---- 닉네임 변경 — 월 3회 제한 + 중복 체크 ----
auth.post('/nickname', requireAuth, async (c) => {
  const user = c.get('user');
  const { nickname } = await c.req.json<{ nickname: string }>();
  const nick = String(nickname ?? '').trim();
  if (!nick) return c.json({ error: 'empty_nickname' }, 400);
  if (nick.length < 2 || nick.length > 20) return c.json({ error: 'invalid_length' }, 400);

  // 중복 체크 (deleted_at IS NULL)
  const dup = await c.env.DOLDAM_DB
    .prepare('SELECT id FROM users WHERE nickname = ? AND id != ? AND deleted_at IS NULL').bind(nick, user.id)
    .first<{ id: string }>();
  if (dup) return c.json({ error: 'nickname_taken' }, 409);

  // 월 3회 제한 — 최근 30일 내 변경 이력 카운트
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT COUNT(*) AS n FROM nickname_changes WHERE user_id = ? AND changed_at >= ?').bind(user.id, since)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= 3) return c.json({ error: 'rate_limited', resetAt: since + 30 * 24 * 60 * 60 * 1000 }, 429);

  const currentRow = await c.env.DOLDAM_DB
    .prepare('SELECT nickname FROM users WHERE id = ?').bind(user.id)
    .first<{ nickname: string }>();
  const oldNick = currentRow?.nickname ?? '';
  if (oldNick === nick) return c.json({ ok: true, unchanged: true });

  await c.env.DOLDAM_DB.prepare('UPDATE users SET nickname = ? WHERE id = ?').bind(nick, user.id).run();
  await c.env.DOLDAM_DB
    .prepare('INSERT INTO nickname_changes (user_id, old_nick, new_nick, changed_at) VALUES (?, ?, ?, ?)')
    .bind(user.id, oldNick, nick, Date.now()).run();

  const remaining = Math.max(0, 2 - (row?.n ?? 0));
  return c.json({ ok: true, remaining });
});

// ---- 닉네임 변경 가능 횟수 조회 ----
auth.get('/nickname/quota', requireAuth, async (c) => {
  const user = c.get('user');
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const row = await c.env.DOLDAM_DB
    .prepare('SELECT COUNT(*) AS n FROM nickname_changes WHERE user_id = ? AND changed_at >= ?').bind(user.id, since)
    .first<{ n: number }>();
  return c.json({ used: row?.n ?? 0, limit: 3, remaining: Math.max(0, 3 - (row?.n ?? 0)) });
});

export default auth;
