import { Tabs } from 'expo-router';
import { colors } from '@/theme';
import { HomeIcon, BoardIcon, VoteIcon, ChatIcon, MyIcon } from '@/ui/icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 18,
          paddingTop: 6,
          height: 78,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          letterSpacing: -0.2,
          marginTop: 2,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: ({ focused }) => <HomeIcon active={focused} /> }} />
      <Tabs.Screen name="board" options={{ title: '게시판', tabBarIcon: ({ focused }) => <BoardIcon active={focused} /> }} />
      <Tabs.Screen name="vote" options={{ title: '투표', tabBarIcon: ({ focused }) => <VoteIcon active={focused} /> }} />
      <Tabs.Screen name="chat" options={{ title: '채팅', tabBarIcon: ({ focused }) => <ChatIcon active={focused} /> }} />
      <Tabs.Screen name="my" options={{ title: '마이', tabBarIcon: ({ focused }) => <MyIcon active={focused} /> }} />
    </Tabs>
  );
}
