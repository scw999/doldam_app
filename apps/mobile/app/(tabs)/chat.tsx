import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { Card, fmtRemaining } from '@/ui/atoms';
import { api } from '@/api';

interface Room {
  id: string; theme: string; gender_mix: string; kind: 'normal' | 'themed';
  member_count: number; created_at: number; expires_at: number; status: string;
}

type Tab = 'my' | 'theme' | 'match';

export default function ChatScreen() {
  const [tab, setTab] = useState<Tab>('my');
  const [balance, setBalance] = useState(0);
  const [mine, setMine] = useState<Room[]>([]);
  const [themed, setThemed] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t, pts] = await Promise.all([
        api.get<{ items: Room[] }>('/rooms/mine'),
        api.get<{ items: Room[] }>('/rooms/themed'),
        api.get<{ balance: number }>('/points/balance'),
      ]);
      setMine(m.items); setThemed(t.items); setBalance(pts.balance);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function requestMatch() {
    setMatching(true);
    try {
      await api.post('/rooms/match', {});
      Alert.alert('매칭 대기', '6명이 모이면 방이 열려요');
    } catch (e) { Alert.alert('실패', (e as Error).message); }
    finally { setMatching(false); }
  }

  async function joinThemed(id: string) {
    try {
      await api.post(`/rooms/themed/${id}/join`, {});
      router.push(`/room/${id}`);
    } catch (e) { Alert.alert('실패', (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} />

      <View style={styles.tabRow}>
        {([
          { id: 'my', label: '내 방', count: mine.length },
          { id: 'theme', label: '🔥 테마방', count: themed.length },
          { id: 'match', label: '매칭' },
        ] as const).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingVertical: 8, marginRight: 14,
              borderBottomWidth: 2,
              borderBottomColor: tab === t.id ? colors.primary : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text style={{
              fontSize: 14, fontWeight: tab === t.id ? '700' : '500',
              color: tab === t.id ? colors.text : colors.textSub,
            }}>
              {t.label}{t.count !== undefined && <Text style={{ fontSize: 11, color: colors.textLight }}> {t.count}</Text>}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'my' && (
        <FlatList
          contentContainerStyle={{ padding: 20, gap: 12 }}
          data={mine}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={
            loading
              ? <ActivityIndicator style={{ marginTop: spacing.xxl }} />
              : <Text style={styles.empty}>아직 참여 중인 방이 없어요</Text>
          }
          renderItem={({ item: r }) => <RoomCard room={r} onPress={() => router.push(`/room/${r.id}`)} />}
        />
      )}

      {tab === 'theme' && (
        <FlatList
          contentContainerStyle={{ padding: 20, gap: 12 }}
          data={themed}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={
            <View style={{
              padding: 20, backgroundColor: colors.card, borderRadius: radius.lg,
              borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12, color: colors.textSub, textAlign: 'center', lineHeight: 20 }}>
                🔥 핫 투표 500명+ 참여시{'\n'}테마방이 자동으로 열려요
              </Text>
            </View>
          }
          renderItem={({ item: r }) => <RoomCard room={r} onPress={() => joinThemed(r.id)} />}
        />
      )}

      {tab === 'match' && (
        <View style={{ padding: 20 }}>
          <LinearGradient
            colors={[colors.primaryDark, colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.matchHero}
          >
            <Text style={{ fontSize: 34, marginBottom: 14 }}>🫂</Text>
            <Text style={{
              fontSize: 19, fontWeight: '700', color: '#fff',
              letterSpacing: -0.5, lineHeight: 26, marginBottom: 8,
            }}>
              6~8명이 모이는{'\n'}작은 소그룹, 3일
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)', lineHeight: 21, marginBottom: 20 }}>
              연령·성별·지역이 비슷한 사람들과{'\n'}
              익명으로 대화해보세요.{'\n'}
              유지 투표로 이어가거나, 200P로 부활도 가능.
            </Text>
            <Pressable
              onPress={requestMatch}
              disabled={matching}
              style={{
                backgroundColor: '#fff', padding: 14,
                borderRadius: 12, alignItems: 'center',
                opacity: matching ? 0.6 : 1,
              }}
            >
              {matching
                ? <ActivityIndicator color={colors.primaryDark} />
                : <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primaryDark }}>지금 매칭 시작</Text>}
            </Pressable>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  const { label, urgent } = fmtRemaining(room.expires_at);
  return (
    <Card onPress={onPress} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {room.kind === 'themed' && <Text style={{ fontSize: 14 }}>🔥</Text>}
        <Text style={[typography.h3, { color: colors.text, fontSize: 14.5, flex: 1 }]} numberOfLines={1}>
          {room.theme || '소그룹'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 11, color: colors.textLight }}>👥 {room.member_count}/8</Text>
        <View style={{ flex: 1 }} />
        <Text style={{
          fontSize: 11, fontWeight: urgent ? '700' : '500',
          color: urgent ? colors.badge : colors.textSub,
        }}>⏱ {label}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  empty: { textAlign: 'center', color: colors.textSub, marginTop: spacing.xxl, fontSize: 14 },
  matchHero: {
    borderRadius: radius.lg, padding: 28,
    shadowColor: '#A07850', shadowOpacity: 0.25,
    shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
