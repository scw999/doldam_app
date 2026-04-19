// 서명 검증 없는 클라이언트 디코드 (서버가 이미 검증한 토큰에서 sub만 읽기)
export function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const pad = '='.repeat((4 - (parts[1].length % 4)) % 4);
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/') + pad);
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
