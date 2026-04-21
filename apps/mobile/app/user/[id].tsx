import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { getDivorceTitle } from '@/utils/divorce';

interface Profile {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  age_range: string;
  region: string;
  divorce_year: number | null;
  divorce_month: number | null;
  job: string | null;
  has_kids: number | null;
  intro: string | null;
  interests: string | null;
  unlocked: string[];
}

type Field = 'job' | 'has_kids' | 'intro' | 'interests';
const FIELD_LABELS: Record<Field, string> = {
  job: '직업',
  has_kids: '자녀 유무',
  intro: '자기소개',
  interests: '관심사',
};

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const p = await api.get<Profile>(`/profiles/${id}`);
    setProfile(p);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function unlock(field: Field) {
    Alert.alert('항목 열람', `포인트 30P로 ${FIELD_LABELS[field]}을 열람할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '열람', onPress: async () => {
          try {
            await api.post(`/profiles/${id}/unlock`, { field });
            load();
          } catch (e) {
            Alert.alert('실패', (e as Error).message);
          }
        },
      },
    ]);
  }

  if (!profile) return <ActivityIndicator style={{ marginTop: 40 }} />;

  function renderField(key: Field) {
    const unlocked = profile!.unlocked.includes(key);
    const value = profile![key];
    return (
      <View style={styles.row} key={key}>
        <Text style={styles.label}>{FIELD_LABELS[key]}</Text>
        {unlocked ? (
          <Text style={styles.value}>
            {key === 'has_kids' ? (value ? '자녀 있음' : '자녀 없음') : String(value ?? '-')}
          </Text>
        ) : (
          <Pressable style={styles.lockBtn} onPress={() => unlock(key)}>
            <Text style={styles.lockText}>🔒 30P</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.nick}>{profile.nickname}</Text>
        <Text style={styles.meta}>
          {profile.gender === 'M' ? '남성' : '여성'} · {profile.region}
        </Text>
        {getDivorceTitle(profile.divorce_year, profile.divorce_month, profile.gender) && (
          <View style={styles.divorceBadge}>
            <Text style={styles.divorceBadgeText}>{getDivorceTitle(profile.divorce_year, profile.divorce_month, profile.gender)}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        {(['job', 'has_kids', 'intro', 'interests'] as Field[]).map(renderField)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.bg, flexGrow: 1 },
  hero: { alignItems: 'center', padding: spacing.lg },
  nick: { ...typography.h1, color: colors.primary, marginBottom: spacing.xs },
  meta: { ...typography.body, color: colors.textSub, marginBottom: spacing.sm },
  divorceBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary + '20',
    borderWidth: 1, borderColor: colors.primary + '60',
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  divorceBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  label: { ...typography.body, color: colors.textSub },
  value: { ...typography.body, color: colors.text, maxWidth: '60%', textAlign: 'right' },
  lockBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  lockText: { ...typography.caption, color: '#fff' },
});
