import type { Env } from '../types';
import { verifyJwt } from '../utils/jwt';
import { runKeywordFilter } from '../middleware/moderation';
import { sendPush } from '../services/push';

interface ChatMessage {
  id: string;
  from: string;
  nickname: string;
  text: string;
  ts: number;
  voteId?: string;
  reactions?: Record<string, string[]>;
}

interface Session {
  userId: string;
  nickname: string;
}

const ICEBREAKER_QUESTIONS = [
  // 일상 / 점심 메뉴 (15개)
  '오늘 점심 뭐 드셨어요?',
  '요즘 자주 해먹는 반찬은?',
  '혼밥 메뉴 추천 부탁드려요!',
  '아침은 챙겨 드시는 편이에요?',
  '요즘 장보기 주기는 어떻게 되세요?',
  '배달 앱에서 가장 자주 시키는 메뉴는?',
  '냉장고에 꼭 있는 식재료 하나만 꼽는다면?',
  '커피 vs 차, 어느 쪽이세요?',
  '자취 요리 중 자신 있는 한 가지는?',
  '저녁은 주로 몇 시쯤 드세요?',
  '야식 유혹 올 때 어떻게 버티세요?',
  '편의점에서 자주 집는 간식은?',
  '오늘 식사 점수 매기자면 몇 점?',
  '최근에 발견한 맛집 있으세요?',
  '도시락 싸는 편이세요, 사먹는 편이세요?',

  // 오늘 있었던 일 (10개)
  '오늘 가장 기억에 남는 순간은?',
  '출근길/외출길에 있었던 일은?',
  '오늘 날씨 어떠셨어요?',
  '오늘 누군가에게 고마웠던 순간이 있나요?',
  '오늘 웃었던 일이 있다면?',
  '오늘 하루 한 문장으로 표현한다면?',
  '오늘 나를 힘들게 한 건 뭐예요?',
  '오늘 하길 잘한 일 하나 꼽는다면?',
  '오늘 미룬 일이 있다면?',
  '오늘 만난 사람 중 가장 인상 깊었던 분은?',

  // 감정 / 돌싱 공감 (10개)
  '돌싱 생활에서 가장 좋아진 점이 있다면?',
  '혼자 사는 게 오히려 좋아진 점 있나요?',
  '이혼 후 가장 크게 달라진 게 뭐예요?',
  '혼자서 새로 배운 것이 있나요?',
  '돌싱 이후 달라진 일상 습관이 있나요?',
  '요즘 스트레스 받을 때 어떻게 풀어요?',
  '최근에 스스로 칭찬해준 일이 있나요?',
  '요즘 가장 기분 좋았던 순간이 언제예요?',
  '이 방에서 어떤 얘기 가장 하고 싶어요?',
  '지금 이 순간 가장 하고 싶은 한 가지는?',

  // 취미 / 관심사 (10개)
  '요즘 즐겨보는 컨텐츠는?',
  '최근에 빠진 유튜버 있어요?',
  '요즘 인상 깊었던 책이나 영화 있어요?',
  '퇴근/하루 끝나고 루틴이 있나요?',
  '요즘 가장 빠져 있는 취미가 있다면?',
  '운동은 하시는 편이에요?',
  '최근에 새롭게 시작한 게 있나요?',
  '좋아하는 음악 장르 하나 꼽는다면?',
  '가장 기억에 남는 여행지는?',
  '주말에 주로 뭐 하세요?',

  // 미래 / 계획 (5개)
  '이번 주말 계획은 어떻게 되세요?',
  '올해 꼭 해보고 싶은 건 뭐예요?',
  '다음 휴가 때 가고 싶은 곳은?',
  '요즘 배우고 싶은 게 있다면?',
  '내년 이맘때 어떤 모습이고 싶으세요?',
];

const Q_FIRST_DELAY = 5 * 60 * 1000;      // 첫 질문: 5분 후
const Q_INTERVAL    = 8 * 60 * 60 * 1000; // 이후: 8시간마다 (하루 3회)

export class ChatRoom {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, Session> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // DO 알람 핸들러 — 주기적 아이스브레이커 질문 전송
  async alarm(): Promise<void> {
    const now = Date.now();
    // 이미 물어본 질문 인덱스 추적 — 전부 소진되면 리셋
    const asked = (await this.state.storage.get<number[]>('askedQuestions')) ?? [];
    const remaining = ICEBREAKER_QUESTIONS.map((_, i) => i).filter((i) => !asked.includes(i));
    const pool = remaining.length > 0 ? remaining : ICEBREAKER_QUESTIONS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)];
    const q = ICEBREAKER_QUESTIONS[idx];
    const newAsked = remaining.length === 0 ? [idx] : [...asked, idx];
    await this.state.storage.put('askedQuestions', newAsked);

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      from: 'system',
      nickname: '돌담',
      text: `💬 오늘의 질문: ${q}`,
      ts: now,
    };
    // 히스토리에 저장 (나중에 입장해도 볼 수 있도록)
    await this.state.storage.put(`msg:${now}:${msg.id}`, msg);
    await this.state.storage.put('lastQuestionTs', now);
    // 현재 연결된 세션에 즉시 전송
    if (this.sessions.size > 0) this.broadcast(msg);
    // 다음 질문 예약
    await this.state.storage.setAlarm(Date.now() + Q_INTERVAL);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/history')) {
      return this.getHistory();
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const token = url.searchParams.get('token');
    const roomId = url.searchParams.get('roomId');
    if (!token || !roomId) return new Response('missing_params', { status: 400 });

    const jwt = await verifyJwt(token, this.env.JWT_SECRET);
    if (!jwt || jwt.scope !== 'user') return new Response('unauthorized', { status: 401 });

    const member = await this.env.DOLDAM_DB
      .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?')
      .bind(roomId, jwt.sub)
      .first();
    if (!member) return new Response('not_a_member', { status: 403 });

    const user = await this.env.DOLDAM_DB
      .prepare('SELECT nickname FROM users WHERE id = ?')
      .bind(jwt.sub)
      .first<{ nickname: string }>();
    if (!user) return new Response('user_not_found', { status: 404 });

    // 만료된 방 차단
    const room = await this.env.DOLDAM_DB
      .prepare("SELECT status FROM rooms WHERE id = ?")
      .bind(roomId).first<{ status: string }>();
    if (room?.status === 'expired') return new Response('room_expired', { status: 410 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    // 같은 유저의 기존 연결 닫기 (다중 연결 방지)
    for (const [ws, s] of this.sessions.entries()) {
      if (s.userId === jwt.sub) {
        try { ws.close(1001, 'replaced'); } catch {}
        this.sessions.delete(ws);
      }
    }
    this.sessions.set(server, { userId: jwt.sub, nickname: user.nickname });

    // 연결 직후 현재 읽음 커서 스냅샷 전송
    const initialCursors = (await this.state.storage.get<Record<string, number>>('readCursors')) ?? {};
    try {
      server.send(JSON.stringify({ type: 'cursors', data: initialCursors }));
    } catch {}

    // 첫 번째 WebSocket 연결 시 알람 예약
    const existingAlarm = await this.state.storage.getAlarm();
    if (existingAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + Q_FIRST_DELAY);
    }

    // 입장 시스템 메시지 제거 — 앱 전환만으로도 퇴장/재입장처럼 보이는 혼란 방지

    server.addEventListener('message', async (evt) => {
      try {
        const data = JSON.parse(evt.data as string);

        // 읽음 커서 업데이트
        if (data.type === 'read') {
          const ts = Number(data.ts);
          if (!Number.isFinite(ts) || ts <= 0) return;
          const cursors = (await this.state.storage.get<Record<string, number>>('readCursors')) ?? {};
          if ((cursors[jwt.sub] ?? 0) >= ts) return; // no-op
          cursors[jwt.sub] = ts;
          await this.state.storage.put('readCursors', cursors);
          this.broadcast({ type: 'cursors', data: cursors } as any);
          return;
        }

        // 반응(이모지) 토글
        if (data.type === 'react') {
          const messageId = typeof data.messageId === 'string' ? data.messageId : null;
          const messageTs = Number(data.messageTs);
          const emoji = typeof data.emoji === 'string' && data.emoji.length <= 8 ? data.emoji : null;
          const add = !!data.add;
          if (!messageId || !messageTs || !emoji) return;

          const key = `msg:${messageTs}:${messageId}`;
          const msg = await this.state.storage.get<ChatMessage>(key);
          if (!msg) return;

          const reactions: Record<string, string[]> = { ...(msg.reactions ?? {}) };
          // 한 사용자는 같은 메시지에 하나의 이모지만 — 기존 다른 이모지에서 제거
          for (const [e, users] of Object.entries(reactions)) {
            if (e === emoji) continue;
            const filtered = users.filter((u) => u !== jwt.sub);
            if (filtered.length === 0) delete reactions[e];
            else reactions[e] = filtered;
          }
          const users = new Set<string>(reactions[emoji] ?? []);
          if (add) users.add(jwt.sub);
          else users.delete(jwt.sub);
          if (users.size === 0) delete reactions[emoji];
          else reactions[emoji] = [...users];

          const updated: ChatMessage = { ...msg, reactions };
          await this.state.storage.put(key, updated);
          this.broadcast({ type: 'reaction_updated', messageId, reactions } as any);
          return;
        }

        const text = String(data.text ?? '').trim();
        const voteId = typeof data.voteId === 'string' && data.voteId.length <= 64 ? data.voteId : undefined;
        if (!text && !voteId) return;
        if (text.length > 1000) {
          server.send(JSON.stringify({ type: 'error', error: 'message_too_long' }));
          return;
        }

        if (text) {
          const filter = await runKeywordFilter(text);
          if (!filter.ok) {
            server.send(JSON.stringify({ type: 'error', error: 'moderation_failed', reason: filter.reason }));
            return;
          }
        }

        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          from: jwt.sub,
          nickname: user.nickname,
          text,
          ts: Date.now(),
          ...(voteId && { voteId }),
        };
        await this.state.storage.put(`msg:${msg.ts}:${msg.id}`, msg);
        this.broadcast(msg);

        // 오프라인 멤버에게 푸시 알림
        const onlineIds = new Set([...this.sessions.values()].map((s) => s.userId));
        const { results: members } = await this.env.DOLDAM_DB
          .prepare('SELECT user_id FROM room_members WHERE room_id = ?')
          .bind(roomId).all<{ user_id: string }>();
        const { results: mutedRows } = await this.env.DOLDAM_DB
          .prepare('SELECT user_id FROM room_notification_mutes WHERE room_id = ?')
          .bind(roomId).all<{ user_id: string }>();
        const mutedSet = new Set(mutedRows.map((r) => r.user_id));
        for (const m of members) {
          if (!onlineIds.has(m.user_id) && m.user_id !== jwt.sub && !mutedSet.has(m.user_id)) {
            sendPush(this.env, m.user_id, `💬 ${user.nickname}`, text.slice(0, 60), { roomId }, 'chat').catch(() => {});
          }
        }
      } catch {
        server.send(JSON.stringify({ type: 'error', error: 'invalid_message' }));
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      // 퇴장 시스템 메시지 제거 — 앱 백그라운드/전환과 실제 퇴장 구분 어려움
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async getHistory(): Promise<Response> {
    const list = await this.state.storage.list<ChatMessage>({ prefix: 'msg:', limit: 200 });
    const items = [...list.values()].sort((a, b) => a.ts - b.ts);
    const cursors = (await this.state.storage.get<Record<string, number>>('readCursors')) ?? {};
    return new Response(JSON.stringify({ items, cursors }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private broadcast(msg: ChatMessage, except?: WebSocket): void {
    const payload = JSON.stringify({ type: 'message', ...msg });
    for (const ws of this.sessions.keys()) {
      if (ws === except) continue;
      try {
        ws.send(payload);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
