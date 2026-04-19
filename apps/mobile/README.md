# @doldam/mobile

Expo + React Native + Expo Router 기반 돌담 앱.

## 초기 셋업

```bash
cd apps/mobile
npm install

# 환경변수 (백엔드 URL)
cp .env.example .env
# EXPO_PUBLIC_API_BASE=http://localhost:8787
```

## 실행

```bash
npm start          # QR로 Expo Go 연결
npm run ios        # iOS 시뮬레이터
npm run android    # Android 에뮬레이터
```

## 구조

```
app/
├── _layout.tsx            # 루트 레이아웃 (Stack + Provider)
├── (tabs)/                # 하단 탭
│   ├── _layout.tsx
│   ├── index.tsx          # 홈
│   ├── board.tsx          # 게시판
│   ├── vote.tsx           # 투표
│   ├── chat.tsx           # 채팅
│   └── my.tsx             # 마이페이지
├── auth/                  # 로그인/인증/온보딩
├── post/[id].tsx
├── vote/[id].tsx
└── room/[id].tsx

src/
├── theme.ts               # 디자인 토큰
├── api.ts                 # API 클라이언트 (Bearer 토큰)
└── store/auth.ts          # zustand 인증 스토어
```

## 폰트

Pretendard Regular/SemiBold/Bold를 `assets/fonts/`에 배치 후
`app/_layout.tsx`에서 `expo-font`로 로드 (Phase 1 후반부).
