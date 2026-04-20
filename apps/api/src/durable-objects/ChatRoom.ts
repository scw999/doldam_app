import type { Env } from '../types';
import { verifyJwt } from '../utils/jwt';
import { runKeywordFilter } from '../middleware/moderation';

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

export class ChatRoom {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, Session> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 최근 메시지 조회 (REST)
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

    // 방 멤버십 확인
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

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.set(server, { userId: jwt.sub, nickname: user.nickname });

    // 입장 알림
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
        for (const m of members) {
          if (!onlineIds.has(m.user_id) && m.user_id !== jwt.sub) {
            await this.env.DOLDAM_QUEUE.send({
              type: 'notification',
              userId: m.user_id,
              title: `💬 ${user.nickname}`,
              body: text.slice(0, 60),
            }).catch(() => {});
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
