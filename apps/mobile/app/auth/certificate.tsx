import { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, radius, shadow } from '@/theme';
import { api } from '@/api';

type Status = 'idle' | 'uploading' | 'pending' | 'verified' | 'rejected';

// ---- 아이콘 ----
function CheckIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SearchIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6} stroke={color} strokeWidth={2.4} />
      <Path d="M20 20l-4-4" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
function XIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
function DocIcon({ size = 38, color = colors.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v5h5" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 14l2 2 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ShieldIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function EyeOffIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12s3.5-6 9-6c2 0 3.7.7 5 1.7M21 12s-3.5 6-9 6c-2 0-3.7-.7-5-1.7" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2.5} stroke={color} strokeWidth={1.7} />
      <Path d="M4 4l16 16" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
function BadgeIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={9} r={5} stroke={color} strokeWidth={1.7} />
      <Path d="M9 13l-2 8 5-3 5 3-2-8" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

// ---- 단계 프로그레스 ----
type StepState = 'done' | 'current' | 'pending' | 'error';
function Step({ state, label, idx }: { state: StepState; label: string; idx: number }) {
  const bg =
    state === 'done' ? colors.success :
    state === 'current' ? colors.primary :
    state === 'error' ? colors.error :
    colors.border;
  const labelColor = state === 'pending' ? colors.textLight : colors.text;

  return (
    <View style={s.stepWrap}>
      <View style={[s.stepCircle, { backgroundColor: bg }]}>
        {state === 'done' && <CheckIcon size={14} color="#fff" />}
        {state === 'current' && (idx === 2 ? <SearchIcon size={15} color="#fff" /> : <Text style={s.stepNum}>{idx}</Text>)}
        {state === 'error' && <XIcon size={13} color="#fff" />}
        {state === 'pending' && <Text style={[s.stepNum, { color: colors.textLight }]}>{idx}</Text>}
      </View>
      <Text style={[s.stepLabel, { color: labelColor, fontWeight: state === 'current' ? '700' : '500' }]}>{label}</Text>
    </View>
  );
}
function StepConnector({ filled }: { filled: boolean }) {
  return <View style={[s.connector, { backgroundColor: filled ? colors.success : colors.border }]} />;
}
function StepProgress({ status }: { status: Status }) {
  // step 1 = 서류 제출, 2 = 검토 중, 3 = 승인 완료
  let states: StepState[];
  if (status === 'idle' || status === 'uploading') {
    states = ['current', 'pending', 'pending'];
  } else if (status === 'pending') {
    states = ['done', 'current', 'pending'];
  } else if (status === 'verified') {
    states = ['done', 'done', 'done'];
  } else {
    states = ['done', 'error', 'pending'];
  }
  return (
    <View style={s.stepRow}>
      <Step state={states[0]} label="서류 제출" idx={1} />
      <StepConnector filled={states[0] === 'done'} />
      <Step state={states[1]} label="검토 중" idx={2} />
      <StepConnector filled={states[1] === 'done'} />
      <Step state={states[2]} label="승인 완료" idx={3} />
    </View>
  );
}

// ---- 안심 포인트 ----
function ReassuranceBullet({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.bulletIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.bulletTitle}>{title}</Text>
        <Text style={s.bulletSub}>{sub}</Text>
      </View>
    </View>
  );
}

export default function CertificateScreen() {
  const [status, setStatus] = useState<Status>('idle');
  const [reason, setReason] = useState<string | null>(null);
  const [checkingMount, setCheckingMount] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 진입 시 기존 상태 확인 (재방문 흐름 지원)
  useEffect(() => {
    api.get<{ status: Status | 'not_found'; reason?: string }>('/auth/certificate/status', { auth: 'temp' })
      .then((res) => {
        if (res.status === 'verified') {
          setStatus('verified');
          setTimeout(() => router.replace('/auth/onboarding'), 800);
        } else if (res.status === 'pending') {
          setStatus('pending');
          startPolling();
        } else if (res.status === 'rejected') {
          setStatus('rejected');
          setReason(res.reason ?? null);
        }
      })
      .catch(() => { /* 토큰 만료 등 → idle 유지 */ })
      .finally(() => setCheckingMount(false));

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function pickAndUpload() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      setReason(null);
      startPolling();
    } catch (e) {
      setStatus('idle');
      Alert.alert('업로드 실패', (e as Error).message);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get<{ status: Status; reason?: string }>('/auth/certificate/status', { auth: 'temp' });
        if (r.status === 'verified') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('verified');
          setTimeout(() => router.replace('/auth/onboarding'), 800);
        } else if (r.status === 'rejected') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('rejected');
          setReason(r.reason ?? null);
        }
      } catch { /* 다음 주기에 재시도 */ }
    }, 4000);
  }

  function goHome() {
    if (pollRef.current) clearInterval(pollRef.current);
    router.replace('/auth/login');
  }

  function resubmit() {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus('idle');
    setReason(null);
  }

  // 진입 직후 깜빡임 방지
  if (checkingMount) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const card = renderCard(status, reason);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <StepProgress status={status} />

      {card}

      {/* 3가지 안심 포인트 */}
      <View style={s.bulletCard}>
        <ReassuranceBullet
          icon={<ShieldIcon />}
          title="검토 후 서류는 즉시 삭제돼요"
          sub="원본은 서버에 저장되지 않아요"
        />
        <View style={s.bulletDivider} />
        <ReassuranceBullet
          icon={<EyeOffIcon />}
          title="실명·사진은 공개되지 않아요"
          sub="인증은 자격 확인에만 쓰여요"
        />
        <View style={s.bulletDivider} />
        <ReassuranceBullet
          icon={<BadgeIcon />}
          title="인증은 처음 한 번이면 끝나요"
          sub="이후엔 완전한 익명으로 활동해요"
        />
      </View>

      {/* CTA */}
      {status === 'idle' && (
        <Pressable style={s.cta} onPress={pickAndUpload}>
          <Text style={s.ctaText}>파일 선택</Text>
        </Pressable>
      )}
      {status === 'uploading' && (
        <Pressable style={[s.cta, { opacity: 0.7 }]} disabled>
          <ActivityIndicator color="#fff" />
        </Pressable>
      )}
      {status === 'pending' && (
        <>
          <Pressable style={s.cta} onPress={goHome}>
            <Text style={s.ctaText}>홈으로 돌아가기</Text>
          </Pressable>
          <Pressable onPress={resubmit} style={s.secondary}>
            <Text style={s.secondaryText}>다른 파일로 다시 제출</Text>
          </Pressable>
        </>
      )}
      {status === 'verified' && (
        <Pressable style={[s.cta, { backgroundColor: colors.success }]} disabled>
          <Text style={s.ctaText}>다음 단계로 이동 중...</Text>
        </Pressable>
      )}
      {status === 'rejected' && (
        <>
          <Pressable style={s.cta} onPress={resubmit}>
            <Text style={s.ctaText}>다시 제출하기</Text>
          </Pressable>
          <Pressable onPress={goHome} style={s.secondary}>
            <Text style={s.secondaryText}>나중에 다시 시도</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function renderCard(status: Status, reason: string | null) {
  if (status === 'idle' || status === 'uploading') {
    return (
      <View style={s.statusCard}>
        <View style={[s.statusIconWrap, { backgroundColor: colors.primary + '1A' }]}>
          <DocIcon color={colors.primary} />
        </View>
        <Text style={s.statusTitle}>혼인관계증명서를 올려주세요</Text>
        <Text style={s.statusSub}>
          사진 또는 PDF 캡처를 선택해 주세요.{'\n'}담당자가 확인 후 가입을 승인합니다.
        </Text>
        <View style={[s.pill, { backgroundColor: colors.tag }]}>
          <Text style={[s.pillText, { color: colors.textSub }]}>서류 대기</Text>
        </View>
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View style={s.statusCard}>
        <View style={[s.statusIconWrap, { backgroundColor: colors.success + '1F' }]}>
          <DocIcon color={colors.success} />
        </View>
        <Text style={s.statusTitle}>검토 요청이 접수됐어요</Text>
        <Text style={s.statusSub}>
          담당자가 서류를 확인한 뒤 승인 알림을 보내드려요.{'\n'}보통 1~2 영업일 이내에 처리돼요.
        </Text>
        <View style={[s.pill, { backgroundColor: '#F4D88E' }]}>
          <Text style={[s.pillText, { color: '#7A5000' }]}>검토 중</Text>
        </View>
      </View>
    );
  }
  if (status === 'verified') {
    return (
      <View style={s.statusCard}>
        <View style={[s.statusIconWrap, { backgroundColor: colors.success + '1F' }]}>
          <View style={[s.statusCheck, { backgroundColor: colors.success }]}>
            <CheckIcon size={20} color="#fff" />
          </View>
        </View>
        <Text style={s.statusTitle}>인증이 완료됐어요</Text>
        <Text style={s.statusSub}>잠시 후 다음 단계로 이동해요.</Text>
        <View style={[s.pill, { backgroundColor: colors.success + '22' }]}>
          <Text style={[s.pillText, { color: colors.success }]}>승인 완료</Text>
        </View>
      </View>
    );
  }
  // rejected
  return (
    <View style={s.statusCard}>
      <View style={[s.statusIconWrap, { backgroundColor: colors.error + '1F' }]}>
        <View style={[s.statusCheck, { backgroundColor: colors.error }]}>
          <XIcon size={18} color="#fff" />
        </View>
      </View>
      <Text style={s.statusTitle}>이혼 기록을 확인할 수 없어요</Text>
      <Text style={s.statusSub}>
        {reason ? reason : '서류가 흐릿하거나 정보가 가려져 있을 수 있어요. 새 사진으로 다시 제출해 주세요.'}
      </Text>
      <View style={[s.pill, { backgroundColor: colors.error + '22' }]}>
        <Text style={[s.pillText, { color: colors.error }]}>반려</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.md, gap: spacing.lg },

  // 단계 프로그레스
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.xs, marginTop: spacing.sm,
  },
  stepWrap: { alignItems: 'center', width: 70 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#fff' },
  stepLabel: { fontSize: 12, marginTop: 6, letterSpacing: -0.2 },
  connector: { flex: 1, height: 2, marginTop: 15, marginHorizontal: -8 },

  // 상태 카드
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  statusIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statusCheck: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTitle: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  statusSub: { ...typography.body, color: colors.textSub, textAlign: 'center', lineHeight: 21, marginBottom: spacing.md },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full },
  pillText: { fontSize: 12, fontWeight: '700' },

  // 안심 포인트 카드
  bulletCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, gap: spacing.md,
  },
  bulletIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
  bulletSub: { fontSize: 12, color: colors.textSub, lineHeight: 17 },
  bulletDivider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },

  // CTA
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.primaryCta,
  },
  ctaText: { ...typography.h3, color: '#fff' },
  secondary: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryText: { fontSize: 13, color: colors.textSub, fontWeight: '500' },
});
