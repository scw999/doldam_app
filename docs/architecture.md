# 돌담 아키텍처

## 전체 구조

```
 ┌──────────────┐        ┌──────────────────────────┐
 │ Expo RN App  │◀──────▶│ Cloudflare Workers (Hono)│
 │ (iOS/Android)│  HTTPS │ /auth /posts /votes ...  │
 └──────┬───────┘        └────┬─────────────┬───────┘
        │WSS                  │             │
        │                     │             │
 ┌──────▼────────┐     ┌──────▼──────┐ ┌────▼─────┐
 │Durable Object │     │     D1      │ │   KV     │
 │  ChatRoom     │     │  (SQLite)   │ │(cache/세션)│
 └───────────────┘     └─────────────┘ └──────────┘
                              │
                       ┌──────▼──────┐     ┌─────────┐
                       │ R2 (증명서)  │     │ Queues  │
                       └─────────────┘     └─────────┘

 외부: Google Vision OCR, Claude Haiku(모더레이션),
      다날/NHN 본인인증, Apple/Google IAP, Expo Push
```

## 요청 흐름 예시

### 게시글 작성
1. 모바일 → `POST /posts` (JWT)
2. Hono 미들웨어: `auth` → `moderation(Haiku)` → 핸들러
3. 핸들러: D1 insert → KV 캐시 무효화 → Queue에 알림 발송
4. 응답

### 채팅방 입장
1. 모바일 → `GET /rooms/:id/token` (JWT)
2. Worker가 Durable Object ID 생성 후 WS 업그레이드 URL 반환
3. 모바일 → WSS 연결 → Durable Object가 메시지 fanout
4. 3일 후 cron(Queues consumer)이 방 폭파 처리

### 증명서 업로드
1. 모바일 → `POST /auth/certificate` (multipart)
2. Worker → R2 업로드 → Queues에 OCR 작업 push
3. Consumer → Google Vision → 파싱 → D1 `users.verified=true` 업데이트 → R2 파일 삭제
4. 모바일에 푸시 알림

## 보안 레이어

- **인증**: JWT(HS256), refresh token은 KV에 저장
- **비밀정보**: Wrangler secrets로만 저장 (GOOGLE_VISION_KEY, CLAUDE_API_KEY, JWT_SECRET 등)
- **Rate limit**: Cloudflare 자체 + KV 카운터(엔드포인트별)
- **CORS**: 모바일 앱만 허용(관리자 웹은 별도 origin)

## 데이터 흐름 규칙

- 증명서 파일은 **R2에 최대 10분** → OCR 후 즉시 삭제
- 채팅 로그는 Durable Object Storage에 **최대 7일** 보관 (폭파 후 3일 + 유예 4일)
- PII(이름, 생년월일, 휴대폰)는 인증 시점에만 검증 → DB에 해시로만 저장
