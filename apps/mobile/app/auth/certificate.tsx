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

// ---- 안심 포인트 (한 줄 압축) ----
function ReassuranceLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={s.bulletLine}>
      <View style={s.bulletIconSm}>{icon}</View>
      <Text style={s.bulletLineText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

// ---- 서류 가이드 아이템 ----
function GuideItem({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <View style={s.guideItem}>
      <View style={s.guideNum}>
        <Text style={s.guideNumText}>{num}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.guideItemTitle}>{title}</Text>
        <Text style={s.guideItemSub}>{sub}</Text>
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
  const showGuide = status === 'idle' || status === 'rejected';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <StepProgress status={status} />

      {card}

      {/* 발급·업로드 가이드 — idle/rejected 상태에서만 노출 */}
      {showGuide && (
        <View style={s.guideCard}>
          <View style={s.guideHeader}>
            <Text style={s.guideTitle}>📋 서류 준비 가이드</Text>
          </View>
          <GuideItem
            num="1"
            title={'"혼인관계증명서 (상세)"'}
            sub="정부24 / 주민센터에서 '상세' 옵션으로 발급"
          />
          <View style={s.guideDivider} />
          <GuideItem
            num="2"
            title="6개월 이내 발급분"
            sub="오래된 서류는 반려될 수 있어요"
          />
          <View style={s.guideDivider} />
          <GuideItem
            num="3"
            title="주민번호 뒷자리 마스킹"
            sub="첫 번째 숫자(성별)만 남기고 나머지는 가려서"
          />
        </View>
      )}

      {/* 안심 포인트 — 한 줄 압축 */}
      <View style={s.bulletCard}>
        <ReassuranceLine icon={<ShieldIcon size={14} />} text="검토 후 서류는 즉시 삭제" />
        <ReassuranceLine icon={<EyeOffIcon size={14} />} text="실명·사진 비공개, 자격 확인에만 사용" />
        <ReassuranceLine icon={<BadgeIcon size={14} />} text="인증은 처음 한 번이면 끝" />
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
          <DocIcon color={colors.primary} size={28} />
        </View>
        <Text style={s.statusTitle}>혼인관계증명서를 올려주세요</Text>
        <Text style={s.statusSub}>담당자 확인 후 가입을 승인해 드려요</Text>
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
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm },

  // 단계 프로그레스
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.xs, marginTop: 2, marginBottom: 2,
  },
  stepWrap: { alignItems: 'center', width: 70 },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#fff' },
  stepLabel: { fontSize: 11, marginTop: 4, letterSpacing: -0.2 },
  connector: { flex: 1, height: 2, marginTop: 12, marginHorizontal: -8 },

  // 상태 카드 (idle: 컴팩트)
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  statusIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statusCheck: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: 2 },
  statusSub: { fontSize: 12, color: colors.textSub, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xs },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  pillText: { fontSize: 11, fontWeight: '700' },

  // 발급·업로드 가이드 카드
  guideCard: {
    backgroundColor: '#FFF7E6',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#F4D88E',
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  guideHeader: {
    paddingTop: spacing.sm,
    paddingBottom: 2,
  },
  guideTitle: { fontSize: 13, fontWeight: '700', color: '#7A5000' },
  guideItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2, gap: spacing.sm,
  },
  guideNum: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#E8A838',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  guideNumText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  guideItemTitle: { fontSize: 12, fontWeight: '700', color: '#5C3D00', marginBottom: 1 },
  guideItemSub: { fontSize: 11, color: '#7A5000', lineHeight: 15 },
  guideDivider: { height: 1, backgroundColor: '#F4D88E', marginLeft: 26 },

  // 안심 포인트 카드 (한 줄)
  bulletCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  bulletLine: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.xs + 1, gap: spacing.sm,
  },
  bulletIconSm: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletLineText: { flex: 1, fontSize: 12, color: colors.text },

  // CTA
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
    ...shadow.primaryCta,
  },
  ctaText: { ...typography.h3, color: '#fff' },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { fontSize: 12, color: colors.textSub, fontWeight: '500' },
});
