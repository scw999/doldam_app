#!/usr/bin/env node
// 채팅방·매칭 end-to-end 검증 (HTTP, WebSocket 제외)
// 사전:
//   1) wrangler dev가 8787에 떠 있어야 함
//   2) 로컬 D1에 다음 시드가 필요:
//      - chat-user-{a..h} 8명 (M/F 교차)
//      - chat-user-poor (포인트 0인 유저)
// 사용: node loadtest/e2e_chat_room.mjs

import crypto from 'node:crypto';

const BASE = process.env.API_BASE || 'http://localhost:8787';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-in-production-min32chars';

const U = {
  // 매칭용 — 자동 매칭으로 방 만들 4명 (2M+2F)
  M1: { id: 'chat-user-m1', gender: 'M' },
  F1: { id: 'chat-user-f1', gender: 'F' },
  M2: { id: 'chat-user-m2', gender: 'M' },
  F2: { id: 'chat-user-f2', gender: 'F' },
  // 테마방 정원 초과용 — 4명 다 가입 후 5번째 거부 확인
  T1: { id: 'chat-user-t1', gender: 'M' },
  T2: { id: 'chat-user-t2', gender: 'M' },
  T3: { id: 'chat-user-t3', gender: 'M' },
  T4: { id: 'chat-user-t4', gender: 'M' },
  T5: { id: 'chat-user-t5', gender: 'M' }, // 5번째
  // 부활용 — 포인트 0인 유저
  POOR: { id: 'chat-user-poor', gender: 'M' },
};

let passed = 0, failed = 0;
const failures = [];
const ok = (l) => { passed++; console.log(`  ✓ ${l}`); };
const fail = (l, d) => { failed++; failures.push({ l, d }); console.log(`  ✗ ${l}\n    ${d}`); };
const section = (n) => console.log(`\n── ${n} ──`);

function signJwt(sub) {
  const h = { alg: 'HS256', typ: 'JWT' };
  const b = { sub, scope: 'user', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const msg = `${enc(h)}.${enc(b)}`;
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
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 매칭 큐 처리 대기 — 방이 생길 때까지 또는 timeoutMs까지
async function waitForRoom(token, timeoutMs = 60000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await call('GET', '/rooms/mine', { token });
    if (r.body.items?.length > 0) return r.body.items[0];
    await sleep(intervalMs);
  }
  return null;
}

async function main() {
  console.log(`API: ${BASE}\n`);
  const tokens = Object.fromEntries(Object.entries(U).map(([k, u]) => [k, signJwt(u.id)]));

  section('헬스체크');
  const h = await call('GET', '/health');
  if (h.status === 200 && h.body.ok) ok('GET /health');
  else { fail('헬스체크', JSON.stringify(h)); return; }

  section('시드 유저 인증');
  const me = await call('GET', '/auth/me', { token: tokens.M1 });
  if (me.status === 200) ok(`M1 인증 OK (nickname=${me.body.nickname})`);
  else { fail('M1 인증 — 시드 누락', JSON.stringify(me)); return; }

  // ─── 매칭 → 4명 방 ───────────────────────────────────────
  section('자동 매칭 (2M+2F → 4명 방)');
  for (const k of ['M1', 'F1', 'M2', 'F2']) {
    const r = await call('POST', '/rooms/match', { token: tokens[k], body: {} });
    if (r.status === 200) ok(`enqueue ${U[k].id}`);
    else { fail(`enqueue ${U[k].id}`, JSON.stringify(r)); }
  }

  console.log('  큐 처리 대기...');
  const room = await waitForRoom(tokens.M1, 60000);
  if (!room) { fail('방 생성 대기 60초 초과', '큐 처리가 안 됨'); return; }
  ok(`방 생성됨 (id=${room.id.slice(0, 8)}, member_count=${room.member_count})`);

  if (room.member_count === 4) ok('방 정원 == 4명');
  else fail('방 정원', `expected 4, got ${room.member_count}`);

  // ─── 이미 방 있는 사람 재매칭 차단 ───────────────────────
  section('이미 방 있는 사람 재매칭 차단');
  const reMatch = await call('POST', '/rooms/match', { token: tokens.M1, body: {} });
  if (reMatch.status === 400 && reMatch.body.error === 'already_in_room') {
    ok('already_in_room 차단');
  } else fail('재매칭 차단', JSON.stringify(reMatch));

  // ─── 방 상세 ────────────────────────────────────────────
  section('방 상세 조회');
  const detail = await call('GET', `/rooms/${room.id}`, { token: tokens.M1 });
  if (detail.status === 200) {
    ok(`GET /rooms/:id 200 (members=${detail.body.members?.length ?? 'n/a'})`);
    if (detail.body.members?.length === 4) ok('상세에서도 멤버 4명');
    else fail('상세 멤버 수', `expected 4, got ${detail.body.members?.length}`);
  } else fail('방 상세', JSON.stringify(detail));

  // 비멤버는 접근 거부
  const outsider = await call('GET', `/rooms/${room.id}`, { token: tokens.T1 });
  if (outsider.status === 403 || outsider.status === 404) ok('비멤버 접근 거부');
  else fail('비멤버 거부', `status=${outsider.status}`);

  // ─── 방 히스토리 ────────────────────────────────────────
  section('방 히스토리 (초기 빈 상태)');
  const hist = await call('GET', `/rooms/${room.id}/history`, { token: tokens.M1 });
  if (hist.status === 200) ok(`히스토리 조회 OK (messages=${hist.body.messages?.length ?? 0})`);
  else fail('히스토리', JSON.stringify(hist));

  // ─── 유지 투표 ──────────────────────────────────────────
  section('유지 투표');
  const vote = await call('POST', `/rooms/${room.id}/keep-vote`, { token: tokens.M1, body: { keep: true } });
  if (vote.status === 200) ok('유지 투표 200');
  else fail('유지 투표', JSON.stringify(vote));

  // 같은 사람 재투표 — 멱등 또는 업데이트
  const vote2 = await call('POST', `/rooms/${room.id}/keep-vote`, { token: tokens.M1, body: { keep: true } });
  if (vote2.status === 200) ok('재투표 OK (멱등 또는 업데이트)');
  else fail('재투표', JSON.stringify(vote2));

  // ─── 부활 — active 방은 못 살림 ──────────────────────────
  section('부활 (active 방은 거부)');
  const revActive = await call('POST', `/rooms/${room.id}/revive`, { token: tokens.M1, body: {} });
  if (revActive.status === 400 && revActive.body.error === 'already_active') {
    ok('active 방 부활 시도 → already_active 거부');
  } else fail('active 방 부활', JSON.stringify(revActive));

  // ─── 부활 — 포인트 부족 ──────────────────────────────────
  section('부활 (포인트 부족 거부)');
  // POOR가 이 방의 멤버가 아니므로 not_a_member로 거부됨 — 이것도 좋은 케이스
  const revNotMember = await call('POST', `/rooms/${room.id}/revive`, { token: tokens.POOR, body: {} });
  if (revNotMember.status === 403 && revNotMember.body.error === 'not_a_member') {
    ok('비멤버 부활 → not_a_member 거부');
  } else fail('비멤버 부활', JSON.stringify(revNotMember));

  // 매칭 취소
  section('매칭 큐 취소');
  const cancelNotQueued = await call('POST', '/rooms/match/cancel', { token: tokens.POOR, body: {} });
  if (cancelNotQueued.status === 200) ok('큐에 없어도 취소 200 (멱등)');
  else fail('매칭 취소', JSON.stringify(cancelNotQueued));

  // ─── 정리 ───────────────────────────────────────────────
  console.log(`\n=========================================`);
  console.log(`결과: ${passed} 통과 / ${failed} 실패`);
  if (failed > 0) {
    console.log('\n실패 상세:');
    failures.forEach((f) => console.log(`  - ${f.l}: ${f.d}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
