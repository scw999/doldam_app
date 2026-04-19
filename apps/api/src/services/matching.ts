import type { Env } from '../types';
import { ROOM } from '../utils/constants';

// 매칭 대기열은 KV에 성별/나이대/지역 bucket별로 유지.
// 키: match:queue:<gender>:<age>:<region> — JSON array of userIds
// 사용자가 매칭 신청 → 큐에 push → 6명 모이면 방 생성.

const QUEUE_TTL = 60 * 60 * 24; // 24시간 동안 매칭 대기

function queueKey(gender: string, age: string, region: string): string {
  return `match:queue:${gender}:${age}:${region}`;
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
    .prepare('SELECT gender, age_range, region FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string; age_range: string; region: string }>();
  if (!user) throw new Error('user_not_found');

  const key = queueKey(user.gender, user.age_range, user.region);
  const list = await readQueue(env, key);
  if (!list.includes(userId)) list.push(userId);
  await writeQueue(env, key, list);
}

export async function tryMatch(env: Env, userId: string): Promise<string | null> {
  const user = await env.DOLDAM_DB
    .prepare('SELECT gender, age_range, region FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string; age_range: string; region: string }>();
  if (!user) return null;

  const key = queueKey(user.gender, user.age_range, user.region);
  const list = await readQueue(env, key);
  if (list.length < ROOM.MIN_MEMBERS) return null;

  const picked = list.slice(0, ROOM.MAX_MEMBERS);
  const remaining = list.slice(picked.length);
  await writeQueue(env, key, remaining);

  const roomId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + ROOM.LIFESPAN_HOURS * 3600 * 1000;
  const theme = `${user.age_range} ${user.region}`;
  const genderMix = user.gender === 'M' ? 'men_only' : 'women_only';

  await env.DOLDAM_DB
    .prepare(
      `INSERT INTO rooms (id, theme, gender_mix, created_at, expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .bind(roomId, theme, genderMix, now, expiresAt)
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

export async function cancelMatch(env: Env, userId: string): Promise<void> {
  const user = await env.DOLDAM_DB
    .prepare('SELECT gender, age_range, region FROM users WHERE id = ?')
    .bind(userId)
    .first<{ gender: string; age_range: string; region: string }>();
  if (!user) return;

  const key = queueKey(user.gender, user.age_range, user.region);
  const list = await readQueue(env, key);
  await writeQueue(env, key, list.filter((id) => id !== userId));
}
