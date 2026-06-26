#!/usr/bin/env node
// 차단·탈퇴 end-to-end 검증 (HTTP only)
// 사전: wrangler dev가 8787에 떠 있고, 테스트 유저 4명이 DB에 미리 시드됨.
// 사용: node loadtest/e2e_blocks_withdraw.mjs

import crypto from 'node:crypto';

const BASE = process.env.API_BASE || 'http://localhost:8787';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-in-production-min32chars';

// 미리 시드된 테스트 유저들 (외부 wrangler d1 execute로 INSERT)
const USERS = {
  A: { id: 'e2e-user-a', nickname: 'E2E_alice', gender: 'M' },
  B: { id: 'e2e-user-b', nickname: 'E2E_bob',   gender: 'F' },
  C: { id: 'e2e-user-c', nickname: 'E2E_carl',  gender: 'M' },
  D: { id: 'e2e-user-d', nickname: 'E2E_dora',  gender: 'F' },
};

let passed = 0, failed = 0;
const failures = [];
function ok(label)   { passed++; console.log(`  ✓ ${label}`); }
function fail(label, detail) { failed++; failures.push({ label, detail }); console.log(`  ✗ ${label}\n    ${detail}`); }
function section(name) { console.log(`\n── ${name} ──`); }

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const ttlSec = 3600;
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const msg = `${enc(header)}.${enc(body)}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(msg).digest('base64url');
  return `${msg}.${sig}`;
}

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

async function main() {
  console.log(`API: ${BASE}\n`);

  // 토큰 발급
  const tokens = {};
  for (const [k, u] of Object.entries(USERS)) {
    tokens[k] = signJwt({ sub: u.id, scope: 'user' });
  }

  section('서버 헬스체크');
  const h = await call('GET', '/health');
  if (h.status === 200 && h.body.ok) ok('GET /health');
  else { fail('GET /health', JSON.stringify(h)); return; }

  // 사전 — 시드 확인
  section('시드 유저 인증 확인');
  const meA = await call('GET', '/auth/me', { token: tokens.A });
  if (meA.status === 200 && meA.body.nickname === USERS.A.nickname) {
    ok(`A 인증 OK (${meA.body.nickname})`);
  } else { fail('A 인증', `시드 안 됐거나 nickname 불일치: ${JSON.stringify(meA)}`); return; }

  // 글 작성 — A, B 각 1개
  section('글 작성');
  const pa = await call('POST', '/posts', { token: tokens.A, body: { title: 'E2E A의 글', content: 'aaa', category: 'free' } });
  const pb = await call('POST', '/posts', { token: tokens.B, body: { title: 'E2E B의 글', content: 'bbb', category: 'free' } });
  pa.status === 200 && pa.body.id ? ok(`A 글 (${pa.body.id.slice(0,8)})`) : fail('A 글', JSON.stringify(pa));
  pb.status === 200 && pb.body.id ? ok(`B 글 (${pb.body.id.slice(0,8)})`) : fail('B 글', JSON.stringify(pb));

  // 차단 전 — 양쪽 다 보임
  section('차단 전 — 둘 다 보임');
  const list1 = await call('GET', '/posts?category=free&limit=20', { token: tokens.A });
  const t1 = (list1.body.items || []).filter((p) => p.title.startsWith('E2E')).map((p) => p.title);
  if (t1.includes('E2E A의 글') && t1.includes('E2E B의 글')) ok(`A 시점: ${t1.length}개 (둘 다)`);
  else fail('A 시점 목록', JSON.stringify(t1));

  // A가 B 차단
  section('차단 — A가 B 차단');
  const block = await call('POST', '/blocks', { token: tokens.A, body: { targetId: USERS.B.id } });
  block.status === 200 && block.body.ok ? ok('POST /blocks 200') : fail('POST /blocks', JSON.stringify(block));

  // A 시점에서 B 글 안 보임
  const list2 = await call('GET', '/posts?category=free&limit=20', { token: tokens.A });
  const t2 = (list2.body.items || []).filter((p) => p.title.startsWith('E2E')).map((p) => p.title);
  if (t2.includes('E2E A의 글') && !t2.includes('E2E B의 글')) ok(`A 시점: B 글 안 보임 (${t2.join(', ')})`);
  else fail('A 시점 B 필터', JSON.stringify(t2));

  // 양방향 — B 시점에서 A 글 안 보임
  const list3 = await call('GET', '/posts?category=free&limit=20', { token: tokens.B });
  const t3 = (list3.body.items || []).filter((p) => p.title.startsWith('E2E')).map((p) => p.title);
  if (t3.includes('E2E B의 글') && !t3.includes('E2E A의 글')) ok(`B 시점: A 글 안 보임 (양방향)`);
  else fail('B 시점 A 필터 (양방향)', JSON.stringify(t3));

  // 차단된 글 상세 → 404
  const detail = await call('GET', `/posts/${pb.body.id}`, { token: tokens.A });
  detail.status === 404 ? ok('차단된 글 상세 → 404') : fail('차단된 글 상세', `status=${detail.status}`);

  // 차단된 프로필 → 404
  const profile = await call('GET', `/profiles/${USERS.B.id}`, { token: tokens.A });
  profile.status === 404 ? ok('차단된 프로필 → 404') : fail('차단된 프로필', `status=${profile.status}`);

  // 차단 목록
  const blockList = await call('GET', '/blocks', { token: tokens.A });
  if (blockList.status === 200 && blockList.body.items?.some((x) => x.id === USERS.B.id)) {
    ok(`차단 목록에 B 포함 (${blockList.body.items.length}명)`);
  } else fail('차단 목록', JSON.stringify(blockList));

  // 차단 해제
  section('차단 해제');
  const unblock = await call('DELETE', `/blocks/${USERS.B.id}`, { token: tokens.A });
  unblock.status === 200 ? ok('DELETE /blocks/:id 200') : fail('차단 해제', JSON.stringify(unblock));

  const list4 = await call('GET', '/posts?category=free&limit=20', { token: tokens.A });
  const t4 = (list4.body.items || []).filter((p) => p.title.startsWith('E2E')).map((p) => p.title);
  if (t4.includes('E2E A의 글') && t4.includes('E2E B의 글')) ok('해제 후 다시 둘 다 보임');
  else fail('해제 후 노출', JSON.stringify(t4));

  // 탈퇴 — C
  section('탈퇴 흐름');
  const pc = await call('POST', '/posts', { token: tokens.C, body: { title: 'E2E C의 유언', content: 'ccc', category: 'free' } });
  if (pc.status !== 200) { fail('C 글', JSON.stringify(pc)); return; }
  await call('POST', '/blocks', { token: tokens.C, body: { targetId: USERS.D.id } });

  const withdrawRes = await fetch(BASE + '/auth/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.C}` },
    body: JSON.stringify({ reason: 'E2E 테스트' }),
  });
  const wbody = await withdrawRes.json().catch(() => ({}));
  if (withdrawRes.status === 200 && wbody.ok) ok('DELETE /auth/me 200');
  else { fail('DELETE /auth/me', `status=${withdrawRes.status} body=${JSON.stringify(wbody)}`); return; }

  // 탈퇴자 토큰은 더 이상 안 먹음
  const meAfter = await call('GET', '/auth/me', { token: tokens.C });
  meAfter.status === 401 ? ok('탈퇴자 토큰 → 401') : fail('탈퇴자 토큰 거부', `status=${meAfter.status}`);

  // C의 옛 글이 게시판에 익명으로 보존
  const listAfter = await call('GET', '/posts?category=free&limit=20', { token: tokens.A });
  const cPost = (listAfter.body.items || []).find((p) => p.title === 'E2E C의 유언');
  if (cPost && cPost.nickname === '(탈퇴한 회원)') ok(`C 옛 글 익명 보존 (작성자: ${cPost.nickname})`);
  else fail('탈퇴자 글 익명 표시', JSON.stringify(cPost));

  // 차단 후 차단 자신을 차단 (방어 코드 점검)
  section('엣지 케이스');
  const selfBlock = await call('POST', '/blocks', { token: tokens.A, body: { targetId: USERS.A.id } });
  selfBlock.status === 400 ? ok('자기 자신 차단 → 400') : fail('자기 차단 방어', JSON.stringify(selfBlock));

  const noTarget = await call('POST', '/blocks', { token: tokens.A, body: { targetId: 'no-such-user' } });
  noTarget.status === 404 ? ok('존재하지 않는 유저 차단 → 404') : fail('유령 차단 방어', JSON.stringify(noTarget));

  console.log(`\n=========================================`);
  console.log(`결과: ${passed} 통과 / ${failed} 실패`);
  if (failed > 0) {
    console.log('\n실패 상세:');
    failures.forEach((f) => console.log(`  - ${f.label}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
