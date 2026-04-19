import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

type Mood = 'good' | 'soso' | 'sad' | 'angry' | 'anxious' | 'hopeful' | 'lonely';
type Visibility = 'private' | 'friends' | 'public';

const MOODS: { k: Mood; label: string; emoji: string }[] = [
  { k: 'good', label: '좋음', emoji: '😊' },
  { k: 'hopeful', label: '희망', emoji: '🌱' },
  { k: 'soso', label: '보통', emoji: '😐' },
  { k: 'sad', label: '슬픔', emoji: '😢' },
  { k: 'lonely', label: '외로움', emoji: '🌙' },
  { k: 'anxious', label: '불안', emoji: '😟' },
  { k: 'angry', label: '화남', emoji: '😠' },
];

interface MoodItem { mood: string; note?: string; created_at: number; nickname?: string; age_range?: string }

export default function MoodScreen() {
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [sending, setSending] = useState(false);
  const [feed, setFeed] = useState<MoodItem[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: MoodItem[] }>('/moods/feed');
      setFeed(r.items);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submit() {
    if (!mood) return Alert.alert('선택 필요', '지금 기분을 골라주세요');
    setSending(true);
    try {
      await api.post('/moods', { mood, note, visibility });
      setMood(null); setNote('');
      load();
      Alert.alert('기록 완료', visibility === 'public' ? '피드에 공유되었어요' : '저장되었어요');
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setSending(false); }
  }

  function emoji(k: string): string {
    return MOODS.find((m) => m.k === k)?.emoji ?? '•';
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>지금 기분은?</Text>
      <View style={styles.moodGrid}>
        {MOODS.map((m) => (
          <Pressable
            key={m.k}
            onPress={() => setMood(m.k)}
            style={[styles.moodChip, mood === m.k && styles.moodChipOn]}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text style={[styles.moodLabel, mood === m.k && { color: '#fff' }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.note}
        value={note}
        onChangeText={setNote}
        placeholder="한 줄 메모 (선택)"
        placeholderTextColor={colors.textSub}
        multiline
      />

      <View style={styles.visRow}>
        {(['private', 'friends', 'public'] as Visibility[]).map((v) => (
          <Pressable key={v} onPress={() => setVisibility(v)} style={[styles.visChip, visibility === v && styles.visOn]}>
            <Text style={[styles.visText, visibility === v && { color: '#fff' }]}>
              {v === 'private' ? '나만' : v === 'friends' ? '친구' : '전체'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.cta, (sending || !mood) && { opacity: 0.5 }]} onPress={submit} disabled={sending || !mood}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>기록하기</Text>}
      </Pressable>

      <Text style={styles.section}>전체 피드</Text>
      {feed.map((m, i) => (
        <View key={i} style={styles.feedCard}>
          <Text style={styles.feedMood}>{emoji(m.mood)} {m.nickname} · {m.age_range}</Text>
          {m.note && <Text style={styles.feedNote}>{m.note}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md, marginBottom: spacing.md },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moodChip: {
    width: '30%', padding: spacing.sm, alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  moodChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodEmoji: { fontSize: 28, marginBottom: 4 },
  moodLabel: { ...typography.caption, color: colors.text },
  note: {
    ...typography.body, color: colors.text, marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, minHeight: 60, textAlignVertical: 'top',
  },
  visRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  visChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  visOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  visText: { ...typography.caption, color: colors.text },
  cta: {
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center',
  },
  ctaText: { color: '#fff', ...typography.h3 },
  section: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  feedCard: {
    backgroundColor: colors.card, padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  feedMood: { ...typography.body, color: colors.text },
  feedNote: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
});
