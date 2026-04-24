import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { useAuth } from '@/store/auth';
import { INTERESTS } from '@/utils/interests';

export default function ProfileEdit() {
  const userId = useAuth((s) => s.userId);
  const [nickname, setNickname] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [nicknameQuota, setNicknameQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [job, setJob] = useState('');
  const [hasKids, setHasKids] = useState<boolean | null>(null);
  const [custody, setCustody] = useState<string | null>(null);
  const [intro, setIntro] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.get<{
      nickname: string; job: string | null; has_kids: number | null;
      custody: string | null; intro: string | null; interests: string | null;
    }>(`/profiles/${userId}`)
      .then((p) => {
        if (p.nickname) { setNickname(p.nickname); setOriginalNickname(p.nickname); }
        if (p.job) setJob(p.job);
        if (p.has_kids !== null) setHasKids(p.has_kids === 1);
        if (p.custody) setCustody(p.custody);
        if (p.intro) setIntro(p.intro);
        if (p.interests) {
          const valid = new Set<string>(INTERESTS);
          setInterests(p.interests.split(',').map((s) => s.trim()).filter((i) => valid.has(i)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<{ used: number; limit: number; remaining: number }>('/auth/nickname/quota')
      .then(setNicknameQuota)
      .catch(() => {});
  }, [userId]);

  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : prev.length >= 3 ? prev : [...prev, item]
    );
  }

  async function save() {
    setSaving(true);
    try {
      // 닉네임이 바뀐 경우에만 전용 엔드포인트 호출 (월 3회 제한 + 중복 체크)
      const trimmedNick = nickname.trim();
      if (trimmedNick && trimmedNick !== originalNickname) {
        try {
          await api.post('/auth/nickname', { nickname: trimmedNick });
          setOriginalNickname(trimmedNick);
          // 변경 성공 시 quota 재조회
          api.get<{ used: number; limit: number; remaining: number }>('/auth/nickname/quota')
            .then(setNicknameQuota).catch(() => {});
        } catch (e) {
          const msg = (e as Error).message;
          if (msg.includes('nickname_taken')) {
            Alert.alert('닉네임 중복', '이미 사용 중인 닉네임이에요');
          } else if (msg.includes('rate_limited')) {
            Alert.alert('변경 한도 초과', '이번 달 변경 한도를 초과했어요 (월 3회)');
          } else if (msg.includes('invalid_length')) {
            Alert.alert('닉네임 길이', '2~20자로 입력해주세요');
          } else if (msg.includes('empty_nickname')) {
            Alert.alert('닉네임', '닉네임을 입력해주세요');
          } else {
            Alert.alert('닉네임 변경 실패', msg);
          }
          setSaving(false);
          return;
        }
      }

      await api.patch('/profiles/me', {
        job,
        hasKids,
        custody: hasKids ? custody : null,
        intro,
        interests: interests.join(','),
      });
      Alert.alert('저장 완료');
      router.back();
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally { setSaving(false); }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>
        닉네임
        {nicknameQuota && (
          <Text style={{ fontSize: 12, fontWeight: '400', color: colors.textSub }}>
            {'  '}(이번 달 {nicknameQuota.remaining}회 더 변경 가능)
          </Text>
        )}
      </Text>
      <TextInput style={styles.input} value={nickname} onChangeText={setNickname}
        placeholder="2~20자" placeholderTextColor={colors.textSub} maxLength={20} />

      <Text style={styles.label}>직업</Text>
      <TextInput style={styles.input} value={job} onChangeText={setJob}
        placeholder="예: 회사원, 자영업, 프리랜서..." placeholderTextColor={colors.textSub} />

      <Text style={styles.label}>자녀 유무</Text>
      <View style={styles.row}>
        {[{ v: true, l: '있음' }, { v: false, l: '없음' }].map(({ v, l }) => (
          <Pressable key={l} onPress={() => { setHasKids(v); if (!v) setCustody(null); }}
            style={[styles.chip, hasKids === v && styles.chipOn]}>
            <Text style={[styles.chipText, hasKids === v && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {hasKids === true && (
        <>
          <Text style={styles.label}>양육 여부</Text>
          <View style={styles.row}>
            {[{ v: 'custody', l: '양육 중' }, { v: 'non_custody', l: '비양육' }].map(({ v, l }) => (
              <Pressable key={v} onPress={() => setCustody(v)}
                style={[styles.chip, custody === v && styles.chipOn]}>
                <Text style={[styles.chipText, custody === v && { color: '#fff' }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>자기소개</Text>
      <TextInput style={[styles.input, styles.textarea]} value={intro} onChangeText={setIntro}
        placeholder="간단한 소개" placeholderTextColor={colors.textSub}
        multiline textAlignVertical="top" />

      <Text style={styles.label}>
        관심사 <Text style={{ fontSize: 12, fontWeight: '400', color: colors.textSub }}>
          (최대 3개 · {interests.length}/3)
        </Text>
      </Text>
      <View style={styles.chipRow}>
        {INTERESTS.map((item) => (
          <Pressable
            key={item}
            onPress={() => toggleInterest(item)}
            style={[styles.chip, interests.includes(item) && styles.chipOn]}
          >
            <Text style={[styles.chipText, interests.includes(item) && { color: '#fff' }]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.cta, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>저장</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.bg, flexGrow: 1 },
  label: { ...typography.caption, color: colors.textSub, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md,
  },
  textarea: { minHeight: 100 },
  row: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, color: colors.text },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', ...typography.h3 },
});
