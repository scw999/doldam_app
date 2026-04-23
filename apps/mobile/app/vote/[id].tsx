import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, Alert, ActivityIndicator, Share, Modal, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Pill } from '@/ui/atoms';
import { api } from '@/api';
import { useAuth } from '@/store/auth';
import { clearVoteCache } from '../(tabs)/vote';

const OPTION_COLORS = ['#5B8FC9', '#6BAF7B', '#D4728C', '#C4956A', '#8C7B6B', '#E85D4A'];

interface VoteDetail {
  id: string;
  user_id?: string;
  question: string;
  description?: string;
  options?: string[] | null;
  counts?: Record<string, number>;
  agree: number;
  disagree: number;
  total: number;
  myChoice?: string | null;
  kind?: 'normal' | 'peer_poll';
  room_id?: string | null;
  memberInfo?: Record<string, { nickname: string; gender: string | null }> | null;
}

function labelForOption(opt: string, memberInfo?: VoteDetail['memberInfo']): string {
  if (memberInfo && memberInfo[opt]) return memberInfo[opt].nickname;
  return opt;
}

export default function VoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myUserId = useAuth((s) => s.userId);
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [byGender, setByGender] = useState<{ M?: VoteDetail; F?: VoteDetail }>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [all, m, f] = await Promise.all([
        api.get<VoteDetail>(`/votes/${id}`, { cacheTtl: 0 }),
        api.get<VoteDetail>(`/votes/${id}?gender=M`, { cacheTtl: 0 }).catch(() => null),
        api.get<VoteDetail>(`/votes/${id}?gender=F`, { cacheTtl: 0 }).catch(() => null),
      ]);
      setLoadError(null);
      setVote(all);
      setByGender({ M: m ?? undefined, F: f ?? undefined });
      if (all.myChoice) setSelected(all.myChoice);
    } catch (e) {
      setLoadError((e as Error).message ?? 'error');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function respond(choice: string) {
    const prevVote = vote;
    const isChange = !!(prevVote?.myChoice); // user is changing an existing vote
    setSubmitting(true);
    setSelected(choice);
    setVote(prev => {
      if (!prev) return prev;
      const multi = Array.isArray(prev.options) && prev.options.length > 0;
      if (multi) {
        const counts = { ...(prev.counts ?? {}) };
        if (isChange && prev.myChoice) {
          counts[prev.myChoice] = Math.max(0, (counts[prev.myChoice] ?? 1) - 1);
        }
        counts[choice] = (counts[choice] ?? 0) + 1;
        return { ...prev, counts, total: isChange ? prev.total : prev.total + 1, myChoice: choice };
      }
      return {
        ...prev,
        agree: prev.agree + (choice === 'agree' ? 1 : 0) - (isChange && prev.myChoice === 'agree' ? 1 : 0),
        disagree: prev.disagree + (choice === 'disagree' ? 1 : 0) - (isChange && prev.myChoice === 'disagree' ? 1 : 0),
        total: isChange ? prev.total : prev.total + 1,
        myChoice: choice,
      };
    });
    try {
      await api.post(`/votes/${id}/respond`, { choice });
    } catch (e) {
      setSelected(prevVote?.myChoice ?? null);
      setVote(prevVote);
      load();
      Alert.alert('실패', (e as Error).message);
    }
    finally { setSubmitting(false); }
  }

  const insets = useSafeAreaInsets();

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🗑️</Text>
        <Text style={[typography.h3, { color: colors.text, textAlign: 'center', marginBottom: 6 }]}>
          삭제된 투표예요
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSub, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          작성자가 이 투표를 삭제했거나{'\n'}존재하지 않는 투표입니다
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 14, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!vote) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const isMulti = Array.isArray(vote.options) && vote.options.length > 0;
  const pct = vote.total ? Math.round((vote.agree / vote.total) * 100) : 0;

  const isHot = vote.total >= 500;

  async function submitReport(reason: string) {
    try {
      await api.post('/reports', { targetType: 'vote', targetId: id, reason });
      Alert.alert('신고 완료', '검토 후 조치하겠습니다');
    } catch { Alert.alert('오류', '신고에 실패했어요'); }
  }

  async function deleteVote() {
    Alert.alert('투표 삭제', '이 투표를 정말 삭제할까요? 참여한 응답도 함께 사라져요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/votes/${id}`);
            clearVoteCache();
            router.back();
          } catch (e) {
            Alert.alert('실패', (e as Error).message);
          }
        },
      },
    ]);
  }

  const isMine = !!myUserId && vote?.user_id === myUserId;

  async function share() {
    if (isMulti && vote!.options) {
      const top = vote!.options.map((o) => ({ o, n: vote!.counts?.[o] ?? 0 })).sort((a, b) => b.n - a.n)[0];
      await Share.share({ message: `[돌싱 딜레마] ${vote!.question}\n\n1위: ${top?.o}\n(${vote!.total.toLocaleString()}명 참여)\n\n돌담 앱에서 투표해보세요` });
    } else {
      await Share.share({ message: `[돌싱 딜레마] ${vote!.question}\n\n찬성 ${pct}% vs 반대 ${100 - pct}%\n(${vote!.total.toLocaleString()}명 참여)\n\n돌담 앱에서 투표해보세요` });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </Pressable>
        <Text style={[typography.h3, { color: colors.text }]}>{vote.kind === 'peer_poll' ? '멤버 투표' : '돌싱 딜레마'}</Text>
        {vote.myChoice && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.accent }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primaryDark }}>
              {isMulti ? `✓ ${labelForOption(vote.myChoice, vote.memberInfo)}` : vote.myChoice === 'agree' ? '⭕ 찬성 참여함' : '❌ 반대 참여함'}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => {
            if (isMine) {
              Alert.alert('투표 관리', undefined, [
                { text: '🗑️  삭제', style: 'destructive', onPress: deleteVote },
                { text: '취소', style: 'cancel' },
              ]);
            } else {
              setReportVisible(true);
            }
          }}
          style={{ padding: 8, marginLeft: 'auto' }}
        >
          <Text style={{ fontSize: 20, color: colors.textSub }}>⋯</Text>
        </Pressable>
      </View>

      <Modal visible={reportVisible} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setReportVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }}>신고 사유 선택</Text>
                <Pressable onPress={() => setReportVisible(false)} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 22, color: colors.textSub, lineHeight: 24 }}>✕</Text>
                </Pressable>
              </View>
              {[
                { label: '🔐 개인정보 포함', reason: '개인정보 포함' },
                { label: '🤬 욕설 / 혐오 발언', reason: '욕설/혐오 발언' },
                { label: '📢 스팸 / 홍보', reason: '스팸/홍보' },
                { label: '🚫 기타', reason: '기타' },
              ].map((opt) => (
                <Pressable
                  key={opt.reason}
                  onPress={() => { setReportVisible(false); submitReport(opt.reason); }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ fontSize: 15, color: colors.text }}>{opt.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setReportVisible(false)} style={{ paddingTop: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textSub }}>취소</Text>
              </Pressable>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
          <>
            {/* 투표 버튼 */}
            {isMulti ? (
              <View style={{ gap: 10 }}>
                {vote.options!.map((opt, idx) => (
                  <Pressable
                    key={opt}
                    onPress={() => respond(opt)}
                    disabled={submitting}
                    style={[styles.optionBtn, { borderColor: OPTION_COLORS[idx % OPTION_COLORS.length] + '60' }]}
                  >
                    <View style={[styles.optionDot, { backgroundColor: OPTION_COLORS[idx % OPTION_COLORS.length] + '22', borderColor: OPTION_COLORS[idx % OPTION_COLORS.length] }]}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: OPTION_COLORS[idx % OPTION_COLORS.length] }}>{idx + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.2 }}>
                      {labelForOption(opt, vote.memberInfo)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => respond('agree')} disabled={submitting} style={[styles.bigBtn, { borderColor: colors.votePro + '40' }]}>
                  <Text style={{ fontSize: 32 }}>⭕</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.votePro, letterSpacing: -0.2 }}>찬성</Text>
                </Pressable>
                <Pressable onPress={() => respond('disagree')} disabled={submitting} style={[styles.bigBtn, { borderColor: colors.voteCon + '40' }]}>
                  <Text style={{ fontSize: 32 }}>❌</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.voteCon, letterSpacing: -0.2 }}>반대</Text>
                </Pressable>
              </View>
            )}

            {/* 결과 잠금 티저 */}
            <View style={styles.teaser}>
              <Text style={{ fontSize: 22 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>투표 후 결과 공개</Text>
                <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                  {vote.total > 0 ? `${vote.total.toLocaleString()}명이 이미 투표했어요` : '첫 번째로 투표해보세요'}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* 내 선택 + 변경 */}
            <View style={{ padding: 14, backgroundColor: colors.accent, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.primaryDark, fontWeight: '600', flex: 1 }}>
                내 선택: {isMulti ? labelForOption(selected ?? '', vote.memberInfo) : selected === 'agree' ? '⭕ 찬성' : '❌ 반대'}
              </Text>
              <Pressable
                onPress={() => setSelected(null)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 11, color: colors.textSub }}>🔄 변경</Text>
              </Pressable>
            </View>

            {isMulti ? (
              /* 선택형 결과 */
              <View style={{ gap: 10 }}>
                {vote.options!.map((opt, idx) => {
                  const count = vote.counts?.[opt] ?? 0;
                  const barPct = vote.total ? Math.round((count / vote.total) * 100) : 0;
                  const isMyChoice = selected === opt;
                  const color = OPTION_COLORS[idx % OPTION_COLORS.length];
                  return (
                    <View key={opt} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, fontWeight: isMyChoice ? '700' : '500', color: isMyChoice ? color : colors.text }}>
                          {isMyChoice ? '✓ ' : ''}{labelForOption(opt, vote.memberInfo)}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSub }}>{barPct}% ({count}명)</Text>
                      </View>
                      <View style={{ height: 10, borderRadius: 8, backgroundColor: colors.tag, overflow: 'hidden' }}>
                        <View style={{ width: `${barPct}%`, height: '100%', backgroundColor: color, opacity: isMyChoice ? 1 : 0.6 }} />
                      </View>
                    </View>
                  );
                })}
                <Text style={{ fontSize: 11, color: colors.textSub, textAlign: 'right', marginTop: 4 }}>
                  총 {vote.total.toLocaleString()}명 참여
                </Text>
              </View>
            ) : (
              /* 찬반 결과 */
              <>
                <View style={{ flexDirection: 'row', height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.tag, marginBottom: 18 }}>
                  <View style={{ width: `${pct}%`, backgroundColor: colors.votePro, justifyContent: 'center', paddingLeft: 14 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{pct}%</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.voteCon, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 14 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{100 - pct}%</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSub, marginBottom: 10 }}>성별 분포</Text>
                {[
                  { label: '남성', data: byGender.M, color: colors.male },
                  { label: '여성', data: byGender.F, color: colors.female },
                ].map((g) => {
                  const gTotal = g.data?.total ?? 0;
                  const gAgree = g.data?.agree ?? 0;
                  const participationPct = vote.total > 0 ? Math.round((gTotal / vote.total) * 100) : 0;
                  const agreePct = gTotal > 0 ? Math.round((gAgree / gTotal) * 100) : 0;
                  return (
                    <View key={g.label} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={{ fontSize: 12, color: g.color, fontWeight: '600' }}>
                          ● {g.label} {gTotal > 0 ? `${gTotal}명 (${participationPct}%)` : '참여 없음'}
                        </Text>
                        {gTotal > 0 && (
                          <Text style={{ fontSize: 12, color: colors.textSub }}>찬성 {agreePct}% · 반대 {100 - agreePct}%</Text>
                        )}
                      </View>
                      <View style={{ height: 8, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.tag }}>
                        {gTotal > 0 && (
                          <>
                            <View style={{ width: `${agreePct}%`, height: '100%', backgroundColor: colors.votePro }} />
                            <View style={{ flex: 1, height: '100%', backgroundColor: colors.voteCon + '50' }} />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {isHot && (
              <LinearGradient
                colors={[colors.accent, colors.tag]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.themeBanner}
              >
                <Text style={{ fontSize: 22 }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: -0.2 }}>이 주제로 테마방이 열렸어요</Text>
                  <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>{vote.total.toLocaleString()}명이 투표 중</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/(tabs)/chat')}
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>입장</Text>
                </Pressable>
              </LinearGradient>
            )}

            <Pressable
              onPress={share}
              style={{ marginTop: 16, padding: 14, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card, borderRadius: radius.lg, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primaryDark }}>📤 공유카드 만들기</Text>
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
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bigBtn: {
    flex: 1, paddingVertical: 24,
    backgroundColor: colors.card,
    borderWidth: 2, borderRadius: 18,
    alignItems: 'center', gap: 8,
  },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5, borderRadius: 14,
  },
  optionDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  teaser: {
    marginTop: 20, padding: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  themeBanner: {
    marginTop: 20, padding: 14,
    borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.primary + '33',
  },
});
