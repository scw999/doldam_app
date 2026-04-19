import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Card, Tag } from '@/ui/atoms';
import { api } from '@/api';

interface Post {
  id: string; title: string; content: string; category: string;
  like_count: number; comment_count: number; created_at: number;
}

const CAT: Record<string, { label: string; color: string }> = {
  free:       { label: '자유톡',   color: '#6BAF7B' },
  heart:      { label: '속마음',   color: '#D4728C' },
  kids:       { label: '양육일기', color: '#5B8FC9' },
  dating:     { label: '연애/관계', color: '#C4956A' },
  legal:      { label: '법률/돈',  color: '#8C7B6B' },
  men_only:   { label: '남성방',   color: '#5B8FC9' },
  women_only: { label: '여성방',   color: '#D4728C' },
};

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function MyPostsScreen() {
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: Post[] }>('/posts/mine');
      setItems(res.items);
    } catch {
      Alert.alert('오류', '내 글을 불러올 수 없어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        data={items}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 60 }} />
            : <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 60, fontSize: 14 }}>
                아직 작성한 글이 없어요
              </Text>
        }
        renderItem={({ item: p }) => {
          const c = CAT[p.category] ?? CAT.free;
          return (
            <Card onPress={() => router.push(`/post/${p.id}`)} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Tag label={c.label} color={c.color} />
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 11, color: colors.textLight }}>{timeAgo(p.created_at)}</Text>
              </View>
              <Text style={[typography.h3, { color: colors.text, marginBottom: 4 }]} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSub, lineHeight: 20, marginBottom: 10 }} numberOfLines={2}>
                {p.content}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ fontSize: 11, color: colors.textSub }}>💛 {p.like_count}</Text>
                <Text style={{ fontSize: 11, color: colors.textSub }}>💬 {p.comment_count}</Text>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
