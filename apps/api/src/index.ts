import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env, QueueMessage } from './types';

import auth from './routes/auth';
import posts from './routes/posts';
import votes from './routes/votes';
import rooms from './routes/rooms';
import points from './routes/points';
import missions from './routes/missions';
import moods from './routes/moods';
import payments from './routes/payments';
import profiles from './routes/profiles';
import notifications from './routes/notifications';
import reports from './routes/reports';
import admin from './routes/admin';
import webhooks from './routes/webhooks';

import { runOcr } from './services/ocr';
import { cleanupExpiredPoints, expireRooms } from './services/cleanup';
import { tryMatch } from './services/matching';
import { detectHotAndOpenRooms } from './services/themedRooms';
import { sendPush } from './services/push';

export { ChatRoom } from './durable-objects/ChatRoom';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({ origin: '*', credentials: true }));

app.get('/', (c) => c.json({ name: 'doldam-api', status: 'ok' }));
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.route('/auth', auth);
app.route('/posts', posts);
app.route('/votes', votes);
app.route('/rooms', rooms);
app.route('/points', points);
app.route('/missions', missions);
app.route('/moods', moods);
app.route('/payments', payments);
app.route('/profiles', profiles);
app.route('/notifications', notifications);
app.route('/reports', reports);
app.route('/admin', admin);
app.route('/webhooks', webhooks);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error('[error]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

async function handleQueueMessage(msg: QueueMessage, env: Env): Promise<void> {
  switch (msg.type) {
    case 'ocr': {
      const { userId, r2Key } = msg;
      const result = await runOcr(env, r2Key);

      // R2 원본 즉시 삭제 (개인정보 보호)
      await env.DOLDAM_R2.delete(r2Key).catch((e) => console.error('[ocr] r2 delete', e));

      await env.DOLDAM_KV.put(
        `cert:${userId}`,
        JSON.stringify({
          r2Key,
          status: result.matched ? 'verified' : 'rejected',
          reason: result.reason,
        }),
        { expirationTtl: 1800 }
      );
      break;
    }
    case 'matching': {
      const roomId = await tryMatch(env, msg.userId);
      if (roomId) console.log('[matching] room created', roomId);
      break;
    }
    case 'notification':
      await sendPush(env, msg.userId, msg.title, msg.body);
      break;
  }
}

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueMessage>, env: Env) {
    for (const msg of batch.messages) {
      try {
        await handleQueueMessage(msg.body, env);
        msg.ack();
      } catch (e) {
        console.error('[queue] handler error', e);
        msg.retry();
      }
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    await Promise.all([
      cleanupExpiredPoints(env),
      expireRooms(env),
      detectHotAndOpenRooms(env),
    ]);
  },
};
