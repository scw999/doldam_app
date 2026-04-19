import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar, fmtRemaining } from '@/ui/atoms';
import { useAuth } from '@/store/auth';
import { api } from '@/api';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8787';

interface Message {
  id: string;
  from: string;
  nickname: string;
  text: string;
  ts: number;
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
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const loadRoom = useCallback(async () => {
    try {
      const [info, history] = await Promise.all([
        api.get<RoomInfo>(`/rooms/${id}`),
        api.get<{ items: Message[] }>(`/rooms/${id}/history`),
      ]);
      setRoom(info);
      setMessages(history.items);
    } catch (e) { console.warn('load room', e); }
  }, [id]);

  useFocusEffect(useCallback(() => { loadRoom(); }, [loadRoom]));

  useEffect(() => {
    if (!token || !id) return;
    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/rooms/${id}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = (e) => console.warn('ws error', e);
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
    return () => ws.close();
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
      if (r.kept) Alert.alert('방 유지', '3일 연장되었어요');
      else Alert.alert('투표 완료', `유지 ${r.yes} / ${r.total}명`);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                👥 {room?.members?.length ?? 0}명
              </Text>
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
            {rem.label === '0분' || room?.status === 'expired' ? (
              <Pressable
                onPress={revive}
                style={{
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: radius.full, backgroundColor: colors.error,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>부활 200P</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => keepVote(true)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: radius.full, backgroundColor: colors.green,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>유지</Text>
                </Pressable>
                <Pressable
                  onPress={() => keepVote(false)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: radius.full,
                    borderWidth: 1, borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
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
            <View style={{
              padding: 12, backgroundColor: colors.accent + '80',
              borderRadius: 10, marginBottom: 14,
            }}>
              <Text style={{
                fontSize: 11, color: colors.primaryDark, textAlign: 'center',
                fontWeight: '500',
              }}>🔒 본인인증된 돌싱만 입장 가능한 방이에요</Text>
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => {
            if (m.from === 'system') {
              return (
                <Text style={{
                  fontSize: 11, color: colors.textSub, textAlign: 'center',
                  marginVertical: 6,
                }}>{m.text}</Text>
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
            editable={connected}
          />
          <Pressable
            onPress={send}
            disabled={!connected || !draft.trim()}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: draft.trim() ? colors.primary : colors.tag,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{
              fontSize: 16, fontWeight: '700',
              color: draft.trim() ? '#fff' : colors.textLight,
            }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg, mine }: { msg: Message; mine: boolean }) {
  return (
    <View style={{
      flexDirection: mine ? 'row-reverse' : 'row',
      gap: 8, marginBottom: 12, alignItems: 'flex-end',
    }}>
      {!mine && <Avatar size={28} />}
      <View style={{ maxWidth: '74%' }}>
        {!mine && (
          <Text style={{ fontSize: 10.5, color: colors.textSub, marginBottom: 3, marginLeft: 2 }}>
            {msg.nickname}
          </Text>
        )}
        <View style={{
          flexDirection: mine ? 'row-reverse' : 'row',
          alignItems: 'flex-end', gap: 6,
        }}>
          <View style={{
            padding: 12, paddingHorizontal: 13,
            backgroundColor: mine ? colors.primary : colors.card,
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
            shadowColor: '#2C2420', shadowOpacity: mine ? 0 : 0.04,
            shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
            elevation: mine ? 0 : 1,
          }}>
            <Text style={{
              fontSize: 13.5, lineHeight: 20,
              color: mine ? '#fff' : colors.text,
              letterSpacing: -0.1,
            }}>{msg.text}</Text>
          </View>
          <Text style={{ fontSize: 10, color: colors.textLight }}>
            {fmtHhmm(msg.ts)}
          </Text>
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
  const hh = h % 12 || 12;
  return `${ap} ${hh}:${String(m).padStart(2, '0')}`;
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
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
    fontSize: 13, color: colors.text,
  },
});
