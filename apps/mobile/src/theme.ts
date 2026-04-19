// 돌담 디자인 토큰 — editorial 확정판 (2026-04-18)
// design/src/tokens.jsx 의 AESTHETICS.editorial + COLORS 병합

export const colors = {
  // Editorial 확정 bg/card
  bg:          '#F7F2EC',
  card:        '#FFFBF6',

  // Brand / action
  primary:     '#C4956A',
  primaryDark: '#A07850',
  accent:      '#E8D5C0',

  // Text
  text:        '#2C2420',
  textSub:     '#8C7B6B',
  textLight:   '#B5A494',

  // Surface / divider
  border:      '#EDE4DA',
  tag:         '#F5EDE4',

  // Nav
  tabBg:       '#FFFBF6',
  tabActive:   '#C4956A',
  tabInactive: '#C0B5A8',

  // Signal
  badge:       '#E85D4A',
  success:     '#6BAF7B',
  error:       '#E07B6B',
  green:       '#6BAF7B',

  // Vote
  votePro:     '#5B9BD5',
  voteCon:     '#E07B6B',

  // Gender
  male:        '#5B8FC9',
  female:      '#D4728C',
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 9,                // editorial cardRadius 확정값
  xl: 14,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// iOS/Android shadow — editorial은 매우 얕은 그림자
export const shadow = {
  card: {
    shadowColor: '#2C2420',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#2C2420',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryCta: {
    shadowColor: '#A07850',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

// 폰트 — Noto Serif KR은 @expo-google-fonts/noto-serif-kr로 런타임 로드
// 기본값은 fallback (로드 실패/진행 중에도 레이아웃 안 깨짐)
export const fonts = {
  title: 'NotoSerifKR_600SemiBold',
  titleFallback: 'serif',
  body: 'Pretendard-Regular',
  bodyFallback: 'System',
} as const;

export const typography = {
  // h1: 홈 인사말, 상세 제목
  h1: { fontSize: 22, fontFamily: fonts.title, fontWeight: '600' as const, letterSpacing: -0.6 },
  // h2: 섹션 헤더
  h2: { fontSize: 17, fontFamily: fonts.title, fontWeight: '600' as const, letterSpacing: -0.4 },
  // h3: 카드 제목
  h3: { fontSize: 15, fontFamily: fonts.title, fontWeight: '600' as const, letterSpacing: -0.3 },
  // 본문
  body: { fontSize: 14, fontFamily: fonts.body, letterSpacing: -0.2, lineHeight: 22 },
  bodyLg: { fontSize: 15, fontFamily: fonts.body, letterSpacing: -0.2, lineHeight: 24 },
  // 메타/캡션
  caption: { fontSize: 12, fontFamily: fonts.body, letterSpacing: -0.15, color: colors.textSub },
  meta: { fontSize: 11, fontFamily: fonts.body, letterSpacing: -0.1, color: colors.textLight },
  // 숫자/강조
  number: { fontSize: 20, fontFamily: fonts.body, fontWeight: '700' as const, letterSpacing: -0.5 },
} as const;

// 공용 theme object (디자인 폴더 규약에 맞춤)
export const theme = {
  titleFont: fonts.title,
  titleWeight: 600 as const,
  cardRadius: radius.lg,
  cardShadow: shadow.card,
  bg: colors.bg,
  card: colors.card,
  density: 'compact' as const,
  bodyTracking: -0.1,
  accentStripe: false,
};
