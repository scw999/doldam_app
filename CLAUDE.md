# 돌담(Doldam) — 프로젝트 컨텍스트

Claude Code가 매 세션 시작 시 자동으로 로드하는 프로젝트 루트 컨텍스트 문서.

---

## 1. 앱 소개

**돌담(Doldam)** — 혼인관계증명서 검증을 통해 인증된 돌싱(이혼 경험자)만 참여하는 익명 커뮤니티 앱.

- **핵심 가치**: 인증된 신뢰 + 완전한 익명성 + 감정적 공감
- **타겟**: 한국 이혼 경험 성인 남녀
- **차별점**: 본인인증 + 혼인관계증명서 OCR → 진짜 돌싱만 허용

## 2. 모노레포 구조

```
doldam/dev/
├── apps/
│   ├── api/        # Cloudflare Workers + Hono 백엔드
│   └── mobile/     # Expo React Native 앱
├── docs/
│   ├── architecture.md
│   ├── db-schema.md
│   └── phases.md
└── CLAUDE.md       # 이 파일
```

## 3. 기술 스택

### 백엔드 (apps/api)
- **런타임**: Cloudflare Workers (Fluid Compute 아님 — Workers 맞음)
- **프레임워크**: Hono
- **DB**: Cloudflare D1 (SQLite)
- **실시간 채팅**: Durable Objects + WebSocket
- **캐시/세션**: Cloudflare KV
- **파일 저장**: Cloudflare R2 (증명서 임시)
- **큐**: Cloudflare Queues (매칭/알림)
- **관리자**: Cloudflare Pages

### 프론트엔드 (apps/mobile)
- **React Native**: Expo SDK + Expo Router (파일 기반)
- **언어**: TypeScript
- **상태관리**: (추후 정함 — Zustand 유력)
- **푸시**: Expo Notifications

### 외부 서비스
- **AI 모더레이션**: Claude Haiku API (개인정보 필터, 2단계: 키워드 → AI)
- **OCR**: Google Vision API (증명서 인식)
- **본인인증**: 다날/NHN (휴대폰)
- **결제**: Apple/Google 인앱결제

## 4. 핵심 기능 (10)

1. **소그룹 채팅 매칭** — 6~8명, 3일 자동폭파, 투표로 유지 or 결제로 부활
2. **익명 게시판** — 성별 전용 공간 포함, 랜덤 별명
3. **돌싱 딜레마 찬반투표** — 성별 필터, 공유카드 바이럴
4. **포인트 경제** — 30일 만료, 일일 캡, 적립/소비 루프
5. **프로필 열람** — 방 요약 무료, 개별 항목 유료
6. **Q&A 미션** — 3일간 10개 답변 → 포인트 적립
7. **감정 타임라인** — 기분 기록, 선택적 공개
8. **테마방 자동 개설** — 인기글/투표 → 소그룹 자동 생성
9. **AI 개인정보 필터** — 2단계(키워드 + 경량 AI)
10. **인증 시스템** — 휴대폰 본인인증 + OCR 증명서

## 5. 디자인 토큰

```
메인      #C4956A  (따뜻한 갈색)
배경      #FAF6F1  (크림)
카드      #FFFFFF
텍스트    #2C2420
서브텍스트 #8C7B6B
폰트      Pretendard
```

## 6. 개발 규칙

- **언어**: 모든 주석/커밋/PR 제목은 한국어 OK, 코드는 영어
- **포맷**: Prettier + ESLint (공통 설정 `.prettierrc`, `.eslintrc.json`)
- **커밋**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` 접두사
- **DB 마이그레이션**: `apps/api/migrations/` 디렉토리에 `NNNN_description.sql`
- **환경변수**: `.dev.vars` (로컬), Cloudflare Secrets (운영)
- **비밀키 절대 금지**: D1/KV 바인딩명은 공개 가능, 실제 키는 Secrets

## 7. 중요 제약 (절대 규칙)

- **익명성 최우선**: 실명/휴대폰 번호는 인증에만 사용, 프로필/채팅에 절대 노출 금지
- **증명서 파일**: R2에 임시 저장(OCR 후 즉시 삭제), DB에는 검증 플래그만 남김
- **AI 필터**: 모든 사용자 입력 텍스트(게시글/댓글/채팅)는 개인정보 필터 통과 필수
- **포인트 만료**: 30일 FIFO 만료, 일일 적립 캡 엄수
- **한국 법령**: 통신비밀보호법, 정보통신망법 준수 (채팅 로그 보관 기간 등)

## 8. Phase 로드맵

- **Phase 1**: 프로젝트 셋업 (백엔드 스캐폴드, D1 스키마, 모바일 앱 스캐폴드) ← **현재**
- **Phase 2**: 인증 시스템 (본인인증 + OCR + JWT)
- **Phase 3**: 게시판/투표/포인트 기본 CRUD
- **Phase 4**: 채팅 매칭 + Durable Objects WebSocket
- **Phase 5**: Q&A 미션, 감정 타임라인, 테마방 자동 개설
- **Phase 6**: AI 필터, 결제, 푸시, 관리자 웹
- **Phase 7**: QA, 스토어 제출

세부 내용은 `docs/phases.md` 참조.

## 9. 참고 문서

- `docs/architecture.md` — 상세 아키텍처
- `docs/db-schema.md` — D1 스키마 전체
- `docs/phases.md` — Phase별 체크리스트
