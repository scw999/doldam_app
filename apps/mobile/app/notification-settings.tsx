import { useCallback, useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
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
});
