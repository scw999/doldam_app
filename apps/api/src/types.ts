import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  // Bindings
  DOLDAM_DB: D1Database;
  DOLDAM_KV: KVNamespace;
  DOLDAM_R2: R2Bucket;
  DOLDAM_QUEUE: Queue<QueueMessage>;
  CHAT_ROOM: DurableObjectNamespace;

  // Vars
  ENV: 'development' | 'production';

  // Secrets
  JWT_SECRET: string;
  CLAUDE_API_KEY: string;
  GOOGLE_VISION_KEY: string;
  DANAL_API_KEY: string;
  ADMIN_TOKEN: string;
  SLACK_WEBHOOK_URL: string;
  EAS_WEBHOOK_SECRET: string;
}

export type QueueMessage =
  | { type: 'ocr'; userId: string; r2Key: string }
  | { type: 'matching'; userId: string }
  | { type: 'notification'; userId: string; title: string; body: string };

export interface AuthedUser {
  id: string;
  gender: 'M' | 'F';
  verified: boolean;
}

export type Gender = 'M' | 'F';
