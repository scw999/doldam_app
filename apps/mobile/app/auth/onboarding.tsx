import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, Modal, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '@/theme';
import { api } from '@/api';
import { useAuth } from '@/store/auth';
import { REGIONS, formatRegion } from '@/utils/regions';
import { INTERESTS } from '@/utils/interests';

type Gender = 'M' | 'F';
type AgeRange = '20s' | '30s' | '40s' | '50s+';

const AGES: AgeRange[] = ['20s', '30s', '40s', '50s+'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function divorceLabel(year: number, month: number | null): string {
  const now = new Date();
  const totalMonths = (now.getFullYear() - year) * 12 + (now.getMonth() + 1) - (month ?? 6);
  if (totalMonths < 1) return '이혼 예정';
  if (totalMonths < 12) return `${totalMonths}개월차`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m === 0 ? `${y}년차` : `${y}년 ${m}개월차`;
}

export default function OnboardingScreen() {
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [divorceYear, setDivorceYear] = useState<number | null>(null);
  const [divorceMonth, setDivorceMonth] = useState<number | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [provinceModal, setProvinceModal] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const setUser = useAuth((s) => s.setUser);

  const cities = province ? (REGIONS.find((r) => r.province === province)?.cities ?? []) : [];

  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : prev.length >= 3 ? prev : [...prev, item]
    );
  }

  function selectProvince(p: string) {
    setProvince(p);
    setCity(null);
    setProvinceModal(false);
    const regionCities = REGIONS.find((r) => r.province === p)?.cities ?? [];
    if (regionCities.length === 1) {
      setCity(regionCities[0]);
    } else {
      setCityModal(true);
    }
  }

  async function onSubmit() {
    if (!gender || !ageRange || !province || !city || !divorceYear || !divorceMonth) {
      Alert.alert('입력 필요', '모든 항목을 선택해주세요');
      return;
    }
    setLoading(true);
    try {
      const region = formatRegion(province, city);
      const resp = await api.post<{ userId: string; nickname: string; token: string }>(
        '/auth/signup',
        { gender, ageRange, region, divorceYear, divorceMonth, interests },
        { auth: 'temp' }
      );
      await setUser(resp.token, resp.userId);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('가입 실패', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const regionLabel = province && city ? formatRegion(province, city) : province ?? '지역 선택';
  const ready = !!(gender && ageRange && province && city && divorceYear && divorceMonth);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>프로필 설정</Text>
      <Text style={styles.sub}>별명은 자동으로 만들어져요.</Text>

      <Text style={styles.label}>성별</Text>
      <View style={styles.row}>
        {(['M', 'F'] as Gender[]).map((g) => (
          <Chip key={g} label={g === 'M' ? '남성' : '여성'} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>

      <Text style={styles.label}>나이대</Text>
      <View style={styles.row}>
        {AGES.map((a) => (
          <Chip key={a} label={a} selected={ageRange === a} onPress={() => setAgeRange(a)} />
        ))}
      </View>

      <Text style={styles.label}>지역</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => setProvinceModal(true)}
          style={[styles.dropdown, province && styles.dropdownSelected]}
        >
          <Text style={[styles.dropdownText, province && styles.dropdownTextSelected]}>
            {province ?? '도/광역시 선택'}
          </Text>
          <Text style={{ fontSize: 12, color: province ? '#fff' : colors.textSub }}>▼</Text>
        </Pressable>
        {province && cities.length > 1 && (
          <Pressable
            onPress={() => setCityModal(true)}
            style={[styles.dropdown, city && styles.dropdownSelected]}
          >
            <Text style={[styles.dropdownText, city && styles.dropdownTextSelected]}>
              {city ?? '시/구 선택'}
            </Text>
            <Text style={{ fontSize: 12, color: city ? '#fff' : colors.textSub }}>▼</Text>
          </Pressable>
        )}
      </View>
      {province && city && (
        <Text style={styles.regionLabel}>📍 {regionLabel}</Text>
      )}

      <Text style={styles.label}>이혼 연도</Text>
      <Text style={styles.labelSub}>이혼한 해를 선택해주세요</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4, paddingTop: 2 }}
      >
        {YEARS.map((y) => (
          <Pressable
            key={y}
            onPress={() => { setDivorceYear(y); setDivorceMonth(null); }}
            style={[styles.yearChip, divorceYear === y && styles.yearChipOn]}
          >
            <Text style={[styles.yearNum, divorceYear === y && { color: '#fff' }]}>{y}</Text>
            <Text style={[styles.yearSub, divorceYear === y && { color: 'rgba(255,255,255,.8)' }]}>
              {divorceLabel(y, null)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {divorceYear && (
        <>
          <Text style={[styles.label, { marginTop: 20 }]}>이혼 월</Text>
          <Text style={styles.labelSub}>{divorceYear}년 몇 월에 이혼하셨나요?</Text>
          <View style={styles.rowWrap}>
            {MONTHS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setDivorceMonth(m)}
                style={[styles.chip, divorceMonth === m && styles.chipOn]}
              >
                <Text style={[styles.chipText, divorceMonth === m && styles.chipTextOn]}>{m}월</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {divorceYear && divorceMonth && (
        <View style={styles.selectedYear}>
          <Text style={styles.selectedYearText}>
            {divorceYear}년 {divorceMonth}월 이혼 · 이혼{' '}
            <Text style={{ fontWeight: '700', color: colors.primary }}>
              {divorceLabel(divorceYear, divorceMonth)}
            </Text>
          </Text>
        </View>
      )}

      <Text style={[styles.label, { marginTop: 20 }]}>
        취미 <Text style={styles.optional}>(최대 3개 선택 · 매칭에 활용 · {interests.length}/3)</Text>
      </Text>
      <View style={styles.rowWrap}>
        {INTERESTS.map((item) => (
          <Pressable
            key={item}
            onPress={() => toggleInterest(item)}
            style={[styles.chip, interests.includes(item) && styles.chipOn]}
          >
            <Text style={[styles.chipText, interests.includes(item) && styles.chipTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.cta, (!ready || loading) && { opacity: 0.5 }]}
        onPress={onSubmit}
        disabled={!ready || loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>돌담 시작하기</Text>}
      </Pressable>

      {/* 도/광역시 선택 모달 */}
      <Modal visible={provinceModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProvinceModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>도/광역시 선택</Text>
            <FlatList
              data={REGIONS}
              keyExtractor={(r) => r.province}
              renderItem={({ item }) => (
                <Pressable style={styles.modalItem} onPress={() => selectProvince(item.province)}>
                  <Text style={styles.modalItemText}>{item.province}</Text>
                </Pressable>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 시/구 선택 모달 */}
      <Modal visible={cityModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCityModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{province} 시/구 선택</Text>
            <FlatList
              data={cities}
              keyExtractor={(c) => c}
              renderItem={({ item }) => (
                <Pressable style={styles.modalItem} onPress={() => { setCity(item); setCityModal(false); }}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </Pressable>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, padding: spacing.md, paddingBottom: 60 },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  sub: { ...typography.body, color: colors.textSub, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  labelSub: { ...typography.caption, color: colors.textSub, marginBottom: spacing.sm },
  optional: { fontSize: 12, fontWeight: '400', color: colors.textSub },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, color: colors.text },
  chipTextOn: { color: '#fff' },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  dropdownSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dropdownText: { fontSize: 14, color: colors.text },
  dropdownTextSelected: { color: '#fff', fontWeight: '600' },
  regionLabel: { fontSize: 12, color: colors.primaryDark, marginTop: 8, fontWeight: '500' },
  yearChip: {
    alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    minWidth: 64,
  },
  yearChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  yearNum: { fontSize: 15, fontWeight: '700', color: colors.text },
  yearSub: { fontSize: 10, color: colors.textSub, marginTop: 2 },
  selectedYear: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent + '55',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  selectedYearText: { ...typography.body, color: colors.text },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { ...typography.h3, color: '#fff' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
  modalItem: {
    paddingVertical: 14, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalItemText: { fontSize: 15, color: colors.text },
});
