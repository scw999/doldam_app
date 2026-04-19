import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar, fmtRemaining } from '@/ui/atoms';
import { useAuth } from '@/store/auth';
import { api } from '@/api';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8787';
const RECONNECT_DELAY = 3000;

interface Message {
  id: string; from: string; nickname: string; text: string; ts: number;
}

interface RoomInfo {
  id: string; theme: string; kind: string;
  expires_at: number; status: string;
  members: { id: string; nickname: string; gender: 'M' | 'F'; age_range: string }[];
}

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuth((s) => s.token);
  const myUserId = useAuth((s) => s.userId);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const mountedRef = useRef(true);

  const loadRoom = useCallback(async () => {
    try {
      const [info, history] = await Promise.all([
        api.get<RoomInfo>(`/rooms/${id}`),
        api.get<{ items: Message[] }>(`/rooms/${id}/history`),
      ]);
      setRoom(info);
      setMessages(history.items);
    } catch (e) {
      Alert.alert('오류', '방 정보를 불러올 수 없어요');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadRoom(); }, [loadRoom]));

  // 남은시간 매분 갱신
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);

  // WebSocket 연결 (자동 재연결 포함)
  function connect() {
    if (!token || !id || !mountedRef.current) return;
    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/rooms/${id}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setConnected(true);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      reconnectRef.current = setTimeout(() => connect(), RECONNECT_DELAY);
    };

    ws.onerror = () => {};

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

  function send() {
    const t = draft.trim();
    if (!t || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: t }));
    setDraft('');
  }

  async function keepVote(keep: boolean) {
    try {
      const r = await api.post<{ kept: boolean; yes: number; total: number }>(
        `/rooms/${id}/keep-vote`, { keep }
      );
      if (r.kept) {
        Alert.alert('방 유지', '3일 연장되었어요');
        loadRoom();
      } else {
        Alert.alert('투표 완료', `유지 ${r.yes} / ${r.total}명`);
      }
    } catch (e) { Alert.alert('실패', (e as Error).message); }
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

  const rem = room ? fmtRemaining(room.expires_at) : { label: '...', urgent: false };
  const isThemed = room?.kind === 'themed';
  const isExpired = room?.status === 'expired' || rem.label === '0분';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.text, fontSize: 15 }]} numberOfLines={1}>
                {isThemed && '🔥 '}{room?.theme ?? '소그룹'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: colors.textSub }}>
                  👥 {room?.members?.length ?? 0}명
                </Text>
                <View style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: connected ? colors.green : colors.textLight,
                }} />
                <Text style={{ fontSize: 10, color: connected ? colors.green : colors.textLight }}>
                  {connected ? '연결됨' : '연결 중...'}
                </Text>
              </View>
            </View>
          </View>

          {/* 남은시간 + 유지 투표 */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            padding: 10, borderRadius: 10,
            backgroundColor: rem.urgent ? colors.badge + '14' : colors.tag,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700',
              color: rem.urgent ? colors.badge : colors.primaryDark,
            }}>⏱ {rem.label} 남음</Text>
            <View style={{ flex: 1 }} />
            {isExpired ? (
              <Pressable
                onPress={revive}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.error }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>부활 200P</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => keepVote(true)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.green }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>유지</Text>
                </Pressable>
                <Pressable
                  onPress={() => keepVote(false)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSub }}>폭파</Text>
                </Pressable>
              </>
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
            return <Bubble msg={m} mine={m.from === myUserId} />;
          }}
        />

        {/* 입력 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={connected ? '메시지 보내기' : '연결 중...'}
            placeholderTextColor={colors.textLight}
            editable={connected && !isExpired}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={send}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg, mine }: { msg: Message; mine: boolean }) {
  return (
    <View style={{ flexDirection: mine ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
      {!mine && <Avatar size={28} />}
      <View style={{ maxWidth: '74%' }}>
        {!mine && (
          <Text style={{ fontSize: 10.5, color: colors.textSub, marginBottom: 3, marginLeft: 2 }}>
            {msg.nickname}
          </Text>
        )}
        <View style={{ flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
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
          <Text style={{ fontSize: 10, color: colors.textLight }}>{fmtHhmm(msg.ts)}</Text>
        </View>
      </View>
    </View>
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
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
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
});
