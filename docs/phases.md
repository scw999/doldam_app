# Phase 로드맵

## Phase 1: 프로젝트 초기 셋업 ← 현재

- [x] CLAUDE.md + docs/ 정리
- [ ] `apps/api` 스캐폴드 (Hono + Wrangler 바인딩)
- [ ] D1 스키마 + seed
- [ ] `apps/mobile` 스캐폴드 (Expo Router + 디자인 토큰)

## Phase 2: 인증 시스템 ← 현재

- [x] JWT 유틸(HS256) + requireAuth 미들웨어
- [x] 휴대폰 OTP 플로우 (KV 저장, 발송은 ENV=development 로그 출력, 운영은 다날 TODO)
- [x] 증명서 업로드 → R2 → Queue → Google Vision OCR → users.verified
- [x] 회원가입 API (+ auth_verifications 기록)
- [x] 모바일 인증 화면 (로그인/OTP/증명서 업로드/온보딩) API 연동
- [x] 로그아웃 + 인증 가드 (AuthGate)
- [ ] 운영 전환: 다날 REST 연동, refresh token 로테이션

## Phase 3: 게시판/투표/포인트 기본 ← 현재

- [x] 게시판 풀 CRUD (댓글/좋아요/소프트삭제/커서 페이지네이션/성별 전용 공간)
- [x] 찬반투표 생성 + 성별 필터 집계 + SVG 공유카드
- [x] 포인트 원장 + awardPoints/spendPoints + 일일 캡 + scheduled trigger로 180일 이상 원장 정리
- [x] Q&A 미션 라운드 로직 (3일 10문항 → 100P)
- [x] 모바일 — 홈/게시판/투표/미션 실 API 연동, 글쓰기/투표만들기/상세/공유

## Phase 4: 채팅 매칭 ← 현재

- [x] 매칭 알고리즘 (KV 대기열 per gender/age/region, 6명 모이면 방 생성 + 알림 큐)
- [x] ChatRoom Durable Object — JWT 검증, 멤버십 확인, Storage 메시지 저장, 키워드 필터, 시스템 입/퇴장 메시지
- [x] 3일 자동 만료 (Phase 3의 scheduled trigger에 이미 포함)
- [x] 방 유지 투표 (60% 찬성 → 3일 연장) + 포인트 부활 (200P)
- [x] 모바일 채팅방 UI (WebSocket, 메시지 버블, 입력, 유지/폭파 투표, 부활 버튼)

## Phase 5: 보조 기능 ← 현재

- [x] 감정 타임라인 (기록/내 90일/주간 집계/공개 피드) + mood enum 상수화
- [x] 테마방 자동 개설 — scheduled에서 24시간 인기 post/vote 감지 → kind='themed' room 생성, 공개 목록/가입 API
- [x] 프로필 확장 스키마 (job/has_kids/intro/interests) + 유료 열람 (30P) + 본인 편집 API
- [x] 모바일 — /mood 기록+피드, /user/:id 프로필 + 열람, /profile-edit, 마이페이지 링크

## Phase 6: AI 필터 / 결제 / 푸시 / 관리자

- [ ] 개인정보 필터 (키워드 → Claude Haiku)
- [ ] 인앱결제 (iOS/Android 영수증 검증)
- [ ] Expo Push 알림 (매칭/댓글/투표결과)
- [ ] 관리자 웹 (Cloudflare Pages) — 신고 처리, 유저 밴

## Phase 7: QA + 스토어 제출

- [ ] E2E 테스트 (Detox 또는 Maestro)
- [ ] 부하 테스트 (wrangler + k6)
- [ ] App Store / Play Store 심사 대응
