import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

const CATEGORIES = [
  { id: 'free',       label: '자유톡',   color: '#6BAF7B' },
  { id: 'heart',      label: '속마음',   color: '#D4728C' },
  { id: 'kids',       label: '양육일기', color: '#5B8FC9' },
  { id: 'dating',     label: '연애/관계', color: '#C4956A' },
  { id: 'legal',      label: '법률/돈',  color: '#8C7B6B' },
  { id: 'men_only',   label: '🚹 남성방', color: '#5B8FC9' },
  { id: 'women_only', label: '🚺 여성방', color: '#D4728C' },
];

export default function NewPost() {
  const { category: paramCat = 'free' } = useLocalSearchParams<{ category: string }>();
  const [selectedCat, setSelectedCat] = useState(paramCat);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const availableCats = CATEGORIES;

  async function submit() {
    if (!title.trim() || !content.trim()) {
      Alert.alert('입력 필요', '제목과 본문을 채워주세요');
      return;
    }
    setLoading(true);
    try {
      const resp = await api.post<{ id: string }>('/posts', { title, content, category: selectedCat });
      router.replace(`/post/${resp.id}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('forbidden_category')) {
        Alert.alert('작성 불가', '해당 게시판은 지정된 성별만 글을 올릴 수 있어요');
      } else {
        Alert.alert('작성 실패', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const selCatInfo = CATEGORIES.find((c) => c.id === selectedCat);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        {/* 카테고리 선택 */}
        <Text style={styles.label}>게시판</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableCats.map((c) => {
              const active = selectedCat === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCat(c.id)}
                  style={[styles.catChip, active && { backgroundColor: c.color, borderColor: c.color }]}
                >
                  <Text style={[styles.catLabel, active && { color: '#fff', fontWeight: '700' }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력하세요"
          placeholderTextColor={colors.textSub}
          editable={!loading}
          maxLength={100}
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
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{selCatInfo?.label} · </Text>
              등록
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  label: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm, marginBottom: spacing.xs },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catLabel: { fontSize: 13, color: colors.text },
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
