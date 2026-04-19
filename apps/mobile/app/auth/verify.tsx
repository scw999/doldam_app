import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { useAuth } from '@/store/auth';
import { decodeJwtSub } from '@/utils/jwt';

type VerifyResp =
  | { status: 'existing'; token: string }
  | { status: 'new'; tempToken: string };

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const setTemp = useAuth((s) => s.setTempToken);

  async function onSubmit() {
    if (code.length !== 6) {
      Alert.alert('오류', '6자리 인증번호를 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const resp = await api.post<VerifyResp>(
        '/auth/phone/verify',
        { phone, code },
        { auth: 'none' }
      );

      if (resp.status === 'existing') {
        const userId = decodeJwtSub(resp.token);
        if (!userId) throw new Error('invalid_token');
        await setUser(resp.token, userId);
        router.replace('/(tabs)');
      } else {
        await setTemp(resp.tempToken);
        router.replace('/auth/certificate');
      }
    } catch (e) {
      Alert.alert('인증 실패', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>인증번호 입력</Text>
      <Text style={styles.sub}>{phone} 으로 전송된 6자리 코드</Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.textSub}
        editable={!loading}
      />

      <Pressable style={[styles.cta, loading && { opacity: 0.6 }]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>확인</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textSub, marginTop: spacing.xs, marginBottom: spacing.lg },
  input: {
    ...typography.h2, color: colors.text, textAlign: 'center',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, letterSpacing: 8,
  },
  cta: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { ...typography.h3, color: '#fff' },
});
