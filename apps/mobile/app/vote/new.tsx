import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

export default function NewVote() {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!question.trim()) {
      Alert.alert('질문 필요', '찬반으로 답할 수 있는 질문을 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post<{ id: string }>('/votes', { question, description });
      router.replace(`/vote/${r.id}`);
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>질문</Text>
      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="예) 이혼 후 1년 내 재연애, 괜찮다?"
        placeholderTextColor={colors.textSub}
        editable={!loading}
      />

      <Text style={styles.label}>설명 (선택)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="맥락이나 고민을 덧붙여주세요"
        placeholderTextColor={colors.textSub}
        multiline
        textAlignVertical="top"
        editable={!loading}
      />

      <Pressable style={[styles.cta, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>투표 만들기</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  label: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  textarea: { minHeight: 120 },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { ...typography.h3, color: '#fff' },
});
