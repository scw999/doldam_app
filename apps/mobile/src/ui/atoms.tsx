import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

// ---------- Avatar ----------
export function Avatar({ gender, size = 36, emoji }: {
  gender?: 'M' | 'F' | null;
  size?: number;
  emoji?: string;
}) {
  const bg = gender === 'M' ? '#DCE7F3' : gender === 'F' ? '#F3DCE3' : colors.accent;
  const e = emoji ?? (gender === 'M' ? '🌊' : gender === 'F' ? '🌿' : '🌱');
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.5 }}>{e}</Text>
    </View>
  );
}

// ---------- Tag (카테고리 배지) ----------
export function Tag({ label, color, compact = false }: {
  label: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <View style={{
      paddingVertical: compact ? 1 : 3,
      paddingHorizontal: compact ? 7 : 9,
      borderRadius: 6,
      backgroundColor: color + '1A',
      alignSelf: 'flex-start',
    }}>
      <Text style={{
        color,
        fontSize: compact ? 10 : 11,
        fontWeight: '600',
        letterSpacing: -0.1,
      }}>{label}</Text>
    </View>
  );
}

// ---------- CatChip (카테고리 필터 칩) ----------
export function CatChip({ label, color, active, onPress }: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 32,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? color : colors.border,
        backgroundColor: active ? color + '18' : colors.card,
        justifyContent: 'center',
      }}
    >
      <Text style={{
        color: active ? color : colors.textSub,
        fontSize: 13,
        fontWeight: active ? '600' : '500',
        letterSpacing: -0.2,
      }}>{label}</Text>
    </Pressable>
  );
}

// ---------- VerifiedBadge ----------
export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.green,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.65, fontWeight: '700' }}>✓</Text>
    </View>
  );
}

// ---------- Progress bar ----------
export function Progress({ value, max = 100, color = colors.primary, bg = colors.accent, h = 6 }: {
  value: number;
  max?: number;
  color?: string;
  bg?: string;
  h?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <View style={{ height: h, borderRadius: h / 2, backgroundColor: bg, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

// ---------- Divider ----------
export function Divider({ m = 0 }: { m?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: m }} />;
}

// ---------- GenderDot ----------
export function GenderDot({ gender, size = 5 }: { gender?: 'M' | 'F' | null; size?: number }) {
  const c = gender === 'M' ? colors.male : gender === 'F' ? colors.female : colors.textLight;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />
  );
}

// ---------- ReactionRow ----------
export function ReactionRow({ reactions, compact = false }: {
  reactions: Record<string, number>;
  compact?: boolean;
}) {
  const entries = Object.entries(reactions).filter(([, v]) => v > 0);
  return (
    <View style={{ flexDirection: 'row', gap: compact ? 6 : 8, alignItems: 'center' }}>
      {entries.map(([emoji, n]) => (
        <View key={emoji} style={{
          flexDirection: 'row', alignItems: 'center', gap: 3,
          paddingVertical: compact ? 2 : 3, paddingHorizontal: compact ? 7 : 9,
          borderRadius: radius.full, backgroundColor: colors.tag,
        }}>
          <Text style={{ fontSize: compact ? 12 : 13 }}>{emoji}</Text>
          <Text style={{ fontSize: compact ? 11 : 12, color: colors.textSub, fontWeight: '600' }}>{n}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- Pill ----------
export function Pill({ children, color, bg, icon }: {
  children: string;
  color: string;
  bg: string;
  icon?: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      paddingVertical: 3, paddingHorizontal: 8,
      borderRadius: radius.full,
      backgroundColor: bg,
    }}>
      {icon && <Text style={{ fontSize: 11 }}>{icon}</Text>}
      <Text style={{ color, fontSize: 11, fontWeight: '600', letterSpacing: -0.1 }}>{children}</Text>
    </View>
  );
}

// ---------- Section header ----------
export function Section({ title, hint, onHintPress, children, style }: {
  title: string;
  hint?: string;
  onHintPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: spacing.xl }, style]}>
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10, paddingHorizontal: 2,
      }}>
        <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
        {hint && (
          <Pressable onPress={onHintPress} disabled={!onHintPress}>
            <Text style={{ fontSize: 12, color: colors.textSub }}>
              {hint} {onHintPress && <Text style={{ fontSize: 10 }}>›</Text>}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

// ---------- Stat ----------
export function Stat({ label, value, unit, color = colors.primary }: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: colors.textSub, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color, letterSpacing: -0.5 }}>{value}</Text>
        {unit && <Text style={{ fontSize: 11, color: colors.textSub, fontWeight: '600' }}>{unit}</Text>}
      </View>
    </View>
  );
}

// ---------- Card (shared) ----------
export function Card({ children, style, onPress }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = (
    <View style={[cardStyles.base, style]}>{children}</View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}

const cardStyles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#2C2420',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});

// ---------- utils ----------
export function fmtTimeLeft(h: number): string {
  const d = Math.floor(h / 24);
  const hh = h % 24;
  if (d > 0) return `${d}일 ${hh}시간`;
  return `${hh}시간`;
}

export function fmtRemaining(expiresAt: number): { label: string; urgent: boolean } {
  const ms = Math.max(0, expiresAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const urgent = h < 24;
  if (h === 0) return { label: `${m}분`, urgent: true };
  return { label: fmtTimeLeft(h), urgent };
}
