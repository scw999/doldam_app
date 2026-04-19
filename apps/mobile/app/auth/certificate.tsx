import { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';

type Status = 'idle' | 'uploading' | 'pending' | 'verified' | 'rejected';

export default function CertificateScreen() {
  const [status, setStatus] = useState<Status>('idle');
  const [reason, setReason] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function pickAndUpload() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      quality: 0.9,
    });
    if (res.canceled) return;
    const asset = res.assets[0];

    setStatus('uploading');
    const form = new FormData();
    if (Platform.OS === 'web' && (asset as unknown as { file?: File }).file) {
      form.append('file', (asset as unknown as { file: File }).file);
    } else {
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'certificate.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
    }

    try {
      await api.upload('/auth/certificate', form, { auth: 'temp' });
      setStatus('pending');
      startPolling();
    } catch (e) {
      setStatus('idle');
      Alert.alert('업로드 실패', (e as Error).message);
    }
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get<{ status: Status; reason?: string }>(
          '/auth/certificate/status',
          { auth: 'temp' }
        );
        if (s.status === 'verified') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('verified');
          setTimeout(() => router.replace('/auth/onboarding'), 800);
        } else if (s.status === 'rejected') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('rejected');
          setReason(s.reason ?? null);
        }
      } catch {
        // 네트워크 일시 오류는 무시하고 다음 주기에 재시도
      }
    }, 2500);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>혼인관계증명서 업로드</Text>
      <Text style={styles.sub}>
        사진 또는 PDF 캡처를 올려주세요. OCR로 이혼 기록을 확인하며,
        검증 후 파일은 즉시 삭제됩니다.
      </Text>

      {status === 'idle' && (
        <Pressable style={styles.cta} onPress={pickAndUpload}>
          <Text style={styles.ctaText}>파일 선택</Text>
        </Pressable>
      )}

      {status === 'uploading' && (
        <View style={styles.state}><ActivityIndicator /><Text style={styles.stateText}>업로드 중...</Text></View>
      )}

      {status === 'pending' && (
        <View style={styles.state}><ActivityIndicator /><Text style={styles.stateText}>검증 중입니다 (보통 10초 이내)</Text></View>
      )}

      {status === 'verified' && (
        <Text style={[styles.stateText, { color: colors.success }]}>검증 완료! 다음 단계로 이동합니다...</Text>
      )}

      {status === 'rejected' && (
        <View>
          <Text style={[styles.stateText, { color: colors.error }]}>이혼 기록을 확인할 수 없어요.</Text>
          {reason && <Text style={styles.note}>{reason}</Text>}
          <Pressable style={[styles.cta, { marginTop: spacing.md }]} onPress={() => { setStatus('idle'); setReason(null); }}>
            <Text style={styles.ctaText}>다시 시도</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  sub: { ...typography.body, color: colors.textSub, marginTop: spacing.sm, lineHeight: 22, marginBottom: spacing.lg },
  cta: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { ...typography.h3, color: '#fff' },
  state: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  stateText: { ...typography.body, color: colors.text },
  note: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
});
