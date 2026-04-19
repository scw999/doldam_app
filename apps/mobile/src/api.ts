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
  auth?: TokenKind;              // default: 'user'
  headers?: Record<string, string>;
}

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

export const api = {
  get: <T>(path: string, opts?: CallOpts) => call<T>(path, { method: 'GET' }, opts),
  post: <T>(path: string, body: unknown, opts?: CallOpts) =>
    call<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts),
  patch: <T>(path: string, body: unknown, opts?: CallOpts) =>
    call<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts),
  delete: <T>(path: string, opts?: CallOpts) => call<T>(path, { method: 'DELETE' }, opts),
  upload: <T>(path: string, form: FormData, opts?: CallOpts) =>
    call<T>(path, { method: 'POST', body: form }, opts),
};
