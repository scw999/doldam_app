import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography, shadow } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { Card, VerifiedBadge, Stat } from '@/ui/atoms';
import { useAuth } from '@/store/auth';
import { api } from '@/api';

interface Me {
  id: string; nickname: string;
  gender: 'M' | 'F'; age_range: string; region: string;
  verified: number; created_at: number;
}

export default function MyScreen() {
  const clear = useAuth((s) => s.clear);
  const [me, setMe] = useState<Me | null>(null);
  const [balance, setBalance] = useState(0);
  const [postCount, setPostCount] = useState<number>(0);
  const [badgeCount, setBadgeCount] = useState(1);

  const load = useCallback(async () => {
    try {
      const [meRes, pts, myPosts] = await Promise.all([
        api.get<Me>('/auth/me'),
        api.get<{ balance: number }>('/points/balance'),
        api.get<{ items: unknown[] }>('/posts/mine').catch(() => ({ items: [] })),
      ]);
      setMe(meRes);
      setBalance(pts.balance);
      setPostCount(myPosts.items.length);
    } catch (e) {
      Alert.alert('오류', '정보를 불러올 수 없어요');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function logout() {
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => clear() },
    ]);
  }

  function deleteAccount() {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 정말 삭제하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/auth/me');
              clear();
            } catch {
              Alert.alert('오류', '계정 삭제에 실패했어요. 고객센터에 문의해주세요.');
            }
          },
        },
      ]
    );
  }

  const BADGES = [
    { e: '✓', label: '본인인증', color: '#6BAF7B', unlocked: me?.verified === 1 },
    { e: '🌱', label: '첫 글',    color: '#C4956A', unlocked: postCount > 0 },
    { e: '💬', label: '댓글 시작', color: '#5B8FC9', unlocked: balance >= 3 },
    { e: '🔥', label: '핫글 주인', color: '#E85D4A', unlocked: false },
    { e: '🏆', label: '7일 연속', color: '#D4728C', unlocked: false },
  ];

  const unlockedCount = BADGES.filter(b => b.unlocked).length;
  const daysJoined = me ? Math.floor((Date.now() - me.created_at) / 86400000) : 0;

  const menu = [
    { icon: '📝', label: '내가 쓴 글', onPress: () => router.push('/my-posts' as any) },
    { icon: '🎨', label: '감정 타임라인', count: '기록하기', color: colors.green, onPress: () => router.push('/mood' as any) },
    { icon: '📖', label: 'Q&A 미션', count: '진행중', color: colors.primaryDark, onPress: () => router.push('/mission' as any) },
    { icon: '💎', label: '포인트 내역', count: `${balance}P`, color: colors.primary, onPress: () => router.push('/points' as any) },
    { icon: '🔔', label: '알림', onPress: () => router.push('/notifications' as any) },
    { icon: '✏️', label: '프로필 편집', onPress: () => router.push('/profile-edit' as any) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* 프로필 카드 */}
        <Card style={{ padding: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <LinearGradient
              colors={[colors.accent, colors.tag]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={{ fontSize: 30 }}>{me?.gender === 'M' ? '🌊' : '🌿'}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={[typography.h2, { color: colors.text, fontSize: 17 }]} numberOfLines={1}>
                  {me?.nickname ?? '...'}
                </Text>
                {me?.verified === 1 && <VerifiedBadge size={15} />}
              </View>
              <Text style={{ fontSize: 12, color: colors.textSub }}>
                {me ? `${me.gender === 'M' ? '남' : '여'} · ${me.age_range} · ${me.region}` : ''}
              </Text>
              {me && (
                <View style={{
                  marginTop: 6, alignSelf: 'flex-start',
                  backgroundColor: colors.accent,
                  paddingHorizontal: 10, paddingVertical: 3,
                  borderRadius: radius.full,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primaryDark }}>
                    가입 {daysJoined}일차
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.statRow, { borderTopColor: colors.border }]}>
            <Stat label="포인트" value={`${balance}`} unit="P" color={colors.primary} />
            <Stat label="가입" value={`${daysJoined}`} unit="일차" color={colors.female} />
            <Stat label="뱃지" value={`${unlockedCount}`} unit={` / ${BADGES.length}`} color={colors.green} />
          </View>
        </Card>

        {/* 뱃지 */}
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>내 뱃지</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {BADGES.map((b) => (
              <View key={b.label} style={{ alignItems: 'center', gap: 4, opacity: b.unlocked ? 1 : 0.35 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: b.unlocked ? b.color + '22' : colors.tag,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: b.unlocked ? b.color + '55' : colors.border,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: b.unlocked ? b.color : colors.textLight }}>
                    {b.unlocked ? b.e : '🔒'}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textSub }}>{b.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* 메뉴 리스트 */}
        <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
          {menu.map((m, i) => (
            <Pressable
              key={m.label}
              onPress={m.onPress}
              style={[styles.menuRow, i < menu.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <Text style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{m.icon}</Text>
              <Text style={{ flex: 1, fontSize: 14, color: colors.text, letterSpacing: -0.2 }}>{m.label}</Text>
              {m.count && (
                <Text style={{ fontSize: 12, color: m.color ?? colors.textSub, fontWeight: '500' }}>{m.count}</Text>
              )}
              <Text style={{ fontSize: 14, color: colors.textLight }}>›</Text>
            </Pressable>
          ))}
        </Card>

        {/* 계정 관리 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 16 }}>
          <Pressable onPress={logout}>
            <Text style={{ fontSize: 13, color: colors.textSub }}>로그아웃</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: colors.border }}>|</Text>
          <Pressable onPress={deleteAccount}>
            <Text style={{ fontSize: 13, color: colors.error }}>계정 삭제</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary + '40',
  },
  statRow: {
    marginTop: 18, paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row', justifyContent: 'space-around',
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
  },
});
