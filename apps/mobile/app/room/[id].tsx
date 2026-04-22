import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator,
  Modal, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar, fmtRemaining } from '@/ui/atoms';
import { useAuth } from '@/store/auth';
import { api } from '@/api';
import { buildWelcomeMessage, buildIcebreakerQuestion } from '@/utils/icebreaker';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8787';
const RECONNECT_DELAY = 3000;

const REPORT_REASONS = [
  '욕설/혐오 발언',
  '성희롱/성적 발언',
  '개인정보 요구',
  '스팸/광고',
  '기타 부적절한 행동',
];

interface Message {
  id: string; from: string; nickname: string; text: string; ts: number;
  voteId?: string;
}

interface RoomInfo {
  id: string; theme: string; kind: string; gender_mix: string;
  expires_at: number; status: string; tags?: string | null;
  members: { id: string; nickname: string; gender: 'M' | 'F'; age_range: string }[];
}

// 모듈레벨 캐시 — 방 재입장 시 즉시 표시
const roomCache: Record<string, { info: RoomInfo; messages: Message[]; ts: number }> = {};
const ROOM_CACHE_TTL = 120_000; // 2분

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuth((s) => s.token);
  const myUserId = useAuth((s) => s.userId);
  const insets = useSafeAreaInsets();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [keepVoting, setKeepVoting] = useState(false);
  const [myVote, setMyVote] = useState<'keep' | 'destroy' | null>(null);
  const [icebreakerVisible, setIcebreakerVisible] = useState(false);
  const [icebreakerAnswer, setIcebreakerAnswer] = useState('');
  const [icebreakerQuestion, setIcebreakerQuestion] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [reportTarget, setReportTarget] = useState<{ userId: string; nickname: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [voteCreateVisible, setVoteCreateVisible] = useState(false);
  const [voteQuestion, setVoteQuestion] = useState('');
  const [voteOptions, setVoteOptions] = useState<string[]>(['', '']);
  const [creatingVote, setCreatingVote] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const mountedRef = useRef(true);
  const icebreakerShownRef = useRef(false);

  const loadRoom = useCallback(async () => {
    const cached = roomCache[id];
    const isFresh = cached && Date.now() - cached.ts < ROOM_CACHE_TTL;
    if (isFresh) {
      setRoom(cached.info);
      setMessages(cached.messages);
    }
    try {
      const [info, history, muteRes] = await Promise.all([
        api.get<RoomInfo>(`/rooms/${id}`, { cacheTtl: 0 }),
        api.get<{ items: Message[] }>(`/rooms/${id}/history`, { cacheTtl: 0 }),
        api.get<{ muted: boolean }>(`/notifications/rooms/${id}/mute`, { cacheTtl: 0 }).catch(() => ({ muted: false })),
      ]);
      setMuted(muteRes.muted);
      setRoom(info);
      setMessages(history.items);
      roomCache[id] = { info, messages: history.items, ts: Date.now() };
      // 내 메시지가 없으면 아이스브레이커 표시
      if (!icebreakerShownRef.current) {
        const myMsgs = history.items.filter((m) => m.from === myUserId);
        if (myMsgs.length === 0) {
          icebreakerShownRef.current = true;
          const ctx = { theme: info.theme, genderMix: info.gender_mix, tags: info.tags };
          setWelcomeMessage(buildWelcomeMessage(ctx));
          setIcebreakerQuestion(buildIcebreakerQuestion(ctx));
          setIcebreakerVisible(true);
        }
      }
    } catch (e) {
      Alert.alert('오류', '방 정보를 불러올 수 없어요');
    }
  }, [id, myUserId]);

  useFocusEffect(useCallback(() => { loadRoom(); }, [loadRoom]));

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);

  function connect() {
    if (!token || !id || !mountedRef.current) return;
    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/rooms/${id}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { if (mountedRef.current) setConnected(true); };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      reconnectRef.current = setTimeout(() => connect(), RECONNECT_DELAY);
    };

    ws.onerror = () => {
      console.warn('[ws] error in room', id);
      if (mountedRef.current) setConnected(false);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'error') { Alert.alert('전송 실패', data.reason ?? data.error); return; }
        if (data.type === 'message' || data.id) {
          setMessages((prev) => [...prev, data as Message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        }
      } catch {}
    };
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [id, token]);

  function send(text?: string, voteId?: string) {
    const t = (text ?? draft).trim();
    if ((!t && !voteId) || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: t, ...(voteId && { voteId }) }));
    if (!text) setDraft('');
  }

  async function createChatVote() {
    const q = voteQuestion.trim();
    if (!q) { Alert.alert('질문을 입력해주세요'); return; }
    const opts = voteOptions.map((o) => o.trim()).filter(Boolean);
    // 선택지 0-1개면 찬반형, 2개 이상이면 선택형
    const useMulti = opts.length >= 2;
    if (opts.length === 1) { Alert.alert('선택지는 0개(찬반) 또는 2개 이상(선택형)이어야 해요'); return; }
    setCreatingVote(true);
    try {
      const body: { question: string; options?: string[] } = { question: q };
      if (useMulti) body.options = opts;
      const { id: newVoteId } = await api.post<{ id: string }>('/votes', body);
      send(useMulti ? `🗳️ ${q}` : `🗳️ ${q}`, newVoteId);
      setVoteCreateVisible(false);
      setVoteQuestion('');
      setVoteOptions(['', '']);
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setCreatingVote(false); }
  }

  function submitIcebreaker() {
    const t = icebreakerAnswer.trim();
    if (!t) { setIcebreakerVisible(false); return; }
    setIcebreakerVisible(false);
    send(t);
    setIcebreakerAnswer('');
  }

  function confirmKeepVote(keep: boolean) {
    if (keepVoting || myVote !== null) return;
    Alert.alert(
      keep ? '✅ 방 유지 투표' : '💥 방 폭파 투표',
      '한번 입력하면 다시 바꿀 수 없습니다.\n계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '투표하기', style: keep ? 'default' : 'destructive', onPress: () => keepVote(keep) },
      ]
    );
  }

  async function keepVote(keep: boolean) {
    if (keepVoting || myVote !== null) return;
    setKeepVoting(true);
    setMyVote(keep ? 'keep' : 'destroy');
    try {
      const r = await api.post<{ kept: boolean; yes: number; total: number }>(
        `/rooms/${id}/keep-vote`, { keep }
      );
      if (r.kept) {
        Alert.alert('방 유지 🎉', '투표 완료! 방이 3일 연장되었어요');
        loadRoom();
      } else {
        Alert.alert('투표 완료', `유지 ${r.yes} / ${r.total}명`);
      }
    } catch (e) {
      setMyVote(null);
      Alert.alert('실패', (e as Error).message);
    } finally { setKeepVoting(false); }
  }

  async function revive() {
    Alert.alert('방 부활', '200P로 3일 연장할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '부활',
        onPress: async () => {
          try {
            await api.post(`/rooms/${id}/revive`, {});
            loadRoom();
          } catch (e) { Alert.alert('실패', (e as Error).message); }
        },
      },
    ]);
  }

  async function reportUser(targetUserId: string, reason: string) {
    try {
      await api.post('/reports', { targetId: targetUserId, targetType: 'user', reason });
      Alert.alert('신고 완료', '신고가 접수되었습니다. 검토 후 조치할게요.');
    } catch {
      Alert.alert('신고 실패', '잠시 후 다시 시도해주세요.');
    }
  }

  const rem = room ? fmtRemaining(room.expires_at) : { label: '...', urgent: false };
  const isThemed = room?.kind === 'themed';
  const isExpired = room?.status === 'expired' || rem.label === '0분';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 헤더 */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.text, fontSize: 15 }]} numberOfLines={1}>
                {isThemed && '🔥 '}{room?.theme ?? '소그룹'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: colors.textSub }}>👥 {room?.members?.length ?? 0}명</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connected ? colors.green : colors.textLight }} />
                <Text style={{ fontSize: 10, color: connected ? colors.green : colors.textLight }}>
                  {connected ? '연결됨' : '연결 중...'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={async () => {
                const next = !muted;
                setMuted(next);
                if (next) {
                  await api.post(`/notifications/rooms/${id}/mute`, {}).catch(() => setMuted(false));
                } else {
                  await api.delete(`/notifications/rooms/${id}/mute`).catch(() => setMuted(true));
                }
              }}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 20 }}>{muted ? '🔕' : '🔔'}</Text>
            </Pressable>
          </View>

          {/* 남은시간 + 유지/폭파 투표 */}
          <View style={[styles.timerBar, rem.urgent && styles.timerBarUrgent]}>
            <Text style={[styles.timerText, rem.urgent && styles.timerTextUrgent]}>
              ⏱ {rem.label} 남음
            </Text>
            <View style={{ flex: 1 }} />
            {isExpired ? (
              <Pressable onPress={revive} style={styles.reviveBtn}>
                <Text style={styles.reviveBtnText}>💫 부활 200P</Text>
              </Pressable>
            ) : myVote !== null ? (
              <View style={[styles.voteChip, myVote === 'keep' ? styles.voteChipKeep : styles.voteChipDestroy]}>
                <Text style={styles.voteChipText}>
                  {myVote === 'keep' ? '✅ 유지 투표완료' : '💥 폭파 투표완료'}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => confirmKeepVote(true)} disabled={keepVoting} style={styles.keepBtn}>
                  {keepVoting
                    ? <ActivityIndicator size="small" color="#fff" style={{ width: 40 }} />
                    : <Text style={styles.keepBtnText}>✅ 유지</Text>
                  }
                </Pressable>
                <Pressable onPress={() => confirmKeepVote(false)} disabled={keepVoting} style={styles.destroyBtn}>
                  <Text style={styles.destroyBtnText}>💥 폭파</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* 메시지 */}
        <FlatList
          ref={listRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          data={messages}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={
            <View style={{ padding: 12, backgroundColor: colors.accent + '80', borderRadius: 10, marginBottom: 14 }}>
              <Text style={{ fontSize: 11, color: colors.primaryDark, textAlign: 'center', fontWeight: '500' }}>
                🔒 본인인증된 돌싱만 입장 가능한 방이에요
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 40, fontSize: 13 }}>
              첫 메시지를 보내보세요
            </Text>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => {
            if (m.from === 'system') {
              return (
                <Text style={{ fontSize: 11, color: colors.textSub, textAlign: 'center', marginVertical: 6 }}>
                  {m.text}
                </Text>
              );
            }
            return (
              <Bubble
                msg={m}
                mine={m.from === myUserId}
                onReport={m.from !== myUserId ? () => setReportTarget({ userId: m.from, nickname: m.nickname }) : undefined}
                onVoteTap={m.voteId ? () => router.push(`/vote/${m.voteId}`) : undefined}
              />
            );
          }}
        />

        {/* 입력 */}
        <View style={styles.inputRow}>
          <Pressable
            onPress={() => setVoteCreateVisible(true)}
            disabled={!connected || isExpired}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: colors.tag,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 20 }}>🗳️</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={connected ? '메시지 보내기' : '연결 중...'}
            placeholderTextColor={colors.textLight}
            editable={connected && !isExpired}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => send()}
            disabled={!connected || !draft.trim() || isExpired}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: draft.trim() && connected ? colors.primary : colors.tag,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: draft.trim() ? '#fff' : colors.textLight }}>↑</Text>
          </Pressable>
        </View>

        {/* 투표 만들기 모달 */}
        <Modal visible={voteCreateVisible} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVoteCreateVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.icebreakerSheet, { width: '92%' }]}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }}>🗳️ 방에 투표 띄우기</Text>
              <Text style={{ fontSize: 11, color: colors.textSub, marginBottom: 14 }}>
                선택지 비워두면 찬/반 투표 · 2~6개 적으면 선택형
              </Text>
              <TextInput
                style={styles.icebreakerInput}
                value={voteQuestion}
                onChangeText={setVoteQuestion}
                placeholder="질문 입력"
                placeholderTextColor={colors.textLight}
                multiline
                maxLength={150}
              />
              <View style={{ marginTop: 12, gap: 6 }}>
                {voteOptions.map((opt, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={opt}
                      onChangeText={(t) => setVoteOptions((prev) => prev.map((o, j) => (j === i ? t : o)))}
                      placeholder={`선택지 ${i + 1}`}
                      placeholderTextColor={colors.textLight}
                      maxLength={40}
                    />
                    {voteOptions.length > 2 && (
                      <Pressable
                        onPress={() => setVoteOptions((prev) => prev.filter((_, j) => j !== i))}
                        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tag }}
                      >
                        <Text style={{ fontSize: 14, color: colors.textSub }}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                {voteOptions.length < 6 && (
                  <Pressable
                    onPress={() => setVoteOptions((prev) => [...prev, ''])}
                    style={{ paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 12, color: colors.primaryDark }}>+ 선택지 추가</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable style={[styles.icebreakerBtn, { backgroundColor: colors.tag, flex: 1 }]} onPress={() => setVoteCreateVisible(false)}>
                  <Text style={{ color: colors.textSub, fontWeight: '600' }}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.icebreakerBtn, { backgroundColor: colors.primary, flex: 2, opacity: creatingVote ? 0.6 : 1 }]}
                  onPress={createChatVote}
                  disabled={creatingVote}
                >
                  {creatingVote
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>투표 올리기</Text>
                  }
                </Pressable>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>

      {/* 아이스브레이커 모달 */}
      <Modal visible={icebreakerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.icebreakerSheet}>
            {welcomeMessage ? (
              <Text style={{ fontSize: 13, color: colors.primaryDark, marginBottom: 12, lineHeight: 20, fontWeight: '500' }}>
                {welcomeMessage}
              </Text>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />
            <Text style={{ fontSize: 12, color: colors.textSub, marginBottom: 6 }}>💬 첫 번째 질문</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 18, lineHeight: 23 }}>
              {icebreakerQuestion}
            </Text>
            <TextInput
              style={styles.icebreakerInput}
              value={icebreakerAnswer}
              onChangeText={setIcebreakerAnswer}
              placeholder="자유롭게 답해보세요"
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={200}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                style={[styles.icebreakerBtn, { backgroundColor: colors.tag, flex: 1 }]}
                onPress={() => setIcebreakerVisible(false)}
              >
                <Text style={{ color: colors.textSub, fontWeight: '600' }}>건너뛰기</Text>
              </Pressable>
              <Pressable
                style={[styles.icebreakerBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={submitIcebreaker}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>전송하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 유저 신고 모달 */}
      <Modal visible={!!reportTarget} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReportTarget(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.reportSheet}>
            <Text style={styles.reportTitle}>{reportTarget?.nickname} 신고</Text>
            <Text style={{ fontSize: 12, color: colors.textSub, marginBottom: 16, textAlign: 'center' }}>
              신고 사유를 선택해주세요
            </Text>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={styles.reportItem}
                onPress={() => {
                  const t = reportTarget;
                  setReportTarget(null);
                  if (t) reportUser(t.userId, reason);
                }}
              >
                <Text style={styles.reportItemText}>{reason}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.reportCancel} onPress={() => setReportTarget(null)}>
              <Text style={{ color: colors.textSub, fontWeight: '600' }}>취소</Text>
            </Pressable>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Bubble({
  msg,
  mine,
  onReport,
  onVoteTap,
}: {
  msg: Message;
  mine: boolean;
  onReport?: () => void;
  onVoteTap?: () => void;
}) {
  const hasVote = !!msg.voteId;
  return (
    <Pressable
      onLongPress={onReport}
      delayLongPress={500}
      style={{ flexDirection: mine ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}
    >
      {!mine && <Avatar size={28} />}
      <View style={{ maxWidth: '80%' }}>
        {!mine && (
          <Text style={{ fontSize: 10.5, color: colors.textSub, marginBottom: 3, marginLeft: 2 }}>
            {msg.nickname}
          </Text>
        )}
        <View style={{ flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
          {hasVote ? (
            <Pressable
              onPress={onVoteTap}
              style={{
                padding: 14,
                backgroundColor: mine ? colors.primary : colors.card,
                borderWidth: 1.5,
                borderColor: mine ? colors.primaryDark : colors.primary + '55',
                borderRadius: 16,
                minWidth: 220,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Text style={{ fontSize: 14 }}>🗳️</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: mine ? 'rgba(255,255,255,0.8)' : colors.primaryDark, letterSpacing: 0.3 }}>
                  투표
                </Text>
              </View>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: mine ? '#fff' : colors.text, fontWeight: '600', letterSpacing: -0.1 }}>
                {msg.text.replace(/^🗳️\s*/, '')}
              </Text>
              <Text style={{ fontSize: 11, marginTop: 8, color: mine ? 'rgba(255,255,255,0.85)' : colors.primaryDark, fontWeight: '600' }}>
                탭해서 참여 →
              </Text>
            </Pressable>
          ) : (
            <View style={{
              padding: 12, paddingHorizontal: 13,
              backgroundColor: mine ? colors.primary : colors.card,
              borderRadius: 16,
              borderBottomRightRadius: mine ? 4 : 16,
              borderBottomLeftRadius: mine ? 16 : 4,
              elevation: mine ? 0 : 1,
            }}>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: mine ? '#fff' : colors.text, letterSpacing: -0.1 }}>
                {msg.text}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 10, color: colors.textLight }}>{fmtHhmm(msg.ts)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function fmtHhmm(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? '오전' : '오후';
  return `${ap} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  timerBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, backgroundColor: colors.tag,
  },
  timerBarUrgent: { backgroundColor: '#E85D4A12' },
  timerText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  timerTextUrgent: { color: '#E85D4A' },
  keepBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.green,
    minWidth: 60, alignItems: 'center',
  },
  keepBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  destroyBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: '#E85D4A',
    backgroundColor: '#E85D4A12',
    minWidth: 60, alignItems: 'center',
  },
  destroyBtnText: { fontSize: 12, fontWeight: '700', color: '#E85D4A' },
  reviveBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.primary,
  },
  reviveBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  voteChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  voteChipKeep: { backgroundColor: colors.green + '20' },
  voteChipDestroy: { backgroundColor: '#E85D4A15' },
  voteChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  inputRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    padding: 14, paddingBottom: 18,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, fontSize: 13, color: colors.text,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  icebreakerSheet: {
    backgroundColor: colors.card,
    borderRadius: 24, padding: 24, margin: 24,
    width: '90%',
  },
  icebreakerInput: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 14,
    fontSize: 14, color: colors.text,
    minHeight: 80, textAlignVertical: 'top',
  },
  icebreakerBtn: {
    paddingVertical: 13, borderRadius: radius.md,
    alignItems: 'center',
  },
  reportSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  reportTitle: {
    fontSize: 16, fontWeight: '700', color: colors.text,
    textAlign: 'center', marginBottom: 4,
  },
  reportItem: {
    paddingVertical: 15, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  reportItemText: { fontSize: 15, color: colors.text },
  reportCancel: {
    marginTop: 16, paddingVertical: 14,
    alignItems: 'center', backgroundColor: colors.tag,
    borderRadius: radius.md,
  },
});
