import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Pressable, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { useBadgeStore } from '@/store/badgeStore';
import { useAuthStore } from '@/store/authStore';

function HeaderRight() {
  const unread = useBadgeStore((s) => s.unreadNotifications);
  const { session } = useAuthStore();
  return (
    <View style={styles.headerRight}>
      {session && (
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push('/notifications')}
          accessibilityLabel={`通知${unread > 0 ? `、未読${unread}件` : ''}`}
        >
          <MaterialIcons name="notifications-none" size={28} color="#374151" />
          {unread > 0 && (
            <View style={styles.dot}>
              <Text style={styles.dotText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      )}
      <Pressable
        style={styles.headerBtn}
        onPress={() => session ? router.push('/profile') : router.push('/(auth)/login')}
        accessibilityLabel={session ? 'プロフィール' : 'ログイン'}
      >
        <MaterialIcons name={session ? 'person-outline' : 'login'} size={28} color="#374151" />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const fetchUnread = useBadgeStore((s) => s.fetchUnread);
  const { session } = useAuthStore();

  useEffect(() => {
    if (!session) return;
    fetchUnread();
    // アプリ復帰時に即時更新
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchUnread();
    });
    // 30秒ポーリング（Realtime未設定環境でもバッジを更新）
    const timer = setInterval(fetchUnread, 30_000);
    return () => { appSub.remove(); clearInterval(timer); };
  }, [session]);

  const headerRight = () => <HeaderRight />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerRight,
        headerTintColor: '#1a1a1a',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          headerTitle: 'ダイシェア',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: '予約一覧',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="event-note" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'メッセージ',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="chat-bubble-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'スケジュール',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="calendar-today" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="carts"
        options={{
          title: '台車管理',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="shopping-cart" size={24} color={color} />
          ),
        }}
      />
      {/* 通知: タブバーには出さない（ヘッダーのベルから遷移）が、タブ画面にすることでタブバーを表示し戻れるようにする */}
      <Tabs.Screen name="notifications" options={{ href: null, title: '通知' }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  header: {
    backgroundColor: '#fff',
    shadowColor: 'transparent',
    elevation: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#3b82f6' },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 8 },
  headerBtn: { padding: 8, position: 'relative' },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dotText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
