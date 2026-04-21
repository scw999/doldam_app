import { useAuth } from './store/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8787';

type TokenKind = 'user' | 'temp' | 'none';

function currentToken(kind: TokenKind): string | null {
  const { token, tempToken } = useAuth.getState();
  if (kind === 'user') return token;
  if (kind === 'temp') return tempToken;
  return null;
}

interface CallOpts {
  auth?: TokenKind;
  headers?: Record<string, string>;
  // GET 캐시 TTL(ms), 0 = 캐시 안 함
  cacheTtl?: number;
}

// ---- 클라이언트 측 GET 캐시 (탭 전환 시 네트워크 콜 제거) ----
const _cache = new Map<string, { data: unknown; ts: number }>();
const DEFAULT_TTL = 30_000;

function cacheGet<T>(key: string, ttl: number): T | null {
  const e = _cache.get(key);
  return e && Date.now() - e.ts < ttl ? (e.data as T) : null;
}

function cachePut(key: string, data: unknown) {
  _cache.set(key, { data, ts: Date.now() });
}

// POST/PATCH/DELETE 후 prefix 일치하는 캐시 무효화
function invalidate(prefix: string) {
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

// ---- 진행 중인 GET 요청 공유 (중복 네트워크 콜 방지) ----
const _inflight = new Map<string, Promise<unknown>>();

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `http_${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function call<T>(path: string, init: RequestInit, opts: CallOpts = {}): Promise<T> {
  const auth = opts.auth ?? 'user';
  const token = currentToken(auth);
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (init.body && !headers['Content-Type'] && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return parseOrThrow<T>(await fetch(`${API_BASE}${path}`, { ...init, headers }));
}

async function cachedGet<T>(path: string, opts: CallOpts = {}): Promise<T> {
  const ttl = opts.cacheTtl !== undefined ? opts.cacheTtl : DEFAULT_TTL;
  if (ttl > 0) {
    const hit = cacheGet<T>(path, ttl);
    if (hit !== null) return hit;

    // 같은 경로의 진행 중인 요청이 있으면 공유
    const existing = _inflight.get(path);
    if (existing) return existing as Promise<T>;
  }

  const req = call<T>(path, { method: 'GET' }, opts).then((data) => {
    if (ttl > 0) cachePut(path, data);
    return data;
  }).finally(() => { _inflight.delete(path); });

  if (ttl > 0) _inflight.set(path, req);
  return req;
}

export const api = {
  get: <T>(path: string, opts?: CallOpts) => cachedGet<T>(path, opts),

  post: <T>(path: string, body: unknown, opts?: CallOpts) => {
    invalidate(path.split('?')[0]);
    return call<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts);
  },

  patch: <T>(path: string, body: unknown, opts?: CallOpts) => {
    invalidate(path.split('/').slice(0, -1).join('/'));
    return call<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts);
  },

  put: <T>(path: string, body: unknown, opts?: CallOpts) => {
    invalidate(path.split('/').slice(0, -1).join('/'));
    return call<T>(path, { method: 'PUT', body: JSON.stringify(body) }, opts);
  },

  delete: <T>(path: string, opts?: CallOpts) => {
    invalidate(path.split('/').slice(0, -1).join('/'));
    return call<T>(path, { method: 'DELETE' }, opts);
  },

  upload: <T>(path: string, form: FormData, opts?: CallOpts) =>
    call<T>(path, { method: 'POST', body: form }, opts),

  // 캐시 수동 무효화 (필요 시 사용)
  clearCache: (prefix?: string) => {
    if (prefix) invalidate(prefix);
    else _cache.clear();
  },
};
