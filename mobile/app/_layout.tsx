import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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

  // Supabaseのセッション変化を監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) syncUser();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) syncUser();
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
    if (!session) {
      router.replace('/(auth)/login');
    } else if (user?.is_new) {
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
    </Stack>
  );
}
