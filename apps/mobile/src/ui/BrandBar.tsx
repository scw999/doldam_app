import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius } from '@/theme';
import { DoldamLogo, BellIcon } from './icons';

interface Props {
  points: number;
  hasNewNotification?: boolean;
}

export function BrandBar({ points, hasNewNotification = false }: Props) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6,
        backgroundColor: colors.bg,
      }}>
        {/* 로고 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LinearGradient
            colors={[colors.primaryDark, colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#A07850', shadowOpacity: 0.28, shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}
          >
            <DoldamLogo size={18} />
          </LinearGradient>
          <Text style={{
            fontSize: 18, fontWeight: '700', color: colors.text,
            letterSpacing: -0.5, fontFamily: 'NotoSerifKR_700Bold',
          }}>돌담</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* 포인트 칩 */}
        <Pressable
          onPress={() => router.push('/points' as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingVertical: 5, paddingLeft: 8, paddingRight: 11,
            borderRadius: radius.full, backgroundColor: colors.accent,
          }}
        >
          <Text style={{ fontSize: 12 }}>💎</Text>
          <Text style={{
            fontSize: 12.5, fontWeight: '700', color: colors.primaryDark, letterSpacing: -0.1,
          }}>{points}P</Text>
        </Pressable>

        {/* 알림 */}
        <Pressable
          onPress={() => router.push('/notifications' as any)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <BellIcon size={18} />
          {hasNewNotification && (
            <View style={{
              position: 'absolute', top: 8, right: 9,
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: colors.badge,
              borderWidth: 1.5, borderColor: colors.card,
            }} />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
