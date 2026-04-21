import { useCallback, useState } from 'react';
import React from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { Card, Tag, CatChip, GenderDot, ReactionRow } from '@/ui/atoms';
import { api } from '@/api';
import { getDivorceTitle } from '@/utils/divorce';

interface Post {
  id: string; title: string; content: string; category: string;
  nickname: string; gender: 'M' | 'F'; age_range: string;
  divorce_year: number | null; divorce_month: number | null;
  like_count: number; comment_count: number; created_at: number;
}

// 앱 세션 동안 살아있는 모듈 레벨 캐시
const postCache: Record<string, { items: Post[]; ts: number }> = {};
const CACHE_TTL = 60_000; // 1분
let myGenderCache: 'M' | 'F' | null | undefined = undefined;

async function getMyGender(): Promise<'M' | 'F' | null> {
  if (myGenderCache !== undefined) return myGenderCache;
  try {
    const me = await api.get<{ gender: 'M' | 'F' }>('/auth/me');
    myGenderCache = me.gender;
  } catch {
    myGenderCache = null;
  }
  return myGenderCache;
}

const CATEGORIES = [
  { id: 'all',        label: '전체',     color: '#8C7B6B', genderOnly: null },
  { id: 'free',       label: '자유톡',   color: '#6BAF7B', genderOnly: null },
  { id: 'heart',      label: '속마음',   color: '#D4728C', genderOnly: null },
  { id: 'kids',       label: '양육일기', color: '#5B8FC9', genderOnly: null },
  { id: 'dating',     label: '연애/관계', color: '#C4956A', genderOnly: null },
  { id: 'legal',      label: '법률/돈',  color: '#8C7B6B', genderOnly: null },
  { id: 'men_only',   label: '남성방',   color: '#5B8FC9', genderOnly: 'M' as const },
  { id: 'women_only', label: '여성방',   color: '#D4728C', genderOnly: 'F' as const },
];

const RESTRICTED_MSG: Record<string, { title: string; body: string }> = {
  women_only: {
    title: '여성 전용 공간이에요',
    body: '이 글은 여성 회원들만의 이야기 공간이에요.\n서로의 공간을 소중히 여겨주세요 🌸',
  },
  men_only: {
    title: '남성 전용 공간이에요',
    body: '이 글은 남성 회원들만의 이야기 공간이에요.\n서로의 공간을 소중히 여겨주세요 🪨',
  },
};

function catInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function patchBoardPost(postId: string, patch: { like_count?: number }) {
  for (const key of Object.keys(postCache)) {
    const cached = postCache[key];
    if (!cached) continue;
    const idx = cached.items.findIndex((p) => p.id === postId);
    if (idx >= 0) cached.items[idx] = { ...cached.items[idx], ...patch };
  }
}

export default function BoardScreen() {
  const hasUnread = useUnreadCount();
  const [cat, setCat] = useState('free');
  const [balance, setBalance] = useState(0);
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (c: string) => {
    const cached = postCache[c];
    if (cached) {
      setItems(cached.items); // 캐시 즉시 표시
      setLoading(false);
    } else {
      setLoading(true);
    }
    // 항상 백그라운드 리프레시 (좋아요 카운트 등 최신 반영)
    try {
      const [posts, pts] = await Promise.all([
        api.get<{ items: Post[] }>(`/posts?category=${c}`),
        api.get<{ balance: number }>('/points/balance'),
      ]);
      postCache[c] = { items: posts.items, ts: Date.now() };
      setItems(posts.items);
      setBalance(pts.balance);
    } catch (e) { console.warn('board load', e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    load(cat);
    getMyGender(); // 미리 패치
  }, [cat, load]));

  async function onPressPost(post: Post) {
    const catMeta = CATEGORIES.find((c) => c.id === post.category);
    if (catMeta?.genderOnly) {
      const gender = await getMyGender();
      if (gender !== catMeta.genderOnly) {
        const msg = RESTRICTED_MSG[post.category];
        Alert.alert(msg.title, msg.body, [{ text: '확인' }]);
        return;
      }
    }
    router.push(`/post/${post.id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} hasNewNotification={hasUnread} />

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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 200, gap: 12 }}
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
            <Card onPress={() => onPressPost(p)} style={{ padding: 16 }}>
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
                  {p.nickname}{getDivorceTitle(p.divorce_year, p.divorce_month, p.gender) ? ` · ${getDivorceTitle(p.divorce_year, p.divorce_month, p.gender)}` : ''}
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
        <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>✏️</Text>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: -0.3 }}>글쓰기</Text>
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
    marginTop: 22, marginBottom: 16, padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.primary + '66', borderStyle: 'dashed',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  fab: {
    position: 'absolute', right: 20, bottom: 110,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 28,
    backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
