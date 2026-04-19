# 돌담 디자인 브리프 — Claude(웹/artifact)용

이 문서를 Claude 웹 Artifact에 **통째로 붙여넣은 뒤**, 맨 끝의 "이번 요청" 섹션만 바꿔가며 화면별 목업을 받으세요. 받은 React 코드는 저(터미널 Claude)에게 다시 주시면 RN으로 포팅합니다.

---

## 1. 앱 한 줄 설명

**돌담(Doldam)** — 혼인관계증명서 OCR 검증을 통과한 한국 이혼 경험자만 들어올 수 있는 익명 커뮤니티 앱. 핵심 가치는 "인증된 신뢰 + 완전한 익명성 + 감정적 공감".

## 2. 타겟 & 톤

- **타겟**: 30~50대 한국 이혼 경험 남녀
- **톤**: 따뜻함, 단정함, 무드가 가라앉아 있지만 희망적. 유흥/데이팅 앱 같은 과장된 컬러/애니메이션 금지. 병원 앱처럼 차갑지도 않게.
- **금지어**: "매칭", "소개팅", "재혼" 같은 직접적인 단어는 카피에서 피하고, "대화", "연결", "소그룹" 같은 완곡한 표현 사용.
- **금지 UI**: 실명·휴대폰·연락처 입력 필드가 프로필에 보이면 안 됨. 익명 별명만.

## 3. 디자인 토큰 (고정)

```js
const COLORS = {
  bg:         '#FAF6F1',  // 크림 배경
  card:       '#FFFFFF',
  primary:    '#C4956A',  // 따뜻한 갈색 — 주요 CTA
  primaryDark:'#A07850',  // 그라데이션/hover
  accent:     '#E8D5C0',  // 서브 배경/강조
  text:       '#2C2420',
  textSub:    '#8C7B6B',
  textLight:  '#B5A494',
  border:     '#EDE4DA',
  tag:        '#F5EDE4',  // 얇은 배경 chip
  badge:      '#E85D4A',  // 미읽음/HOT
  votePro:    '#5B9BD5',
  voteCon:    '#E07B6B',
  male:       '#5B8FC9',
  female:     '#D4728C',
  green:      '#6BAF7B',  // 인증 배지
};

const RADIUS = { sm: 8, md: 12, lg: 14, xl: 16, full: 999 };
const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
```

- 폰트: **Pretendard** (CDN import: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`)
- 그림자: `box-shadow: 0 1px 4px rgba(0,0,0,0.04)` 기본, `0 2px 8px rgba(0,0,0,0.06)` 주요 카드
- 모서리: 카드 14–16, pill 20, 칩 8–10
- 이모지 OK, 아이콘 라이브러리는 쓰지 말 것 (이모지만)

## 4. 프로토타입 제약

- **단일 파일 React 컴포넌트** (default export)
- inline style만 (CSS-in-JS/라이브러리 금지)
- 뷰포트: 폭 `390px` 고정 (iPhone 14 기준), `minHeight: 100vh`
- 상단 `돌담` 브랜드 바 + 포인트 칩 + 알림 아이콘 고정
- 하단 탭바 5개 (홈/게시판/투표/채팅/마이) 고정
- 상태는 `useState`만 사용 (라우팅은 탭 state로 전환)
- 반응형/다크모드 고려 안 해도 됨

## 5. 핵심 기능 요약 (UI에 반영돼야 할 것)

1. **소그룹 채팅 매칭** — 6~8명, 3일 자동폭파, 유지 투표, 부활 200P
2. **익명 게시판** — 카테고리 칩(자유/속마음/양육/연애/법률/남성방/여성방), 랜덤 별명(예: `따뜻한돌담482`)
3. **돌싱 딜레마 찬반투표** — 성별 필터, 공유카드 생성 CTA
4. **포인트 경제** — 30일 만료, 일일 캡, 방 개설까지 XP 형태 프로그레스
5. **프로필 열람** — 방 요약 무료 / 개별 항목 유료 🔒 30P
6. **Q&A 미션** — 3일 10개 답변 → 100P
7. **감정 타임라인** — 7가지 이모지 기록
8. **테마방 자동 개설** — 🔥 뱃지로 구분
9. **본인인증 완료** 뱃지 ✓ 초록색

## 6. 실제 백엔드 API가 주는 데이터 형태 (목업 데이터 구조로 쓸 것)

```ts
// GET /auth/me
{ id, nickname, gender: 'M'|'F', age_range: '30s', region: '서울', verified: 1 }

// GET /points/balance
{ balance: 187 }

// GET /posts?category=free
{ items: [{
  id, title, content, category, nickname, gender, age_range,
  like_count, comment_count, created_at
}], nextCursor }

// GET /votes/:id
{ id, question, description, agree, disagree, total }

// GET /rooms/mine
{ items: [{
  id, theme, gender_mix, kind: 'normal'|'themed',
  member_count, created_at, expires_at, status
}] }

// GET /profiles/:id (타인)
{ id, nickname, gender, age_range, region,
  job, has_kids, intro, interests, unlocked: ['job', ...] }
```

## 7. 이미 구현되어 있는 화면 (RN 기본형 — 이걸 예쁘게 만들어 달라는 것)

- `(tabs)/index.tsx` 홈
- `(tabs)/board.tsx` 게시판 + 카테고리
- `(tabs)/vote.tsx` 투표 목록
- `(tabs)/chat.tsx` 채팅/매칭/테마방
- `(tabs)/my.tsx` 마이페이지
- `post/[id].tsx` 글 상세 + 댓글
- `vote/[id].tsx` 투표 상세
- `room/[id].tsx` 채팅방 (WebSocket)
- `mood.tsx` 기분 기록 + 피드
- `user/[id].tsx` 타인 프로필 + 🔒 언락
- `profile-edit.tsx`
- `mission.tsx` Q&A 미션
- `auth/login,verify,certificate,onboarding`

## 8. 출력 포맷 (반드시 지켜야 함)

- 파일 하나, `export default function Screen() { ... }`
- 상단에 `const COLORS = {...}` 3번 토큰 그대로 포함
- 그 다음 해당 화면 컴포넌트만 단독으로
- 다른 화면과의 라우팅은 `onPress={() => alert('→ postDetail')}` 같은 placeholder
- 목업 데이터는 파일 내 const로 선언
- 코멘트는 한국어 OK

---

## 이번 요청 (화면별로 이 부분만 교체)

**화면 이름**: (예: `post/[id].tsx` 글 상세 화면)

**필요한 요소**:
- (예: 카테고리 뱃지, 제목, 본문, 작성자 별명/나이대/시간, 좋아요/댓글 카운트, 공감 반응 4종, 스크랩 버튼, 댓글 리스트, 댓글 입력)

**특히 신경 써줄 것**:
- (예: 댓글 리스트가 상세 본문과 시각적으로 분리되게, 내 댓글과 남 댓글 bubble 스타일 구분)

**참고**: 현재 RN 구현 파일 경로는 `apps/mobile/app/post/[id].tsx` — 이미 있는 기능은 그대로 유지하되 비주얼만 업그레이드.
