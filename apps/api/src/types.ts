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
  TEST_MODE?: string;
  ALLOW_DEV_OTP?: string; // 'true'면 OTP를 응답에 노출 (SMS 연동 전 테스트용 — 출시 전 제거)

  // Secrets
  JWT_SECRET: string;
  CLAUDE_API_KEY: string;
  GOOGLE_VISION_KEY: string;
  DANAL_API_KEY: string;
  ADMIN_TOKEN: string;
  SLACK_BOT_TOKEN: string;
  SLACK_CHANNEL_ID: string;
  EAS_WEBHOOK_SECRET: string;
  EXPO_ACCESS_TOKEN: string;
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
