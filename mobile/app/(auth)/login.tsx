import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

WebBrowser.maybeCompleteAuthSession();

const IS_DEV = __DEV__;

// ログイン成功後の遷移: 新規ユーザーは _layout.tsx が profile-edit へ誘導するため何もしない
function navigateAfterLogin() {
  const user = useAuthStore.getState().user;
  if (user?.is_new) return;
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const { setSession, syncUser } = useAuthStore();

  useEffect(() => {
    // ディープリンクで戻ってきたときにセッションを処理
    const handleUrl = async (url: string) => {
      const urlObj = new URL(url);
      const accessToken = urlObj.searchParams.get('access_token') ?? urlObj.hash.split('access_token=')[1]?.split('&')[0];
      const refreshToken = urlObj.searchParams.get('refresh_token') ?? urlObj.hash.split('refresh_token=')[1]?.split('&')[0];
      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });
        if (data?.session) {
          setSession(data.session);
          await syncUser();
          navigateAfterLogin();
        }
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    // アプリ起動時のURLも処理
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });

    return () => sub.remove();
  }, []);

  // 開発用: シミュレーターでのテストログイン
  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@daishare.dev',
        password: 'testpassword123',
      });
      if (error) throw error;
      setSession(data.session);
      await syncUser();
      navigateAfterLogin();
    } catch (e: any) {
      Alert.alert('開発ログインエラー', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectTo = makeRedirectUri({ scheme: 'daishare', path: 'auth/callback' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        // URLからセッションを取得
        const urlObj = new URL(result.url);
        const accessToken = urlObj.searchParams.get('access_token') ?? urlObj.hash.split('access_token=')[1]?.split('&')[0];
        const refreshToken = urlObj.searchParams.get('refresh_token') ?? urlObj.hash.split('refresh_token=')[1]?.split('&')[0];

        if (accessToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? '',
          });
          if (sessionError) throw sessionError;
          if (sessionData.session) {
            setSession(sessionData.session);
            await syncUser();
            navigateAfterLogin();
          }
        }
      }
    } catch (error: any) {
      Alert.alert('ログインエラー', error.message ?? 'Googleログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="ダイシェア ログイン画面">
      <Text style={styles.title} accessibilityRole="header">ダイシェア</Text>
      <Text style={styles.subtitle}>台車のシェアリングサービス</Text>
      <TouchableOpacity
        style={[styles.googleButton, loading && styles.googleButtonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={loading}
        accessibilityLabel="Googleでログイン"
      >
        <Text style={styles.googleButtonText}>G  Googleでログイン</Text>
      </TouchableOpacity>
      {loading && <Text style={styles.loadingText} accessibilityLiveRegion="polite">ログイン中...</Text>}
      {IS_DEV && (
        <TouchableOpacity style={styles.devButton} onPress={handleDevLogin} disabled={loading}>
          <Text style={styles.devButtonText}>🛠 開発用ログイン（シミュレーター）</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  loadingText: { marginTop: 16, fontSize: 14, color: '#6b7280' },
  googleButton: {
    width: 240, height: 50, backgroundColor: '#fff', borderRadius: 4,
    borderWidth: 1, borderColor: '#dadce0',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  googleButtonDisabled: { opacity: 0.6 },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#3c4043' },
  devButton: { marginTop: 32, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed' },
  devButtonText: { fontSize: 13, color: '#6b7280' },
});
