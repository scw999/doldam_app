import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';

export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = c.req.header('X-Admin-Token');
  // ADMIN_TOKEN은 Secret으로 주입
  const expected = (c.env as Env & { ADMIN_TOKEN?: string }).ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return c.json({ error: 'admin_unauthorized' }, 401);
  }
  await next();
};
