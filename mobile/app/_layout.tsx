import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { initRevenueCat } from '@/lib/purchases';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { setSession, syncUser } = useAuthStore();

  useEffect(() => {
    // フォントロード完否にかかわらず必ずスプラッシュを隠す
    if (loaded) {
      SplashScreen.hideAsync();
    } else {
      const t = setTimeout(() => SplashScreen.hideAsync(), 3000);
      return () => clearTimeout(t);
    }
  }, [loaded]);

  // RevenueCat 初期化（ネイティブモジュールが利用可能な場合のみ動作）
  useEffect(() => { initRevenueCat(); }, []);

  // Supabaseのセッション変化を監視
  useEffect(() => {
    // タイムアウト付きで getSession を実行（ネットワーク不通でも黒画面にならないよう）
    const timeout = setTimeout(() => setSession(null), 8000);
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      if (session) syncUser();
    }).catch(() => {
      clearTimeout(timeout);
      setSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        const delay = event === 'SIGNED_IN' ? 500 : 0;
        setTimeout(() => syncUser(), delay);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // フォント未ロードでも描画を止めない（黒画面防止）
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { session, loading, user } = useAuthStore();
  usePushNotifications();

  useEffect(() => {
    if (loading) return;
    if (session && user?.is_new) {
      router.replace('/profile-edit');
    }
  }, [session, loading, user?.is_new]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerBackTitle: '戻る' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="requests" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile" options={{ title: 'プロフィール', presentation: 'modal' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'プロフィール編集' }} />
      <Stack.Screen name="request-new" options={{ title: 'リクエスト送信', presentation: 'modal' }} />
      <Stack.Screen name="carts/new" options={{ title: '台車を登録' }} />
      <Stack.Screen name="carts/[id]/edit" options={{ title: '台車を編集' }} />
    </Stack>
  );
}
