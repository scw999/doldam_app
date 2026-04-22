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
}

interface Session {
  userId: string;
  nickname: string;
}

const ICEBREAKER_QUESTIONS = [
  '오늘 하루 어떠셨어요? 한 문장으로 표현한다면?',
  '요즘 가장 빠져 있는 취미가 있다면?',
  '최근에 새롭게 시작한 게 있나요?',
  '주말에 주로 뭐 하세요?',
  '돌싱 생활에서 가장 좋아진 점이 있다면?',
  '오늘 뭐 드셨어요? 요즘 자주 해먹는 메뉴 있어요?',
  '요즘 스트레스 받을 때 어떻게 풀어요?',
  '돌싱 이후 달라진 일상 습관이 있나요?',
  '지금 이 순간 가장 하고 싶은 한 가지는?',
  '이 방에서 어떤 얘기 가장 하고 싶어요?',
  '혼자 사는 게 오히려 좋아진 점 있나요?',
  '요즘 인상 깊었던 책이나 영화 있어요?',
  '자신 있는 요리가 뭐예요?',
  '가장 기억에 남는 여행지는?',
  '최근에 스스로 칭찬해준 일이 있나요?',
  '이혼 후 가장 크게 달라진 게 뭐예요?',
  '혼자서 새로 배운 것이 있나요?',
  '요즘 가장 기분 좋았던 순간이 언제예요?',
];

const Q_FIRST_DELAY = 5 * 60 * 1000;  // 첫 질문: 5분 후
const Q_INTERVAL    = 60 * 60 * 1000; // 이후: 60분마다

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
    const q = ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
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

    // 첫 번째 WebSocket 연결 시 알람 예약
    const existingAlarm = await this.state.storage.getAlarm();
    if (existingAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + Q_FIRST_DELAY);
    }

    this.broadcast({
      id: crypto.randomUUID(),
      from: 'system',
      nickname: 'system',
      text: `${user.nickname} 님이 입장했어요`,
      ts: Date.now(),
    }, server);

    server.addEventListener('message', async (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        const text = String(data.text ?? '').trim();
        if (!text) return;
        if (text.length > 1000) {
          server.send(JSON.stringify({ type: 'error', error: 'message_too_long' }));
          return;
        }

        const filter = await runKeywordFilter(text);
        if (!filter.ok) {
          server.send(JSON.stringify({ type: 'error', error: 'moderation_failed', reason: filter.reason }));
          return;
        }

        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          from: jwt.sub,
          nickname: user.nickname,
          text,
          ts: Date.now(),
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
      const s = this.sessions.get(server);
      this.sessions.delete(server);
      if (s) {
        this.broadcast({
          id: crypto.randomUUID(),
          from: 'system',
          nickname: 'system',
          text: `${s.nickname} 님이 나갔어요`,
          ts: Date.now(),
        });
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async getHistory(): Promise<Response> {
    const list = await this.state.storage.list<ChatMessage>({ prefix: 'msg:', limit: 200 });
    const items = [...list.values()].sort((a, b) => a.ts - b.ts);
    return new Response(JSON.stringify({ items }), {
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
