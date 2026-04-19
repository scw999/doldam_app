import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { useAuth } from '@/store/auth';

type Gender = 'M' | 'F';
type AgeRange = '20s' | '30s' | '40s' | '50s+';

const AGES: AgeRange[] = ['20s', '30s', '40s', '50s+'];
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '기타'];

export default function OnboardingScreen() {
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUser = useAuth((s) => s.setUser);

  async function onSubmit() {
    if (!gender || !ageRange || !region) {
      Alert.alert('입력 필요', '모든 항목을 선택해주세요');
      return;
    }
    setLoading(true);
    try {
      const resp = await api.post<{ userId: string; nickname: string; token: string }>(
        '/auth/signup',
        { gender, ageRange, region },
        { auth: 'temp' }
      );
      await setUser(resp.token, resp.userId);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('가입 실패', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>프로필 설정</Text>
      <Text style={styles.sub}>별명은 자동으로 만들어져요.</Text>

      <Text style={styles.label}>성별</Text>
      <View style={styles.row}>
        {(['M', 'F'] as Gender[]).map((g) => (
          <Chip key={g} label={g === 'M' ? '남성' : '여성'} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>

      <Text style={styles.label}>나이대</Text>
      <View style={styles.row}>
        {AGES.map((a) => (
          <Chip key={a} label={a} selected={ageRange === a} onPress={() => setAgeRange(a)} />
        ))}
      </View>

      <Text style={styles.label}>지역</Text>
      <View style={styles.rowWrap}>
        {REGIONS.map((r) => (
          <Chip key={r} label={r} selected={region === r} onPress={() => setRegion(r)} />
        ))}
      </View>

      <Pressable style={[styles.cta, loading && { opacity: 0.6 }]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>돌담 시작하기</Text>}
      </Pressable>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  sub: { ...typography.body, color: colors.textSub, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, color: colors.text },
  chipTextOn: { color: '#fff' },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { ...typography.h3, color: '#fff' },
});
