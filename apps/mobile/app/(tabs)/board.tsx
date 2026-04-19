import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { Card, Tag, CatChip, GenderDot, ReactionRow } from '@/ui/atoms';
import { api } from '@/api';

interface Post {
  id: string; title: string; content: string; category: string;
  nickname: string; gender: 'M' | 'F'; age_range: string;
  like_count: number; comment_count: number; created_at: number;
}

const CATEGORIES = [
  { id: 'all',      label: '전체',     color: '#8C7B6B' },
  { id: 'free',     label: '자유톡',   color: '#6BAF7B' },
  { id: 'heart',    label: '속마음',   color: '#D4728C' },
  { id: 'kids',     label: '양육일기', color: '#5B8FC9' },
  { id: 'dating',   label: '연애/관계', color: '#C4956A' },
  { id: 'legal',    label: '법률/돈',  color: '#8C7B6B' },
  { id: 'men_only', label: '남성방',   color: '#5B8FC9' },
  { id: 'women_only', label: '여성방', color: '#D4728C' },
];

function catInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export default function BoardScreen() {
  const [cat, setCat] = useState('free');
  const [balance, setBalance] = useState(0);
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (c: string) => {
    setLoading(true);
    try {
      const query = c === 'all' ? '' : `?category=${c}`;
      const [posts, pts] = await Promise.all([
        api.get<{ items: Post[] }>(`/posts${query}`),
        api.get<{ balance: number }>('/points/balance'),
      ]);
      setItems(posts.items);
      setBalance(pts.balance);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(cat); }, [cat, load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}
      >
        {CATEGORIES.map((c) => (
          <CatChip key={c.id} label={c.label} color={c.color}
            active={cat === c.id} onPress={() => setCat(c.id)} />
        ))}
      </ScrollView>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 12 }}
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(cat); setRefreshing(false);
          }} />
        }
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: spacing.xxl }} />
            : <Text style={styles.empty}>아직 글이 없어요. 첫 글을 남겨보세요.</Text>
        }
        ListFooterComponent={
          <View style={styles.matchBanner}>
            <Text style={{ fontSize: 24 }}>🫂</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: -0.2 }}>
                이 주제로 대화하고 싶다면?
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                6~8명 소그룹 · 3일 후 자동 종료
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/chat')}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: radius.full,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>참여</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: p }) => {
          const c = catInfo(p.category);
          return (
            <Card onPress={() => router.push(`/post/${p.id}`)} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Tag label={c.label} color={c.color} />
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 11, color: colors.textLight }}>{timeAgo(p.created_at)}</Text>
              </View>
              <Text style={[typography.h2, { color: colors.text, marginBottom: 6, lineHeight: 23 }]} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSub, lineHeight: 21, marginBottom: 12 }} numberOfLines={2}>
                {p.content}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <GenderDot gender={p.gender} />
                <Text style={{ fontSize: 11, color: colors.textSub }}>
                  {p.nickname} · {p.age_range}
                </Text>
                <View style={{ flex: 1 }} />
                <ReactionRow reactions={{ '💛': p.like_count }} compact />
                <Text style={{ fontSize: 11, color: colors.textSub, marginLeft: 8 }}>💬 {p.comment_count}</Text>
              </View>
            </Card>
          );
        }}
      />

      <Pressable
        onPress={() => router.push({ pathname: '/post/new', params: { category: cat === 'all' ? 'free' : cat } })}
        style={styles.fab}
      >
        <Text style={{ color: '#fff', fontSize: 24, lineHeight: 28 }}>✎</Text>
      </Pressable>
    </View>
  );
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', color: colors.textSub, marginTop: spacing.xxl, fontSize: 14 },
  matchBanner: {
    marginTop: 22, padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.primary + '66', borderStyle: 'dashed',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  fab: {
    position: 'absolute', right: 20, bottom: 100,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#A07850', shadowOpacity: 0.32,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
