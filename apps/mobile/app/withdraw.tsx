import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '@/theme';
import { useAuth } from '@/store/auth';

const REASONS = [
  '원하는 정보가 없어요',
  '알림이 너무 많아요',
  '다른 사람과 잘 안 맞아요',
  '개인정보가 걱정돼요',
  '잠시 쉬고 싶어요',
  '기타',
];

const CONFIRM_PHRASE = '탈퇴';

export default function WithdrawScreen() {
  const clear = useAuth((s) => s.clear);
  const [reason, setReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = confirmText.trim() === CONFIRM_PHRASE && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    // DELETE에 body가 필요해서 raw fetch (api.delete는 body 미지원)
    const { token } = useAuth.getState();
    const base = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8787';
    const finalReason = reason === '기타' ? reasonText.trim() : reason ?? '';
    try {
      const res = await fetch(`${base}/auth/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: finalReason }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      Alert.alert('탈퇴 완료', '그동안 이용해주셔서 감사합니다.', [
        { text: '확인', onPress: () => clear() },
      ]);
    } catch {
      setLoading(false);
      Alert.alert('탈퇴 실패', '잠시 후 다시 시도해주세요. 계속 실패하면 고객센터에 문의해주세요.');
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll}>
      {/* 경고 헤더 */}
      <View style={s.warnCard}>
        <Text style={s.warnTitle}>⚠️ 탈퇴 전에 꼭 확인해주세요</Text>
        <Text style={s.warnText}>
          탈퇴 후에는 아래 데이터가 영구적으로 삭제되거나 분리됩니다.
        </Text>
      </View>

      <View style={s.itemBox}>
        <Item bullet="🗑" title="즉시 삭제" lines={[
          '닉네임·자기소개·관심사·자녀 정보',
          '푸시 알림 토큰 및 알림 내역',
          '차단·언락한 프로필 이력',
          '내가 받은 알림 설정',
        ]} />
        <View style={s.div} />
        <Item bullet="🔒" title="익명으로 보존" lines={[
          '쓴 글·댓글·투표 (작성자: "(탈퇴한 회원)")',
          '채팅방 메시지 (방은 자연 만료)',
          '포인트·결제 이력 (회계상)',
        ]} />
        <View style={s.div} />
        <Item bullet="↩" title="복구 불가" lines={[
          '한 번 탈퇴하면 같은 계정으로 돌아올 수 없어요',
          '같은 휴대폰 번호로 새 계정은 만들 수 있어요',
        ]} />
      </View>

      {/* 사유 (선택) */}
      <Text style={s.sectionLabel}>탈퇴 사유 (선택)</Text>
      <View style={s.reasonGrid}>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            onPress={() => setReason(r)}
            style={[s.reasonChip, reason === r && s.reasonChipActive]}
          >
            <Text style={[s.reasonText, reason === r && s.reasonTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>
      {reason === '기타' && (
        <TextInput
          style={s.reasonInput}
          value={reasonText}
          onChangeText={setReasonText}
          placeholder="간단히 적어주세요 (선택)"
          placeholderTextColor={colors.textLight}
          maxLength={200}
          multiline
        />
      )}

      {/* 확인 입력 */}
      <Text style={s.sectionLabel}>확인을 위해 "탈퇴"를 입력해주세요</Text>
      <TextInput
        style={s.confirmInput}
        value={confirmText}
        onChangeText={setConfirmText}
        placeholder="탈퇴"
        placeholderTextColor={colors.textLight}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={[s.cta, !canSubmit && s.ctaDisabled]}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.ctaText}>탈퇴하기</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()} style={s.cancel}>
        <Text style={s.cancelText}>취소</Text>
      </Pressable>
    </ScrollView>
  );
}

function Item({ bullet, title, lines }: { bullet: string; title: string; lines: string[] }) {
  return (
    <View style={s.item}>
      <View style={s.itemHead}>
        <Text style={s.itemBullet}>{bullet}</Text>
        <Text style={s.itemTitle}>{title}</Text>
      </View>
      {lines.map((l, i) => (
        <Text key={i} style={s.itemLine}>• {l}</Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.lg, gap: spacing.lg },

  warnCard: {
    backgroundColor: colors.error + '14',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  warnTitle: { fontSize: 15, fontWeight: '700', color: colors.error, marginBottom: 6 },
  warnText: { fontSize: 13, color: colors.text, lineHeight: 20 },

  itemBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  item: { paddingVertical: spacing.sm },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  itemBullet: { fontSize: 16 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemLine: { fontSize: 12, color: colors.textSub, lineHeight: 20, marginLeft: 26 },
  div: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  sectionLabel: { ...typography.h3, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs },

  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '14' },
  reasonText: { fontSize: 13, color: colors.text },
  reasonTextActive: { color: colors.primary, fontWeight: '700' },
  reasonInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
    fontSize: 14, color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  confirmInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 16, color: colors.text,
    textAlign: 'center',
    letterSpacing: 2,
  },

  cta: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaDisabled: { backgroundColor: colors.error + '50' },
  ctaText: { ...typography.h3, color: '#fff' },

  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontSize: 14, color: colors.textSub, fontWeight: '500' },
});
