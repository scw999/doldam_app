import { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, Pressable, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, radius, typography } from '@/theme';
import { Card } from '@/ui/atoms';
import { api } from '@/api';

interface Ledger {
  id: string; amount: number; reason: string; created_at: number; expires_at: number;
  kind?: 'free' | 'paid' | 'spend';
}

const PRODUCTS = [
  { id: 'doldam.points.500',  points: 500,  price: '1,200원', badge: '' },
  { id: 'doldam.points.1200', points: 1200, price: '2,900원', badge: '인기' },
  { id: 'doldam.points.3000', points: 3000, price: '6,900원', badge: '' },
  { id: 'doldam.points.8000', points: 8000, price: '18,000원', badge: '베스트' },
];

const REASON_LABEL: Record<string, string> = {
  signup_bonus:    '가입 보너스',
  post_create:     '게시글 작성',
  comment_create:  '댓글 작성',
  mood_record:     '기분 기록',
  mission_reward:  'Q&A 미션 완료',
  profile_view:    '프로필 열람',
  room_revive:     '방 부활 (-200P)',
  vote_create:     '투표 생성',
  vote_cast:       '투표 참여',
  chat_join:       '채팅 참여',
  purchase:        '포인트 충전',
  reaction_give:   '반응 남기기',
  daily_bonus:     '일일 보너스',
  referral:        '친구 초대',
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

// 내역 한 줄의 부가설명 (종류·만료) — 유상/무상/사용을 구분해 표시
function ledgerMeta(l: Ledger): string {
  if (l.amount < 0 || l.kind === 'spend') return timeAgo(l.created_at);
  if (l.kind === 'paid') return `${timeAgo(l.created_at)} · 유상 · 장기 보관`;
  return `${timeAgo(l.created_at)} · 무상 · ${fmtExpiry(l.expires_at)}`;
}

export default function PointsScreen() {
  const [items, setItems] = useState<Ledger[]>([]);
  const [balance, setBalance] = useState(0);
  const [paid, setPaid] = useState(0);
  const [free, setFree] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledger, pts] = await Promise.all([
        api.get<{ items: Ledger[] }>('/points/history'),
        api.get<{ balance: number; paid: number; free: number }>('/points/balance'),
      ]);
      setItems(ledger.items);
      setBalance(pts.balance);
      setPaid(pts.paid ?? 0);
      setFree(pts.free ?? 0);
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

        {/* 유상/무상 분리 */}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          <View>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>유상 (결제)</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{paid} P</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <View>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>무상 (적립)</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{free} P</Text>
          </View>
        </View>

        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>
          무상 포인트는 적립일로부터 30일 후 만료돼요{'\n'}유상(결제) 포인트는 5년간 유효해요
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
          충전한 포인트(유상)는 5년간 유효해요
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
                {ledgerMeta(l)}
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
