import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useBadgeStore } from '@/store/badgeStore';
import { useAuthStore } from '@/store/authStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const fetchUnread = useBadgeStore((s) => s.fetchUnread);
  const { session } = useAuthStore();

  useEffect(() => {
    if (!session) return;
    fetchUnread();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchUnread();
    });
    return () => sub.remove();
  }, [session]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house', android: 'home', web: 'home' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'プロフィール',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person', android: 'person', web: 'person' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
