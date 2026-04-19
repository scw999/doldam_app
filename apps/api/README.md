# @doldam/api

Cloudflare Workers + Hono 기반 돌담 백엔드.

## 초기 셋업

```bash
cd apps/api
npm install

# Cloudflare 리소스 생성 (한 번만)
npx wrangler d1 create doldam-db
npx wrangler kv:namespace create DOLDAM_KV
npx wrangler r2 bucket create doldam-certificates
npx wrangler queues create doldam-tasks

# 출력된 id들을 wrangler.toml의 PLACEHOLDER_* 에 교체

# 시크릿 주입
npx wrangler secret put JWT_SECRET
npx wrangler secret put CLAUDE_API_KEY
npx wrangler secret put GOOGLE_VISION_KEY
npx wrangler secret put DANAL_API_KEY
```

## 개발

```bash
# 로컬 D1 스키마 + seed 적용
npm run db:local

# 개발 서버
npm run dev

# 타입 체크
npm run typecheck
```

## 마이그레이션

스키마 변경 시:

```bash
npx wrangler d1 migrations create DOLDAM_DB add_new_table
# migrations/ 에 생성된 SQL 편집 후
npx wrangler d1 migrations apply DOLDAM_DB --local
npx wrangler d1 migrations apply DOLDAM_DB --remote
```

## 배포

```bash
npm run deploy
```

## 구조

```
src/
├── index.ts              # Hono 앱 진입점
├── types.ts              # Env, QueueMessage 타입
├── routes/               # API 엔드포인트
├── middleware/           # auth, moderation
├── services/             # 비즈니스 로직 (매칭/포인트/OCR)
├── durable-objects/      # ChatRoom
├── db/                   # schema.sql, seed.sql
└── utils/                # 별명 생성, 상수
```
