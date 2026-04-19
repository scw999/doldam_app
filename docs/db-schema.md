# D1 스키마 가이드

실제 SQL은 `apps/api/src/db/schema.sql` 참고. 이 문서는 테이블 개요와 관계도.

## 테이블 개요

| 테이블 | 목적 |
|---|---|
| `users` | 인증된 유저(익명 별명 + 성별 + 나이대 + 지역) |
| `auth_verifications` | 본인인증/OCR 검증 이력 (PII 해시) |
| `posts` | 게시판 글 |
| `comments` | 댓글 |
| `votes` | 찬반투표 질문 |
| `vote_responses` | 투표 응답 |
| `rooms` | 소그룹 채팅방 메타 (실제 메시지는 DO) |
| `room_members` | 방 멤버십 |
| `room_keep_votes` | 방 유지 투표 |
| `points_ledger` | 포인트 적립/소비 원장 (30일 만료 계산용) |
| `mission_questions` | Q&A 미션 질문 풀 |
| `mission_answers` | 유저 답변 |
| `moods` | 감정 타임라인 |
| `profile_unlocks` | 프로필 항목 열람 기록 |
| `reports` | 신고 |
| `payments` | 인앱결제 트랜잭션 |

## 관계

```
users 1─┬─* auth_verifications
        ├─* posts ─* comments
        ├─* vote_responses ─> votes
        ├─* room_members ─> rooms
        ├─* points_ledger
        ├─* mission_answers ─> mission_questions
        ├─* moods
        ├─* profile_unlocks (unlocker → target)
        ├─* reports
        └─* payments
```

## 인덱스 전략

- `posts(created_at DESC)`, `posts(category, created_at DESC)`
- `points_ledger(user_id, expires_at)` — 만료 정리용
- `room_members(room_id)`, `room_members(user_id, room_id)`
- `vote_responses(vote_id, gender)` — 성별 집계용

## 마이그레이션

```bash
# 새 마이그레이션
cd apps/api
npx wrangler d1 migrations create DOLDAM_DB <name>

# 로컬 적용
npx wrangler d1 migrations apply DOLDAM_DB --local

# 운영 적용
npx wrangler d1 migrations apply DOLDAM_DB --remote
```
