import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const clean = phone.replace(/[^0-9]/g, '');
    if (!/^01[016-9]\d{7,8}$/.test(clean)) {
      Alert.alert('잘못된 번호', '휴대폰 번호를 다시 확인해주세요');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/phone/request', { phone: clean }, { auth: 'none' });
      router.push({ pathname: '/auth/verify', params: { phone: clean } });
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
        onChangeText={setPhone}
        placeholder="휴대폰 번호 (숫자만)"
        placeholderTextColor={colors.textSub}
        keyboardType="phone-pad"
        maxLength={13}
        editable={!loading}
      />

      <Pressable style={[styles.cta, loading && styles.ctaDisabled]} onPress={onSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.ctaText}>인증번호 받기</Text>}
      </Pressable>

      <Text style={styles.note}>본인인증 후 혼인관계증명서로 돌싱 여부를 확인해요.{'\n'}파일은 검증 직후 삭제됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.h1, color: colors.primary, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSub, textAlign: 'center', marginBottom: spacing.xl },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  cta: {
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...typography.h3, color: '#fff' },
  note: { ...typography.caption, color: colors.textSub, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
});
