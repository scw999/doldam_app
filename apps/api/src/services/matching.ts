import type { Env } from '../types';
import { ROOM } from '../utils/constants';

// 매칭 대기열은 KV에 성별 bucket별로 유지.
// 키: match:queue:<gender> — JSON array of userIds
// 사용자가 매칭 신청 → 큐에 push → 6명 모이면 방 생성.
// 지역/나이대는 큐 분리에 사용하지 않고(소규모 풀에서 매칭 실패 방지),
// 방 테마 레이블로만 활용.

const QUEUE_TTL = 60 * 60 * 24; // 24시간 동안 매칭 대기

function queueKey(gender: string): string {
  return `match:queue:${gender}`;
}

async function readQueue(env: Env, key: string): Promise<string[]> {
  const raw = await env.DOLDAM_KV.get(key);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeQueue(env: Env, key: string, list: string[]): Promise<void> {
  if (list.length === 0) await env.DOLDAM_KV.delete(key);
  else await env.DOLDAM_KV.put(key, JSON.stringify(list), { expirationTtl: QUEUE_TTL });
}

export async function enqueueForMatch(env: Env, userId: string): Promise<void> {
  const user = await env.DOLDAM_DB
    .prepare('SELECT gender FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string }>();
  if (!user) throw new Error('user_not_found');

  const key = queueKey(user.gender);
  const list = await readQueue(env, key);
  if (!list.includes(userId)) list.push(userId);
  await writeQueue(env, key, list);
}

const MIXED_EACH = Math.floor(ROOM.MIN_MEMBERS / 2); // 3M + 3F

export async function tryMatch(env: Env, userId: string): Promise<string | null> {
  const user = await env.DOLDAM_DB
    .prepare('SELECT gender FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string }>();
  if (!user) return null;

  const mKey = queueKey('M');
  const fKey = queueKey('F');
  const [mList, fList] = await Promise.all([readQueue(env, mKey), readQueue(env, fKey)]);

  let picked: string[];
  let genderMix: string;

  if (mList.length >= MIXED_EACH && fList.length >= MIXED_EACH) {
    // 남녀 반반 매칭
    const pickedM = mList.slice(0, MIXED_EACH);
    const pickedF = fList.slice(0, MIXED_EACH);
    picked = [...pickedM, ...pickedF];
    genderMix = 'mixed';
    await Promise.all([
      writeQueue(env, mKey, mList.slice(pickedM.length)),
      writeQueue(env, fKey, fList.slice(pickedF.length)),
    ]);
  } else {
    // 동성 큐로 폴백
    const sameList = user.gender === 'M' ? mList : fList;
    if (sameList.length < ROOM.MIN_MEMBERS) return null;
    picked = sameList.slice(0, ROOM.MAX_MEMBERS);
    genderMix = user.gender === 'M' ? 'men_only' : 'women_only';
    const remaining = sameList.slice(picked.length);
    if (user.gender === 'M') await writeQueue(env, mKey, remaining);
    else await writeQueue(env, fKey, remaining);
  }

  // 방 테마 & 태그: 멤버들의 지역 다수결 + 관심사 집계
  const memberRows = await env.DOLDAM_DB
    .prepare(`SELECT region, interests FROM users WHERE id IN (${picked.map(() => '?').join(',')})`)
    .bind(...picked)
    .all<{ region: string; interests: string | null }>();

  const regions = memberRows.results.map((r) => r.region).filter(Boolean);
  const topRegion = regions.sort((a, b) =>
    regions.filter((v) => v === b).length - regions.filter((v) => v === a).length
  )[0] ?? '전국';

  // 관심사 빈도 집계 → 상위 2개 tags로 저장
  const interestFreq: Record<string, number> = {};
  for (const row of memberRows.results) {
    if (!row.interests) continue;
    for (const item of row.interests.split(',')) {
      const t = item.trim();
      if (t) interestFreq[t] = (interestFreq[t] ?? 0) + 1;
    }
  }
  const topInterests = Object.entries(interestFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);
  const tags = topInterests.length > 0 ? topInterests.join(',') : null;

  const roomId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + ROOM.LIFESPAN_HOURS * 3600 * 1000;
  const mixLabel = genderMix === 'mixed' ? '남녀 모임' : (user.gender === 'M' ? '남성 모임' : '여성 모임');
  const theme = `${topRegion} ${mixLabel}`;

  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO rooms (id, theme, gender_mix, tags, created_at, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    )
    .bind(roomId, theme, genderMix, tags, now, expiresAt)
    .run();

  for (const uid of picked) {
    await env.DOLDAM_DB
      .prepare('INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)')
      .bind(roomId, uid, now)
      .run();

    // 매칭 완료 알림 Queue
    await env.DOLDAM_QUEUE.send({
      type: 'notification',
      userId: uid,
      title: '매칭 완료',
      body: '새로운 소그룹 채팅방이 열렸어요',
    });
  }

  return roomId;
}

export async function matchQueueStatus(env: Env, userId: string): Promise<{ queued: boolean; queueSize: number }> {
  const user = await env.DOLDAM_DB
    .prepare('SELECT gender FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string }>();
  if (!user) return { queued: false, queueSize: 0 };
  const key = queueKey(user.gender);
  const list = await readQueue(env, key);
  return { queued: list.includes(userId), queueSize: list.length };
}

export async function cancelMatch(env: Env, userId: string): Promise<void> {
  const user = await env.DOLDAM_DB
    .prepare('SELECT gender FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string }>();
  if (!user) return;

  const key = queueKey(user.gender);
  const list = await readQueue(env, key);
  await writeQueue(env, key, list.filter((id) => id !== userId));
}
