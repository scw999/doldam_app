import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, Alert, ActivityIndicator, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Pill } from '@/ui/atoms';
import { api } from '@/api';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8787';

interface VoteDetail {
  id: string;
  question: string;
  description?: string;
  agree: number;
  disagree: number;
  total: number;
}

export default function VoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [byGender, setByGender] = useState<{ M?: VoteDetail; F?: VoteDetail }>({});
  const [selected, setSelected] = useState<'agree' | 'disagree' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [all, m, f] = await Promise.all([
      api.get<VoteDetail>(`/votes/${id}`),
      api.get<VoteDetail>(`/votes/${id}?gender=M`).catch(() => null),
      api.get<VoteDetail>(`/votes/${id}?gender=F`).catch(() => null),
    ]);
    setVote(all);
    setByGender({ M: m ?? undefined, F: f ?? undefined });
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function respond(choice: 'agree' | 'disagree') {
    setSubmitting(true);
    try {
      await api.post(`/votes/${id}/respond`, { choice });
      setSelected(choice);
      load();
    } catch (e) { Alert.alert('실패', (e as Error).message); }
    finally { setSubmitting(false); }
  }

  async function share() {
    await Share.share({
      message: `${vote?.question}\n\n돌담에서 투표하기: ${API_BASE}/votes/${id}/card.svg`,
    });
  }

  if (!vote) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const pct = vote.total ? Math.round((vote.agree / vote.total) * 100) : 0;
  const isHot = vote.total >= 500;
  const mPct = byGender.M && byGender.M.total ? Math.round((byGender.M.agree / byGender.M.total) * 100) : 0;
  const fPct = byGender.F && byGender.F.total ? Math.round((byGender.F.agree / byGender.F.total) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </Pressable>
        <Text style={[typography.h3, { color: colors.text }]}>돌싱 딜레마</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {isHot && (
          <View style={{ marginBottom: 12 }}>
            <Pill bg="#E85D4A18" color="#E85D4A" icon="🔥">HOT 투표 · 500명+</Pill>
          </View>
        )}

        <Text style={[typography.h1, { color: colors.text, marginBottom: 10, lineHeight: 30 }]}>
          {vote.question}
        </Text>
        {vote.description && (
          <Text style={{ fontSize: 13, color: colors.textSub, lineHeight: 22, marginBottom: 20 }}>
            {vote.description}
          </Text>
        )}

        {selected === null ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => respond('agree')}
              disabled={submitting}
              style={[styles.bigBtn, { borderColor: colors.votePro + '40' }]}
            >
              <Text style={{ fontSize: 32 }}>⭕</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.votePro, letterSpacing: -0.2 }}>
                찬성
              </Text>
            </Pressable>
            <Pressable
              onPress={() => respond('disagree')}
              disabled={submitting}
              style={[styles.bigBtn, { borderColor: colors.voteCon + '40' }]}
            >
              <Text style={{ fontSize: 32 }}>❌</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.voteCon, letterSpacing: -0.2 }}>
                반대
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* 내 선택 */}
            <View style={{
              padding: 14, backgroundColor: colors.accent,
              borderRadius: 12, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: colors.primaryDark, fontWeight: '600' }}>
                내 선택: {selected === 'agree' ? '⭕ 찬성' : '❌ 반대'}
              </Text>
            </View>

            {/* 전체 바 */}
            <View style={{ flexDirection: 'row', height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.tag, marginBottom: 18 }}>
              <View style={{
                width: `${pct}%`, backgroundColor: colors.votePro,
                justifyContent: 'center', paddingLeft: 14,
              }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{pct}%</Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: colors.voteCon,
                justifyContent: 'center', alignItems: 'flex-end', paddingRight: 14,
              }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{100 - pct}%</Text>
              </View>
            </View>

            {/* 성별 분포 */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSub, marginBottom: 10 }}>
              성별 분포
            </Text>
            {[
              { label: '남성', pct: mPct, color: colors.male },
              { label: '여성', pct: fPct, color: colors.female },
            ].map((g) => (
              <View key={g.label} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontSize: 12, color: g.color, fontWeight: '600' }}>● {g.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSub }}>
                    찬성 {g.pct}% · 반대 {100 - g.pct}%
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 8, backgroundColor: colors.tag, overflow: 'hidden' }}>
                  <View style={{ width: `${g.pct}%`, height: '100%', backgroundColor: g.color }} />
                </View>
              </View>
            ))}

            {/* 테마방 배너 */}
            {isHot && (
              <LinearGradient
                colors={[colors.accent, colors.tag]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.themeBanner}
              >
                <Text style={{ fontSize: 22 }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: -0.2 }}>
                    이 주제로 테마방이 열렸어요
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                    {vote.total.toLocaleString()}명이 투표 중
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
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>입장</Text>
                </Pressable>
              </LinearGradient>
            )}

            {/* 공유카드 */}
            <Pressable
              onPress={share}
              style={{
                marginTop: 16, padding: 14,
                borderWidth: 1, borderColor: colors.primary,
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primaryDark }}>
                📤 공유카드 만들기
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bigBtn: {
    flex: 1, paddingVertical: 24,
    backgroundColor: colors.card,
    borderWidth: 2, borderRadius: 18,
    alignItems: 'center', gap: 8,
  },
  themeBanner: {
    marginTop: 20, padding: 14,
    borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.primary + '33',
  },
});
