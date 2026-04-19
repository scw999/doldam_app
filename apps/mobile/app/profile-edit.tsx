import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

export default function ProfileEdit() {
  const [job, setJob] = useState('');
  const [hasKids, setHasKids] = useState<boolean | null>(null);
  const [intro, setIntro] = useState('');
  const [interests, setInterests] = useState('');
  const [saving, setSaving] = useState(false);

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
  container: { padding: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
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
