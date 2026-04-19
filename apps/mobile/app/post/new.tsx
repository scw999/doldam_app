import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

export default function NewPost() {
  const { category = 'free' } = useLocalSearchParams<{ category: string }>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim() || !content.trim()) {
      Alert.alert('입력 필요', '제목과 본문을 채워주세요');
      return;
    }
    setLoading(true);
    try {
      const resp = await api.post<{ id: string }>('/posts', { title, content, category });
      router.replace(`/post/${resp.id}`);
    } catch (e) {
      Alert.alert('작성 실패', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>제목</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="제목을 입력하세요"
        placeholderTextColor={colors.textSub}
        editable={!loading}
      />

      <Text style={styles.label}>본문</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={content}
        onChangeText={setContent}
        placeholder="연락처, 카톡 아이디 등 개인정보는 자동 차단됩니다"
        placeholderTextColor={colors.textSub}
        multiline
        textAlignVertical="top"
        editable={!loading}
      />

      <Pressable style={[styles.cta, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>등록</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  label: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  textarea: { minHeight: 200 },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { ...typography.h3, color: '#fff' },
});
