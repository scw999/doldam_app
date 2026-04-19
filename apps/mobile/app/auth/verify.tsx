import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { useAuth } from '@/store/auth';
import { decodeJwtSub } from '@/utils/jwt';

type VerifyResp =
  | { status: 'existing'; token: string }
  | { status: 'new'; tempToken: string };

const TIMER = 180;

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(TIMER);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setUser = useAuth((s) => s.setUser);
  const setTemp = useAuth((s) => s.setTempToken);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSeconds(TIMER);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function resend() {
    setResending(true);
    try {
      await api.post('/auth/phone/request', { phone }, { auth: 'none' });
      setCode('');
      startTimer();
      Alert.alert('재전송 완료', '인증번호를 다시 보냈습니다');
    } catch (e) {
      Alert.alert('재전송 실패', (e as Error).message);
    } finally {
      setResending(false);
    }
  }

  async function onSubmit() {
    if (code.length !== 6) {
      Alert.alert('오류', '6자리 인증번호를 입력해주세요');
      return;
    }
    if (seconds === 0) {
      Alert.alert('시간 초과', '인증번호가 만료됐어요. 다시 받아주세요');
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

  const expired = seconds === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>인증번호 입력</Text>
      <Text style={styles.sub}>{phone}으로 전송된 6자리 코드</Text>

      <TextInput
        style={[styles.input, expired && { borderColor: colors.error + '80' }]}
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.textSub}
        editable={!loading && !expired}
        autoFocus
      />

      {/* 타이머 */}
      <View style={styles.timerRow}>
        {expired ? (
          <Text style={[styles.timer, { color: colors.error }]}>인증번호가 만료됐어요</Text>
        ) : (
          <Text style={[styles.timer, seconds <= 30 && { color: colors.error }]}>
            {fmtSec(seconds)} 안에 입력하세요
          </Text>
        )}
        <Pressable onPress={resend} disabled={resending} style={styles.resendBtn}>
          {resending
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.resendText}>재전송</Text>}
        </Pressable>
      </View>

      <Pressable
        style={[styles.cta, (loading || expired) && { opacity: 0.5 }]}
        onPress={onSubmit}
        disabled={loading || expired}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>확인</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textSub, marginTop: spacing.xs, marginBottom: spacing.lg },
  input: {
    ...typography.h2, color: colors.text, textAlign: 'center',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, letterSpacing: 8,
  },
  timerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  timer: { fontSize: 13, color: colors.textSub, fontWeight: '500' },
  resendBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
    minWidth: 60, alignItems: 'center',
  },
  resendText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  cta: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { ...typography.h3, color: '#fff' },
});
