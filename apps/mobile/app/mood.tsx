import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

type MoodKey = 'good' | 'hopeful' | 'soso' | 'sad' | 'lonely' | 'anxious' | 'angry' | 'joyful' | 'happy' | 'excited';
type Visibility = 'private' | 'friends' | 'public';

const MOODS: { k: MoodKey; label: string; emoji: string }[] = [
  { k: 'happy',   label: '행복해요',  emoji: '🥰' },
  { k: 'joyful',  label: '즐거워요',  emoji: '😄' },
  { k: 'excited', label: '기뻐요',   emoji: '🤩' },
  { k: 'good',    label: '괜찮아요',  emoji: '🌤️' },
  { k: 'hopeful', label: '희망보여요', emoji: '🌱' },
  { k: 'soso',    label: '멍해요',   emoji: '😶' },
  { k: 'sad',     label: '울적해요',  emoji: '😔' },
  { k: 'lonely',  label: '무너져요',  emoji: '😭' },
  { k: 'anxious', label: '답답해요',  emoji: '😤' },
  { k: 'angry',   label: '열받아요',  emoji: '🔥' },
];

interface MoodItem {
  id: string;
  mood: MoodKey;
  note?: string;
  like_count: number;
  myLiked?: boolean;
  created_at: number;
  nickname?: string;
  gender?: 'M' | 'F';
  age_range?: string;
}

interface TodayMood {
  id: string;
  mood: MoodKey;
  note?: string;
  visibility: 'private' | 'friends' | 'public';
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function MoodScreen() {
  const insets = useSafeAreaInsets();
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const [mood, setMood] = useState<MoodKey | null>((preset as MoodKey) ?? null);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [sending, setSending] = useState(false);
  const [todayMood, setTodayMood] = useState<TodayMood | null>(null);
  const [editing, setEditing] = useState(false);
  const [feed, setFeed] = useState<MoodItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feedRes, mineRes] = await Promise.all([
        api.get<{ items: MoodItem[] }>('/moods/feed'),
        api.get<{ items: TodayMood[] }>('/moods/feed?mine=true&limit=1'),
      ]);
      setFeed(feedRes.items);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const tm = mineRes.items[0];
      if (tm && (tm as any).created_at >= todayStart.getTime()) {
        setTodayMood(tm);
        if (!editing) {
          setMood(tm.mood);
          setNote(tm.note ?? '');
          setVisibility(tm.visibility);
        }
      } else {
        setTodayMood(null);
      }
    } catch {}
    finally { setLoading(false); }
  }, [editing]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submit() {
    if (!mood) return Alert.alert('선택 필요', '지금 기분을 골라주세요');
    setSending(true);
    try {
      if (todayMood && !editing) {
        // 이미 있지만 아직 수정 모드 아님 → 수정 모드로 진입
        setEditing(true);
        setSending(false);
        return;
      }
      if (todayMood) {
        await api.patch(`/moods/${todayMood.id}`, { mood, note: note.trim() || undefined, visibility });
        setEditing(false);
      } else {
        await api.post('/moods', { mood, note: note.trim() || undefined, visibility });
      }
      load();
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setSending(false); }
  }

  async function toggleLike(item: MoodItem) {
    const newLiked = !item.myLiked;
    setFeed((prev) => prev.map((m) =>
      m.id === item.id
        ? { ...m, myLiked: newLiked, like_count: m.like_count + (newLiked ? 1 : -1) }
        : m
    ));
    try {
      await api.post(`/moods/${item.id}/like`, {});
    } catch {
      setFeed((prev) => prev.map((m) =>
        m.id === item.id
          ? { ...m, myLiked: item.myLiked, like_count: item.like_count }
          : m
      ));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </Pressable>
        <Text style={[typography.h3, { color: colors.text }]}>감정 기록</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, color: colors.textSub }}>기록 시 +3P</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 오늘의 기분 기록 */}
        <View style={styles.recordBox}>
          {(todayMood && !editing) ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>✅</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryDark }}>
                오늘 기분 기록 완료
              </Text>
              {todayMood.note ? (
                <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 4 }}>
                  "{todayMood.note}"
                </Text>
              ) : null}
              <Pressable
                onPress={() => setEditing(true)}
                style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}
              >
                <Text style={{ fontSize: 12, color: colors.textSub }}>✏️ 수정하기</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[typography.h3, { color: colors.text, marginBottom: 14 }]}>
                지금 기분은? <Text style={{ fontSize: 12, color: colors.textSub, fontWeight: '400' }}>하루 한 번</Text>
              </Text>

              <View style={styles.moodGrid}>
                {MOODS.map((m) => (
                  <Pressable
                    key={m.k}
                    onPress={() => setMood(m.k)}
                    style={[styles.moodChip, mood === m.k && styles.moodChipOn]}
                  >
                    <Text style={{ fontSize: 26, lineHeight: 28 }}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, mood === m.k && { color: '#fff' }]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>

              {mood && (
                <>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="한 줄 메모 (선택 · 공개 시 피드에 표시)"
                    placeholderTextColor={colors.textSub}
                    maxLength={80}
                  />

                  <View style={styles.visRow}>
                    {([
                      { v: 'private' as Visibility, label: '🔒 나만' },
                      { v: 'friends' as Visibility, label: '👥 친구' },
                      { v: 'public'  as Visibility, label: '🌍 전체' },
                    ]).map(({ v, label }) => (
                      <Pressable
                        key={v}
                        onPress={() => setVisibility(v)}
                        style={[styles.visChip, visibility === v && styles.visOn]}
                      >
                        <Text style={[styles.visText, visibility === v && { color: '#fff' }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    style={[styles.cta, sending && { opacity: 0.6 }]}
                    onPress={submit}
                    disabled={sending}
                  >
                    {sending
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.ctaText}>{editing ? '수정 저장' : '기록하기 +3P'}</Text>
                    }
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>

        {/* 공개 감정 피드 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: 12 }]}>
            감정 피드
            <Text style={{ fontSize: 11, fontWeight: '400', color: colors.textSub }}> · 공개 기록만 표시</Text>
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : feed.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 32, fontSize: 14 }}>
              아직 공개 감정 기록이 없어요
            </Text>
          ) : (
            feed.map((item) => {
              const m = MOODS.find((x) => x.k === item.mood);
              return (
                <View key={item.id} style={styles.feedCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: item.note ? 8 : 0 }}>
                    <Text style={{ fontSize: 24 }}>{m?.emoji ?? '•'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {item.nickname ?? '익명'}
                        <Text style={{ fontWeight: '400', color: colors.textSub }}> · {m?.label}</Text>
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>
                        {timeAgo(item.created_at)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => toggleLike(item)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}
                    >
                      <Text style={{ fontSize: 16 }}>{item.myLiked ? '❤️' : '🤍'}</Text>
                      {item.like_count > 0 && (
                        <Text style={{ fontSize: 11, color: item.myLiked ? '#E85D4A' : colors.textSub, fontWeight: '600' }}>
                          {item.like_count}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                  {item.note && (
                    <Text style={{ fontSize: 13, color: colors.textSub, lineHeight: 20, marginLeft: 34 }}>
                      {item.note}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  recordBox: {
    margin: 16, padding: 18,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    width: '30%', paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  moodChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodLabel: { fontSize: 11, fontWeight: '500', color: colors.textSub },
  noteInput: {
    marginTop: 14, padding: 12,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    fontSize: 13, color: colors.text,
  },
  visRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  visChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  visOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  visText: { fontSize: 12, color: colors.text },
  cta: {
    marginTop: 14, paddingVertical: 14,
    backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  feedCard: {
    backgroundColor: colors.card, padding: 14,
    borderRadius: radius.md, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
});
