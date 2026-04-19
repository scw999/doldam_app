import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

interface Round { id: string; started_at: number; expires_at: number }
interface Question { id: string; question: string; my_answer: string | null }
interface Progress { answered: number; total: number }

export default function MissionScreen() {
  const [round, setRound] = useState<Round | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<Progress>({ answered: 0, total: 10 });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get<{ round: Round; questions: Question[]; progress: Progress }>('/missions/current');
    setRound(r.round);
    setQuestions(r.questions);
    setProgress(r.progress);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submit(questionId: string) {
    const answer = drafts[questionId]?.trim();
    if (!answer || !round) return;
    setLoading(true);
    try {
      const r = await api.post<{ answered: number; rewarded: boolean }>(
        '/missions/answer',
        { roundId: round.id, questionId, answer }
      );
      setDrafts((d) => ({ ...d, [questionId]: '' }));
      if (r.rewarded) Alert.alert('🎉 미션 완료', '100 포인트가 적립되었습니다');
      load();
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Q&A 미션</Text>
      <Text style={styles.sub}>3일간 10개 답변 → 100P 적립</Text>

      <View style={styles.progress}>
        <View style={[styles.bar, { width: `${(progress.answered / progress.total) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{progress.answered} / {progress.total}</Text>

      {questions.map((q, idx) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.qIdx}>{idx + 1}</Text>
          <Text style={styles.q}>{q.question}</Text>

          {q.my_answer ? (
            <Text style={styles.answered}>✓ {q.my_answer}</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={drafts[q.id] ?? ''}
                onChangeText={(t) => setDrafts((d) => ({ ...d, [q.id]: t }))}
                placeholder="짧게라도 적어보세요"
                placeholderTextColor={colors.textSub}
                multiline
                editable={!loading}
              />
              <Pressable
                style={[styles.send, !drafts[q.id]?.trim() && { opacity: 0.5 }]}
                onPress={() => submit(q.id)}
                disabled={!drafts[q.id]?.trim() || loading}
              >
                <Text style={styles.sendText}>{loading ? '...' : '제출'}</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
      {questions.length === 0 && <ActivityIndicator style={{ marginTop: spacing.xl }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  sub: { ...typography.body, color: colors.textSub, marginBottom: spacing.md },
  progress: {
    height: 12, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden',
  },
  bar: { height: '100%', backgroundColor: colors.primary },
  progressText: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  qIdx: { ...typography.caption, color: colors.primary, marginBottom: spacing.xs },
  q: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, minHeight: 80, textAlignVertical: 'top',
  },
  send: {
    alignSelf: 'flex-end', marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  sendText: { color: '#fff', ...typography.body },
  answered: { ...typography.body, color: colors.success, backgroundColor: colors.background, padding: spacing.sm, borderRadius: radius.sm },
});
