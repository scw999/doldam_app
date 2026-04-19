// 돌담 디자인 토큰 — 브리프 고정값
const COLORS = {
  bg: '#FAF6F1',
  card: '#FFFFFF',
  primary: '#C4956A',
  primaryDark: '#A07850',
  accent: '#E8D5C0',
  text: '#2C2420',
  textSub: '#8C7B6B',
  textLight: '#B5A494',
  border: '#EDE4DA',
  tabBg: '#FFFFFF',
  tabActive: '#C4956A',
  tabInactive: '#C0B5A8',
  badge: '#E85D4A',
  votePro: '#5B9BD5',
  voteCon: '#E07B6B',
  male: '#5B8FC9',
  female: '#D4728C',
  tag: '#F5EDE4',
  green: '#6BAF7B',
};

const RADIUS = { sm: 8, md: 12, lg: 14, xl: 16, full: 999 };
const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

// 3가지 비주얼 방향 — Tweaks에서 전환
const AESTHETICS = {
  warm: {
    label: '따뜻하고 부드럽게',
    bg: '#FAF6F1',
    card: '#FFFFFF',
    cardShadow: '0 2px 8px rgba(44,36,32,0.05), 0 1px 2px rgba(44,36,32,0.04)',
    cardRadius: 16,
    titleFont: "'Pretendard', -apple-system, sans-serif",
    titleWeight: 700,
    bodyTracking: '-0.01em',
    density: 'normal',
    accentStripe: false,
  },
  editorial: {
    label: '정갈한 에디토리얼',
    bg: '#F7F2EC',
    card: '#FFFBF6',
    cardShadow: '0 1px 2px rgba(44,36,32,0.04)',
    cardRadius: 10,
    titleFont: "'Noto Serif KR', 'Pretendard', serif",
    titleWeight: 600,
    bodyTracking: '-0.005em',
    density: 'compact',
    accentStripe: true,
  },
  muted: {
    label: '묵직하고 고요한',
    bg: '#EFE9E1',
    card: '#FAF5EE',
    cardShadow: 'none',
    cardRadius: 20,
    titleFont: "'Pretendard', -apple-system, sans-serif",
    titleWeight: 600,
    bodyTracking: '0.005em',
    density: 'loose',
    accentStripe: false,
  },
};

Object.assign(window, { COLORS, RADIUS, SPACING, AESTHETICS });
