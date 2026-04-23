import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { Card, Pill } from '@/ui/atoms';
import { api } from '@/api';

interface Vote {
  id: string; question: string; description?: string;
  options?: string | null;
  total: number; agree: number; disagree: number;
  created_at: number;
}

type GenderFilter = 'all' | 'M' | 'F';

const voteCache: Record<string, { items: Vote[]; hot3Count: number; ts: number }> = {};
const VOTE_CACHE_TTL = 60_000;

export function clearVoteCache() {
  for (const key of Object.keys(voteCache)) delete voteCache[key];
}

export default function VoteScreen() {
  const hasUnread = useUnreadCount();
  const [filter, setFilter] = useState<GenderFilter>('all');
  const [items, setItems] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [hot3Count, setHot3Count] = useState(0);

  const load = useCallback(async () => {
    const cached = voteCache[filter];
    const isFresh = cached && Date.now() - cached.ts < VOTE_CACHE_TTL;
    if (isFresh) { setItems(cached.items); setHot3Count(cached.hot3Count); } else { setLoading(true); }
    try {
      const genderParam = filter !== 'all' ? `?gender=${filter}` : '';
      const [votes, pts] = await Promise.all([
        api.get<{ items: Vote[] }>(`/votes${genderParam}`, { cacheTtl: 0 }),
        api.get<{ balance: number }>('/points/balance', { cacheTtl: 0 }),
      ]);
      const all = votes.items;
      // Pin top 3 most-voted at top, rest in latest order (API returns latest first)
      const byTotal = [...all].sort((a, b) => b.total - a.total);
      const hot3 = byTotal.filter(v => v.total > 0).slice(0, 3);
      const h3Count = hot3.length;
      const hot3Ids = new Set(hot3.map(v => v.id));
      const rest = all.filter(v => !hot3Ids.has(v.id)); // already in date order from API
      const finalList = [...hot3, ...rest];
      voteCache[filter] = { items: finalList, hot3Count: h3Count, ts: Date.now() };
      setItems(finalList);
      setHot3Count(h3Count);
      setBalance(pts.balance);
    } finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} hasNewNotification={hasUnread} />

      <View style={styles.filterRow}>
        {([
          { id: 'all', label: '전체' },
          { id: 'M', label: '남성만' },
          { id: 'F', label: '여성만' },
        ] as const).map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={{
              paddingHorizontal: 14, paddingVertical: 7,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: filter === f.id ? colors.text : colors.border,
              backgroundColor: filter === f.id ? colors.text : colors.card,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '500',
              color: filter === f.id ? '#fff' : colors.textSub,
            }}>{f.label}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, color: colors.textLight, alignSelf: 'center' }}>
          {items.length}개
        </Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 12 }}
        data={items}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: spacing.xxl }} />
            : <Text style={styles.empty}>첫 질문을 던져보세요</Text>
        }
        renderItem={({ item: v, index }) => {
          const isHotPinned = index < hot3Count && v.total > 0;
          const isMulti = !!v.options;
          const total = v.total;
          const pct = total && !isMulti ? Math.round((v.agree / total) * 100) : 0;
          return (
            <Card onPress={() => router.push(`/vote/${v.id}`)} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {isHotPinned && <Pill bg="#E85D4A18" color="#E85D4A" icon="🔥">HOT</Pill>}
                <Text style={{ fontSize: 11, color: colors.textSub }}>
                  {total > 0 ? `${total.toLocaleString()}명 참여` : '첫 참여자 기다리는 중'}
                </Text>
              </View>
              <Text style={[typography.h2, { color: colors.text, marginBottom: 14, lineHeight: 23 }]} numberOfLines={3}>
                {v.question}
              </Text>

              {isMulti ? (
                <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.tag, borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, color: colors.textSub }}>
                    {total > 0 ? `🔒 투표 후 결과 공개 · ${total}명 참여` : '📋 선택지 투표 · 탭해서 참여하기'}
                  </Text>
                </View>
              ) : total > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', height: 38, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.tag }}>
                    <View style={{ width: `${pct}%`, backgroundColor: colors.votePro + '35', justifyContent: 'center', paddingLeft: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.votePro }} numberOfLines={1}>⭕ 찬성</Text>
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12, backgroundColor: colors.voteCon + '20' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.voteCon }} numberOfLines={1}>반대 ❌</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ fontSize: 11, color: colors.votePro, fontWeight: '700' }}>{pct}%</Text>
                    <Text style={{ fontSize: 11, color: colors.voteCon, fontWeight: '700' }}>{100 - pct}%</Text>
                  </View>
                </>
              ) : (
                <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.tag, borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, color: colors.textSub }}>🔒 투표 후 결과 공개 · 첫 번째로 참여해보세요</Text>
                </View>
              )}
            </Card>
          );
        }}
      />

      <Pressable
        onPress={() => router.push('/vote/new')}
        style={styles.fab}
      >
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  empty: { textAlign: 'center', color: colors.textSub, marginTop: spacing.xxl, fontSize: 14 },
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
