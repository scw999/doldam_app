import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSerifKR_600SemiBold, NotoSerifKR_700Bold } from '@expo-google-fonts/noto-serif-kr';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/store/auth';
import { api } from '@/api';
import { colors } from '@/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function AuthGate() {
  const { token, hydrated } = useAuth();
  const segments = useSegments();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return;
    if (!hydrated) return;
    const inAuth = segments[0] === 'auth';
    if (!token && !inAuth) router.replace('/auth/login');
    else if (token && inAuth) router.replace('/(tabs)');
  }, [token, hydrated, segments, navState?.key]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const token = useAuth((s) => s.token);
  const [fontsLoaded] = useFonts({
    NotoSerifKR_600SemiBold,
    NotoSerifKR_700Bold,
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const pushToken = await Notifications.getExpoPushTokenAsync({
        projectId: 'e319fb49-251c-4449-b120-d58ddb2ddc8d',
      });
      await api.post('/notifications/token', {
        token: pushToken.data,
        platform: Platform.OS,
      }).catch(() => {});
    })();
  }, [token]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'NotoSerifKR_600SemiBold' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: '로그인' }} />
        <Stack.Screen name="auth/verify" options={{ title: '본인인증' }} />
        <Stack.Screen name="auth/certificate" options={{ title: '증명서 업로드' }} />
        <Stack.Screen name="auth/onboarding" options={{ title: '프로필 설정' }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="post/new" options={{ title: '글쓰기' }} />
        <Stack.Screen name="vote/[id]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="vote/new" options={{ title: '투표 만들기' }} />
        <Stack.Screen name="room/[id]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="mission" options={{ title: 'Q&A 미션' }} />
        <Stack.Screen name="mood" options={{ title: '오늘의 기분' }} />
        <Stack.Screen name="user/[id]" options={{ title: '프로필' }} />
        <Stack.Screen name="profile-edit" options={{ title: '프로필 편집' }} />
        <Stack.Screen name="my-posts" options={{ title: '내가 쓴 글' }} />
        <Stack.Screen name="points" options={{ title: '포인트 내역' }} />
        <Stack.Screen name="notifications" options={{ title: '알림' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
