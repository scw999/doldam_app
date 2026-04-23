import { useCallback, useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

interface Prefs {
  comment: boolean;
  reply: boolean;
  hot_vote: boolean;
  chat: boolean;
}

interface RoomMute {
  roomId: string;
  theme: string;
  muted: boolean;
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [rooms, setRooms] = useState<RoomMute[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefsRes, roomsRes] = await Promise.all([
        api.get<Prefs>('/notifications/preferences', { cacheTtl: 0 }),
        api.get<{ items: { id: string; theme: string }[] }>('/rooms/mine', { cacheTtl: 0 }).catch(() => ({ items: [] })),
      ]);
      setPrefs(prefsRes);

      const roomMutes = await Promise.all(
        roomsRes.items.map(async (r) => {
          const muteRes = await api.get<{ muted: boolean }>(`/notifications/rooms/${r.id}/mute`, { cacheTtl: 0 }).catch(() => ({ muted: false }));
          return { roomId: r.id, theme: r.theme, muted: muteRes.muted };
        })
      );
      setRooms(roomMutes);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function togglePref(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await api.patch('/notifications/preferences', { [key]: value }).catch(() => {
      setPrefs(prefs);
    });
  }

  async function toggleRoomMute(roomId: string, muted: boolean) {
    setRooms((prev) => prev.map((r) => r.roomId === roomId ? { ...r, muted } : r));
    if (muted) {
      await api.post(`/notifications/rooms/${roomId}/mute`, {}).catch(() => {});
    } else {
      await api.delete(`/notifications/rooms/${roomId}/mute`).catch(() => {});
    }
  }

  async function sendTestPush() {
    try {
      await api.post('/notifications/test-self', {});
      Alert.alert('전송 완료', '잠시 후 푸시 알림이 도착해요');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('no_tokens_registered')) {
        Alert.alert('토큰 미등록', '아직 이 기기의 푸시 토큰이 서버에 등록되지 않았어요. 아래 "진단 실행"으로 원인을 확인해보세요.');
      } else {
        Alert.alert('전송 실패', msg);
      }
    }
  }

  const [diag, setDiag] = useState<{
    permission: string;
    token: string;
    registerOk: boolean | null;
    error: string;
  } | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  async function runDiagnostics() {
    setDiagRunning(true);
    const result = { permission: '', token: '', registerOk: null as boolean | null, error: '' };
    try {
      const existing = await Notifications.getPermissionsAsync();
      result.permission = `existing=${existing.status}`;
      if (existing.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        result.permission += ` · requested=${req.status}`;
        if (req.status !== 'granted') {
          result.error = `알림 권한이 거부되었어요 (${req.status}). 기기 설정에서 돌담 알림 허용을 켜주세요.`;
          setDiag(result); return;
        }
      }
      let pushToken;
      try {
        pushToken = await Notifications.getExpoPushTokenAsync({
          projectId: 'e319fb49-251c-4449-b120-d58ddb2ddc8d',
        });
      } catch (e) {
        result.error = `토큰 획득 실패: ${(e as Error).message}`;
        setDiag(result); return;
      }
      if (!pushToken?.data) {
        result.error = '토큰이 비어있어요. 에뮬레이터이거나 FCM 설정이 누락됐을 수 있어요.';
        setDiag(result); return;
      }
      result.token = pushToken.data;
      try {
        await api.post('/notifications/token', { token: pushToken.data, platform: Platform.OS });
        result.registerOk = true;
      } catch (e) {
        result.registerOk = false;
        result.error = `서버 등록 실패: ${(e as Error).message}`;
      }
      setDiag(result);
    } finally {
      setDiagRunning(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 80 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 14,
        backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 10 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </Pressable>
        <Text style={[typography.h2, { color: colors.text, fontSize: 17 }]}>알림 설정</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <Pressable style={styles.testButton} onPress={sendTestPush}>
          <Text style={styles.testButtonText}>🧪 푸시 테스트 보내기</Text>
        </Pressable>

        <Pressable
          style={[styles.testButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: -8, marginBottom: spacing.md }]}
          onPress={runDiagnostics}
          disabled={diagRunning}
        >
          <Text style={[styles.testButtonText, { color: colors.text }]}>
            {diagRunning ? '진단 중...' : '🔎 진단 실행 (토큰 등록 단계별 확인)'}
          </Text>
        </Pressable>

        {diag && (
          <View style={[styles.card, { padding: spacing.md, marginBottom: spacing.lg, gap: 6 }]}>
            <Text style={{ fontSize: 11, color: colors.textSub }}>1) 권한: {diag.permission || '-'}</Text>
            <Text style={{ fontSize: 11, color: colors.textSub }} numberOfLines={2}>
              2) Expo 토큰: {diag.token ? diag.token.slice(0, 50) + '...' : '-'}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSub }}>
              3) 서버 등록: {diag.registerOk === true ? '✅ 성공' : diag.registerOk === false ? '❌ 실패' : '-'}
            </Text>
            {diag.error ? (
              <Text style={{ fontSize: 12, color: '#E85D4A', marginTop: 6, lineHeight: 17 }}>
                에러: {diag.error}
              </Text>
            ) : diag.registerOk ? (
              <Text style={{ fontSize: 12, color: colors.green, marginTop: 6 }}>
                ✓ 토큰 등록 완료. 위의 "푸시 테스트 보내기"를 눌러 알림 수신 확인.
              </Text>
            ) : null}
          </View>
        )}

        <Text style={styles.sectionTitle}>활동 알림</Text>
        <View style={styles.card}>
          {prefs && [
            { key: 'comment' as const, label: '내 글에 댓글', desc: '내가 쓴 게시글에 댓글이 달릴 때' },
            { key: 'reply' as const, label: '내 댓글에 대댓글', desc: '내 댓글에 답글이 달릴 때' },
            { key: 'hot_vote' as const, label: '핫 투표 알림', desc: '내 투표가 인기 투표가 될 때' },
            { key: 'chat' as const, label: '채팅 메시지', desc: '채팅방에 새 메시지가 올 때 (전체 기본값)' },
          ].map(({ key, label, desc }, i, arr) => (
            <View key={key} style={[styles.row, i < arr.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowDesc}>{desc}</Text>
              </View>
              <Switch
                value={prefs[key]}
                onValueChange={(v) => togglePref(key, v)}
                trackColor={{ false: colors.border, true: colors.primary + '99' }}
                thumbColor={prefs[key] ? colors.primary : colors.textLight}
              />
            </View>
          ))}
        </View>

        {rooms.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>채팅방별 알림</Text>
            <Text style={styles.sectionDesc}>채팅 메시지 알림을 방별로 켜고 끌 수 있어요</Text>
            <View style={styles.card}>
              {rooms.map((room, i) => (
                <View key={room.roomId} style={[styles.row, i < rooms.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{room.theme}</Text>
                  </View>
                  <Switch
                    value={!room.muted}
                    onValueChange={(v) => toggleRoomMute(room.roomId, !v)}
                    trackColor={{ false: colors.border, true: colors.primary + '99' }}
                    thumbColor={!room.muted ? colors.primary : colors.textLight}
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: 6 },
  sectionDesc: { fontSize: 12, color: colors.textSub, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: '500', marginBottom: 2 },
  rowDesc: { fontSize: 12, color: colors.textSub },
  testButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  testButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
