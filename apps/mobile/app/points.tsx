import { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, Pressable, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, radius, typography } from '@/theme';
import { Card } from '@/ui/atoms';
import { api } from '@/api';

interface Ledger {
  id: string; amount: number; reason: string; created_at: number; expires_at: number;
}

const PRODUCTS = [
  { id: 'doldam.points.500',  points: 500,  price: '1,200원', badge: '' },
  { id: 'doldam.points.1200', points: 1200, price: '2,900원', badge: '인기' },
  { id: 'doldam.points.3000', points: 3000, price: '6,900원', badge: '' },
  { id: 'doldam.points.8000', points: 8000, price: '18,000원', badge: '베스트' },
];

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

  function onBuy(p: typeof PRODUCTS[0]) {
    Alert.alert(
      `${p.points.toLocaleString()}P 충전`,
      `${p.price}로 ${p.points.toLocaleString()}P를 충전할까요?\n(앱 스토어 결제 페이지로 이동)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '충전하기',
          onPress: () => Alert.alert('준비 중', '스토어 출시 후 이용 가능합니다'),
        },
      ]
    );
  }

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

      {/* 포인트 구매 */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: 10 }]}>포인트 충전</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRODUCTS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onBuy(p)}
              style={{
                flex: 1, minWidth: '44%',
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: p.badge ? colors.primary : colors.border,
                borderRadius: radius.lg,
                padding: 14,
                alignItems: 'center', gap: 4,
              }}
            >
              {p.badge ? (
                <View style={{
                  position: 'absolute', top: -1, right: -1,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 7, paddingVertical: 2,
                  borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{p.badge}</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, letterSpacing: -0.5 }}>
                {p.points.toLocaleString()}P
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSub, fontWeight: '500' }}>{p.price}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
          포인트는 충전 후 30일 내 사용하세요
        </Text>
      </View>

      <Text style={[typography.h3, { color: colors.text, paddingHorizontal: 20, marginBottom: 6 }]}>내역</Text>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 40, paddingTop: 4 }}
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
