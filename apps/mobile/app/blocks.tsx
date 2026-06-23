import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '@/theme';
import { api } from '@/api';

interface BlockedUser {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  age_range: string;
  region: string;
  created_at: number;
}

export default function BlocksScreen() {
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ items: BlockedUser[] }>('/blocks', { cacheTtl: 0 });
      setItems(res.items);
    } catch {
      Alert.alert('오류', '차단 목록을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function unblock(item: BlockedUser) {
    Alert.alert(
      '차단 해제',
      `${item.nickname} 님 차단을 해제할까요?\n해제 후 다시 글·댓글이 보입니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: async () => {
            try {
              await api.delete(`/blocks/${item.id}`);
              setItems((prev) => prev.filter((x) => x.id !== item.id));
            } catch {
              Alert.alert('오류', '잠시 후 다시 시도해주세요');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[s.container, { padding: spacing.xl }]}>
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>🤝</Text>
          <Text style={s.emptyTitle}>차단한 사용자가 없어요</Text>
          <Text style={s.emptyText}>
            글·댓글·프로필에서 차단하면 여기에 표시돼요.{'\n'}
            차단하면 서로의 글·댓글이 보이지 않습니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={s.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      data={items}
      keyExtractor={(x) => x.id}
      renderItem={({ item }) => (
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.nickname}>{item.nickname}</Text>
            <Text style={s.meta}>
              {item.gender === 'M' ? '남' : '여'} · {item.age_range} · {item.region}
            </Text>
          </View>
          <Pressable onPress={() => unblock(item)} style={s.unblockBtn}>
            <Text style={s.unblockText}>해제</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  nickname: { ...typography.h3, color: colors.text },
  meta: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.tag,
  },
  unblockText: { fontSize: 13, color: colors.text, fontWeight: '600' },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 13, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
});
