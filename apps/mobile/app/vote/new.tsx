import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

const MAX_OPTIONS = 6;

export default function NewVote() {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'binary' | 'multi'>('binary');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  function setOption(idx: number, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  }

  function addOption() {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, '']);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!question.trim()) {
      Alert.alert('질문 필요', '투표 질문을 입력해주세요');
      return;
    }
    if (mode === 'multi') {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2) {
        Alert.alert('선택지 필요', '선택지를 2개 이상 입력해주세요');
        return;
      }
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { question, description };
      if (mode === 'multi') {
        body.options = options.map((o) => o.trim()).filter(Boolean);
      }
      const r = await api.post<{ id: string }>('/votes', body);
      router.replace(`/vote/${r.id}`);
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* 모드 토글 */}
      <View style={styles.modeRow}>
        {(['binary', 'multi'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m === 'binary' ? '⭕❌ 찬반' : '📋 선택형'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>질문</Text>
      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder={mode === 'binary' ? '예) 이혼 후 1년 내 재연애, 괜찮다?' : '예) 이혼 후 가장 힘든 건?'}
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

      {mode === 'multi' && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={styles.label}>선택지 ({options.length}/{MAX_OPTIONS})</Text>
          {options.map((opt, idx) => (
            <View key={idx} style={styles.optionRow}>
              <View style={styles.optionNum}>
                <Text style={styles.optionNumText}>{idx + 1}</Text>
              </View>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={opt}
                onChangeText={(v) => setOption(idx, v)}
                placeholder={`선택지 ${idx + 1}`}
                placeholderTextColor={colors.textSub}
                editable={!loading}
              />
              {options.length > 2 && (
                <Pressable onPress={() => removeOption(idx)} style={styles.removeBtn}>
                  <Text style={{ fontSize: 16, color: colors.textSub }}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
          {options.length < MAX_OPTIONS && (
            <Pressable onPress={addOption} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ 선택지 추가</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable style={[styles.cta, loading && { opacity: 0.6 }, { marginTop: spacing.lg }]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>투표 만들기</Text>}
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  modeRow: {
    flexDirection: 'row', gap: 10, marginBottom: spacing.md,
    backgroundColor: colors.tag, borderRadius: radius.md, padding: 4,
  },
  modeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  modeBtnTextActive: { color: colors.primaryDark },
  label: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  textarea: { minHeight: 100 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  optionNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary + '55',
  },
  optionNumText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  removeBtn: { padding: 8 },
  addBtn: {
    marginTop: 4, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    borderStyle: 'dashed', alignItems: 'center',
  },
  addBtnText: { fontSize: 13, color: colors.textSub, fontWeight: '600' },
  cta: {
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md, alignItems: 'center',
  },
  ctaText: { ...typography.h3, color: '#fff' },
});
