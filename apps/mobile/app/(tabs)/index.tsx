import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, typography, shadow } from '@/theme';
import { BrandBar } from '@/ui/BrandBar';
import { Section, Card, Tag, ReactionRow, Progress } from '@/ui/atoms';
import { api } from '@/api';

interface Me { nickname: string }
interface Vote { id: string; question: string; total: number; agree: number; disagree: number }
interface Post {
  id: string; title: string; content: string; category: string;
  nickname: string; gender: 'M' | 'F'; age_range: string;
  like_count: number; comment_count: number; created_at: number;
}

const MOODS = [
  { e: '🌤️', label: '괜찮아요' },
  { e: '😔', label: '울적해요' },
  { e: '😤', label: '답답해요' },
  { e: '😭', label: '무너져요' },
  { e: '🔥', label: '열받아요' },
  { e: '🌱', label: '희망보여요' },
  { e: '😶', label: '멍해요' },
];

const CATEGORY_COLORS: Record<string, { label: string; color: string }> = {
  free: { label: '자유톡', color: '#6BAF7B' },
  heart: { label: '속마음', color: '#D4728C' },
  kids: { label: '양육일기', color: '#5B8FC9' },
  dating: { label: '연애/관계', color: '#C4956A' },
  legal: { label: '법률/돈', color: '#8C7B6B' },
  men_only: { label: '남성방', color: '#5B8FC9' },
  women_only: { label: '여성방', color: '#D4728C' },
};

export default function HomeScreen() {
  const [me, setMe] = useState<Me | null>(null);
  const [balance, setBalance] = useState(0);
  const [topVotes, setTopVotes] = useState<Vote[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [mood, setMood] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meRes, pts, votes, board] = await Promise.all([
        api.get<Me>('/auth/me'),
        api.get<{ balance: number }>('/points/balance'),
        api.get<{ items: Vote[] }>('/votes?limit=3'),
        api.get<{ items: Post[] }>('/posts?limit=2'),
      ]);
      setMe(meRes); setBalance(pts.balance);
      setTopVotes(votes.items); setPosts(board.items);
    } catch (e) { console.warn('home load', e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function selectMood(i: number) {
    setMood(i);
    try {
      await api.post('/moods', { mood: ['good', 'sad', 'angry', 'sad', 'angry', 'hopeful', 'soso'][i], visibility: 'private' });
      setToast('+3P 기분 기록 완료');
      setTimeout(() => setToast(null), 1800);
    } catch {}
  }

  const nick = me?.nickname?.split(' ')[0] ?? '';
  const dateStr = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  const nextMilestone = Math.max(0, 200 - balance);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandBar points={balance} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }
      >
        {/* 인사말 */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ fontSize: 13, color: colors.textSub, marginBottom: 4 }}>{dateStr}</Text>
          <Text style={[typography.h1, { color: colors.text, lineHeight: 30 }]}>
            오늘은 어떤 하루를 보내고 계신가요,{'\n'}
            <Text style={{ color: colors.primaryDark }}>{nick || '당신'}</Text>님.
          </Text>
        </View>

        {/* 오늘의 기분 */}
        <Section title="오늘의 기분" hint={mood !== null ? '기록됨' : '하루 한 번, +3P'}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {MOODS.map((m, i) => {
              const active = mood === i;
              return (
                <Pressable key={i} onPress={() => selectMood(i)} style={{
                  minWidth: 68, paddingVertical: 10, paddingHorizontal: 6,
                  borderRadius: 14,
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.accent : colors.card,
                  alignItems: 'center', gap: 4,
                  transform: [{ scale: active ? 1.04 : 1 }],
                }}>
                  <Text style={{ fontSize: 26, lineHeight: 28 }}>{m.e}</Text>
                  <Text style={{
                    fontSize: 11, fontWeight: active ? '600' : '500',
                    color: active ? colors.primaryDark : colors.textSub,
                    letterSpacing: -0.2,
                  }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        {/* 포인트 카드 */}
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.pointCard, shadow.primaryCta]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.8 }}>{balance}</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>P</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>30일 만료 · 오늘 +3P</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>내 방 개설까지</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{nextMilestone}P 남음</Text>
          </View>
          <Progress value={balance} max={200} color="rgba(255,255,255,0.9)" bg="rgba(255,255,255,0.2)" h={4} />
        </LinearGradient>

        {/* 핫 투표 */}
        <Section title="🔥 이번 주 핫 투표" hint="더보기" onHintPress={() => router.push('/(tabs)/vote')}>
          <View style={{ gap: 10 }}>
            {topVotes.map((v, i) => {
              const pct = v.total ? Math.round((v.agree / v.total) * 100) : 0;
              return (
                <Card key={v.id} onPress={() => router.push(`/vote/${v.id}`)}
                  style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: i === 0 ? colors.primary : colors.tag,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 13, fontWeight: '700',
                      color: i === 0 ? '#fff' : colors.primaryDark,
                    }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.h3, { color: colors.text, fontSize: 14, marginBottom: 4 }]} numberOfLines={2}>
                      {v.question}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: colors.textSub }}>{v.total.toLocaleString()}명 참여</Text>
                      <Text style={{ fontSize: 11, color: colors.textLight }}>·</Text>
                      <Text style={{ fontSize: 11, color: colors.votePro, fontWeight: '600' }}>찬성 {pct}%</Text>
                    </View>
                  </View>
                  {i === 0 && <Text style={{ fontSize: 16 }}>🔥</Text>}
                </Card>
              );
            })}
          </View>
        </Section>

        {/* 지금 나누고 있는 이야기 */}
        <Section title="💬 지금 나누고 있는 이야기" hint="더보기" onHintPress={() => router.push('/(tabs)/board')}>
          <View style={{ gap: 10 }}>
            {posts.map((p) => {
              const cat = CATEGORY_COLORS[p.category] ?? { label: p.category, color: colors.textSub };
              return (
                <Card key={p.id} onPress={() => router.push(`/post/${p.id}`)} style={{ padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Tag label={cat.label} color={cat.color} compact />
                    <Text style={{ fontSize: 11, color: colors.textLight }}>{p.nickname}</Text>
                    <Text style={{ fontSize: 11, color: colors.textLight }}>·</Text>
                    <Text style={{ fontSize: 11, color: colors.textLight }}>{timeAgo(p.created_at)}</Text>
                  </View>
                  <Text style={[typography.h3, { color: colors.text, marginBottom: 4 }]} numberOfLines={1}>{p.title}</Text>
                  <Text style={{ fontSize: 12.5, color: colors.textSub, lineHeight: 20, marginBottom: 10 }} numberOfLines={2}>
                    {p.content}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ReactionRow reactions={{ '💛': p.like_count }} compact />
                    <View style={{ flex: 1 }} />
                    <Text style={{ fontSize: 11, color: colors.textSub }}>💬 {p.comment_count}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        </Section>

        {/* Q&A 미션 배너 */}
        <Pressable onPress={() => router.push('/mission')}>
          <LinearGradient
            colors={[colors.accent, colors.tag]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.missionBanner}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.7)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 22 }}>💌</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: -0.2 }}>
                3일 안에 10개 답변하면 100P
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                오늘의 Q&A 미션
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.primaryDark }}>→</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  pointCard: {
    marginTop: 14,
    borderRadius: radius.lg,
    padding: 18,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  missionBanner: {
    marginTop: 18,
    padding: 16,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toast: {
    position: 'absolute', bottom: 110, alignSelf: 'center',
    backgroundColor: colors.text, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '500' },
});
