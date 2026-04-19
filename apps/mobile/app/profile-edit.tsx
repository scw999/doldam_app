import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { useAuth } from '@/store/auth';

export default function ProfileEdit() {
  const userId = useAuth((s) => s.userId);
  const [job, setJob] = useState('');
  const [hasKids, setHasKids] = useState<boolean | null>(null);
  const [intro, setIntro] = useState('');
  const [interests, setInterests] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.get<{
      job: string | null; has_kids: number | null;
      intro: string | null; interests: string | null;
    }>(`/profiles/${userId}`)
      .then((p) => {
        if (p.job) setJob(p.job);
        if (p.has_kids !== null) setHasKids(p.has_kids === 1);
        if (p.intro) setIntro(p.intro);
        if (p.interests) setInterests(p.interests);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function save() {
    setSaving(true);
    try {
      await api.put('/profiles/me', { job, hasKids, intro, interests });
      Alert.alert('저장 완료');
      router.back();
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setSaving(false); }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>직업</Text>
      <TextInput style={styles.input} value={job} onChangeText={setJob}
        placeholder="예: 회사원, 자영업, 프리랜서..." placeholderTextColor={colors.textSub} />

      <Text style={styles.label}>자녀 유무</Text>
      <View style={styles.row}>
        {[{ v: true, l: '있음' }, { v: false, l: '없음' }].map(({ v, l }) => (
          <Pressable key={l} onPress={() => setHasKids(v)}
            style={[styles.chip, hasKids === v && styles.chipOn]}>
            <Text style={[styles.chipText, hasKids === v && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>자기소개</Text>
      <TextInput style={[styles.input, styles.textarea]} value={intro} onChangeText={setIntro}
        placeholder="간단한 소개" placeholderTextColor={colors.textSub}
        multiline textAlignVertical="top" />

      <Text style={styles.label}>관심사</Text>
      <TextInput style={styles.input} value={interests} onChangeText={setInterests}
        placeholder="예: 캠핑, 영화, 요리 (쉼표 구분)" placeholderTextColor={colors.textSub} />

      <Pressable style={[styles.cta, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>저장</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.bg, flexGrow: 1 },
  label: { ...typography.caption, color: colors.textSub, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md,
  },
  textarea: { minHeight: 100 },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, color: colors.text },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', ...typography.h3 },
});
