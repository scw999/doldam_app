import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '@/theme';

interface IconProps { active?: boolean; size?: number }

function stroke(active?: boolean) { return active ? colors.primary : colors.tabInactive; }
function fill(active?: boolean) { return active ? colors.primary + '22' : 'none'; }

export function HomeIcon({ active, size = 22 }: IconProps) {
  const c = stroke(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z"
        stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinejoin="round"
        fill={fill(active)}
      />
    </Svg>
  );
}

export function BoardIcon({ active, size = 22 }: IconProps) {
  const c = stroke(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={3} stroke={c} strokeWidth={active ? 2 : 1.7} fill={fill(active)} />
      <Path d="M8 9h8M8 13h8M8 17h5" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function VoteIcon({ active, size = 22 }: IconProps) {
  const c = stroke(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v18M5 7l-2 4h4l-2-4zm14 0l-2 4h4l-2-4z"
        stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round"
        fill={fill(active)}
      />
    </Svg>
  );
}

export function ChatIcon({ active, size = 22 }: IconProps) {
  const c = stroke(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-8l-4 4v-4H6a2 2 0 01-2-2V6z"
        stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinejoin="round"
        fill={fill(active)}
      />
    </Svg>
  );
}

export function MyIcon({ active, size = 22 }: IconProps) {
  const c = stroke(active);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={c} strokeWidth={active ? 2 : 1.7} fill={fill(active)} />
      <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// 브랜드바 로고 — 돌이 쌓인 상징
export function DoldamLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size * (16 / 18)} viewBox="0 0 18 16">
      <Rect x={1} y={10} width={7} height={5} rx={1.5} fill="#fff" opacity={0.95} />
      <Rect x={10} y={10} width={7} height={5} rx={1.5} fill="#fff" opacity={0.95} />
      <Rect x={5.5} y={4} width={7} height={5} rx={1.5} fill="#fff" opacity={0.95} />
      <Circle cx={9} cy={2} r={1.3} fill="#fff" opacity={0.9} />
    </Svg>
  );
}

// 알림 벨
export function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2z M10 20a2 2 0 004 0"
        stroke={colors.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}
