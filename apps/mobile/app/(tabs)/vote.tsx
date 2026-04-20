import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { Card, Pill } from '@/ui/atoms';
import { api } from '@/api';

interface Vote {
  id: string; question: string; description?: string;
  total: number; agree: number; disagree: number;
  created_at: number;
}

type GenderFilter = 'all' | 'M' | 'F';

export default function VoteScreen() {
  const [filter, setFilter] = useState<GenderFilter>('all');
  const [items, setItems] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [votes, pts] = await Promise.all([
        api.get<{ items: Vote[] }>('/votes'),
        api.get<{ balance: number }>('/points/balance'),
      ]);
      setItems(votes.items);
      setBalance(pts.balance);
    } finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} />

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
        renderItem={({ item: v }) => {
          const total = v.total || v.agree + v.disagree;
          const pct = total ? Math.round((v.agree / total) * 100) : 0;
          const isHot = total >= 500;
          return (
            <Card onPress={() => router.push(`/vote/${v.id}`)} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {isHot && <Pill bg="#E85D4A18" color="#E85D4A" icon="🔥">HOT</Pill>}
                <Text style={{ fontSize: 11, color: colors.textSub }}>
                  {total.toLocaleString()}명
                </Text>
              </View>
              <Text style={[typography.h2, { color: colors.text, marginBottom: 14, lineHeight: 23 }]} numberOfLines={3}>
                {v.question}
              </Text>

              <View style={{ flexDirection: 'row', height: 38, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.tag }}>
                <View style={{
                  width: `${pct}%`, backgroundColor: colors.votePro + '35',
                  justifyContent: 'center', paddingLeft: 12,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.votePro }} numberOfLines={1}>⭕ 찬성</Text>
                </View>
                <View style={{
                  flex: 1, justifyContent: 'center', alignItems: 'flex-end',
                  paddingRight: 12, backgroundColor: colors.voteCon + '20',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.voteCon }} numberOfLines={1}>반대 ❌</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: colors.votePro, fontWeight: '700' }}>{pct}%</Text>
                <Text style={{ fontSize: 11, color: colors.voteCon, fontWeight: '700' }}>{100 - pct}%</Text>
              </View>
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
