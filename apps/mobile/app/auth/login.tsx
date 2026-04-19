import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

function formatPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handlePhoneChange(raw: string) {
    setPhone(formatPhone(raw));
  }

  async function onSubmit() {
    const clean = phone.replace(/[^0-9]/g, '');
    if (!/^01[016-9]\d{7,8}$/.test(clean)) {
      Alert.alert('잘못된 번호', '휴대폰 번호를 다시 확인해주세요');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ ok: boolean; devCode?: string }>(
        '/auth/phone/request', { phone: clean }, { auth: 'none' }
      );
      setSent(true);
      setTimeout(() => {
        router.push({ pathname: '/auth/verify', params: { phone: clean, devCode: res.devCode ?? '' } });
      }, 800);
    } catch (e) {
      Alert.alert('발송 실패', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>돌담</Text>
      <Text style={styles.sub}>인증된 돌싱만의 공간</Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={handlePhoneChange}
        placeholder="010-0000-0000"
        placeholderTextColor={colors.textSub}
        keyboardType="phone-pad"
        maxLength={13}
        editable={!loading && !sent}
      />

      {sent ? (
        <View style={styles.sentBox}>
          <Text style={styles.sentText}>✓ 인증번호를 보냈습니다</Text>
        </View>
      ) : (
        <Pressable style={[styles.cta, loading && styles.ctaDisabled]} onPress={onSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.ctaText}>인증번호 받기</Text>}
        </Pressable>
      )}

      <Text style={styles.note}>
        본인인증 후 혼인관계증명서로 돌싱 여부를 확인해요.{'\n'}파일은 검증 직후 삭제됩니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { ...typography.h1, color: colors.primary, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSub, textAlign: 'center', marginBottom: spacing.xl },
  input: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  cta: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...typography.h3, color: '#fff' },
  sentBox: {
    backgroundColor: colors.green + '22',
    borderWidth: 1, borderColor: colors.green + '55',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  sentText: { fontSize: 14, fontWeight: '600', color: colors.green },
  note: { ...typography.caption, color: colors.textSub, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
});
