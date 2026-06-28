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
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { setSession, syncUser } = useAuthStore();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // RevenueCat 初期化（ネイティブモジュールが利用可能な場合のみ動作）
  useEffect(() => { initRevenueCat(); }, []);

  // Supabaseのセッション変化を監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) syncUser();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        // SIGNED_IN 直後はトークンが getSession に反映されるまで少し待つ
        const delay = event === 'SIGNED_IN' ? 500 : 0;
        setTimeout(() => syncUser(), delay);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!loaded) return null;

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
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile" options={{ title: 'プロフィール', presentation: 'modal' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'プロフィール編集' }} />
      <Stack.Screen name="request-new" options={{ title: 'リクエスト送信', presentation: 'modal' }} />
    </Stack>
  );
}
