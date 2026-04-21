import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@/theme';
import { Card } from '@/ui/atoms';
import { api } from '@/api';
import { clearUnreadBadge } from '@/hooks/useUnreadCount';

interface Notif {
  id: string; title: string; body: string; read_at: number | null; created_at: number;
}

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: Notif[] }>('/notifications');
      setItems(res.items);
      // 화면 진입 시 전체 읽음 처리
      api.post('/notifications/read-all', {}).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => clearUnreadBadge();
  }, [load]));

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`, {}).catch(() => {});
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: Date.now() } : n));
  }

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
        <Text style={[typography.h2, { color: colors.text, fontSize: 17 }]}>알림</Text>
      </View>
      <FlatList
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 60 }} />
            : <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 60, fontSize: 14 }}>
                알림이 없어요
              </Text>
        }
        renderItem={({ item: n }) => (
          <Pressable onPress={() => markRead(n.id)}>
            <Card style={{
              padding: 14,
              backgroundColor: n.read_at ? colors.card : colors.accent + '40',
              borderWidth: n.read_at ? 1 : 1.5,
              borderColor: n.read_at ? colors.border : colors.primary + '40',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: n.read_at ? 'transparent' : colors.primary,
                  marginTop: 5,
                }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 3 }}>
                    {n.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSub, lineHeight: 20 }}>{n.body}</Text>
                  <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 6 }}>
                    {timeAgo(n.created_at)}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
