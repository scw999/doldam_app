import { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing } from '@/theme';
import { Card } from '@/ui/atoms';
import { api } from '@/api';

interface Ledger {
  id: string; amount: number; reason: string; created_at: number; expires_at: number;
}

const REASON_LABEL: Record<string, string> = {
  signup_bonus:   '가입 보너스',
  post_create:    '게시글 작성',
  comment_create: '댓글 작성',
  mood_record:    '기분 기록',
  mission_reward: 'Q&A 미션 완료',
  profile_view:   '프로필 열람',
  room_revive:    '방 부활',
  vote_create:    '투표 생성',
};

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return '오늘';
  if (d === 1) return '어제';
  return `${d}일 전`;
}

function fmtExpiry(ts: number) {
  const d = Math.ceil((ts - Date.now()) / 86400000);
  if (d <= 0) return '만료됨';
  if (d <= 7) return `${d}일 후 만료`;
  return `${Math.ceil(d / 30)}개월 후 만료`;
}

export default function PointsScreen() {
  const [items, setItems] = useState<Ledger[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledger, pts] = await Promise.all([
        api.get<{ items: Ledger[] }>('/points/history'),
        api.get<{ balance: number }>('/points/balance'),
      ]);
      setItems(ledger.items);
      setBalance(pts.balance);
    } catch {
      Alert.alert('오류', '포인트 내역을 불러올 수 없어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 잔액 헤더 */}
      <View style={{
        margin: 20, padding: 20,
        backgroundColor: colors.primary, borderRadius: 16,
      }}>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>현재 잔액</Text>
        <Text style={{ fontSize: 36, fontWeight: '700', color: '#fff', letterSpacing: -1 }}>
          {balance}<Text style={{ fontSize: 18 }}> P</Text>
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
          포인트는 적립일로부터 30일 후 만료돼요
        </Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 40 }}
        data={items}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 40 }} />
            : <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 40, fontSize: 14 }}>
                포인트 내역이 없어요
              </Text>
        }
        renderItem={({ item: l }) => (
          <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: l.amount > 0 ? colors.green + '20' : colors.error + '20',
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}>
              <Text style={{ fontSize: 16 }}>{l.amount > 0 ? '⬆' : '⬇'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                {REASON_LABEL[l.reason] ?? l.reason}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                {timeAgo(l.created_at)} · {fmtExpiry(l.expires_at)}
              </Text>
            </View>
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: l.amount > 0 ? colors.green : colors.error,
            }}>
              {l.amount > 0 ? '+' : ''}{l.amount}P
            </Text>
          </Card>
        )}
      />
    </View>
  );
}
