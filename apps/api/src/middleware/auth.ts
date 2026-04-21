import type { MiddlewareHandler } from 'hono';
import type { Env, AuthedUser } from '../types';
import { verifyJwt, type JwtPayload } from '../utils/jwt';

type Vars = { user: AuthedUser; jwt: JwtPayload };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractJwt(c: any): Promise<JwtPayload | null> {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return verifyJwt(token, c.env.JWT_SECRET);
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  const jwt = await extractJwt(c);
  if (!jwt || jwt.scope !== 'user') return c.json({ error: 'unauthorized' }, 401);

  const row = await c.env.DOLDAM_DB
    .prepare('SELECT id, gender, verified, banned FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(jwt.sub)
    .first<{ id: string; gender: 'M' | 'F'; verified: number; banned: number }>();

  if (!row) return c.json({ error: 'unauthorized' }, 401);
  if (row.banned) return c.json({ error: 'banned' }, 403);

  c.set('user', { id: row.id, gender: row.gender, verified: !!row.verified });
  c.set('jwt', jwt);
  await next();
};

export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};

// 전화번호 인증을 끝낸 상태(아직 회원가입 전) — 증명서 업로드/회원가입에 사용
export const requireTempPhone: MiddlewareHandler<{ Bindings: Env; Variables: { jwt: JwtPayload } }> = async (c, next) => {
  const jwt = await extractJwt(c);
  if (!jwt || jwt.scope !== 'temp_phone') return c.json({ error: 'unauthorized' }, 401);
  c.set('jwt', jwt);
  await next();
};
