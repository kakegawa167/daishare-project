import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

const IOS_CLIENT_ID = '651721992870-hisjdf2fvehs7r9n5utlru1r7nbhb8b7.apps.googleusercontent.com';
const IS_DEV = __DEV__;

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const { setSession, syncUser } = useAuthStore();

  useEffect(() => {
    GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID });
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
    } catch (e: any) {
      Alert.alert('開発ログインエラー', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error('No ID token');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: data.idToken,
        nonce: data.nonce,
      });
      if (error) throw error;
      // 認証成功 → _layout.tsx の onAuthStateChange がリダイレクトを処理
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
      Alert.alert('ログインエラー', error.message ?? 'Googleログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="ダイシェア ログイン画面">
      <Text style={styles.title} accessibilityRole="header">ダイシェア</Text>
      <Text style={styles.subtitle}>台車のシェアリングサービス</Text>
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={handleGoogleSignIn}
        disabled={loading}
        style={styles.button}
      />
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
  button: {
    width: 240,
    height: 48,
  },
  loadingText: { marginTop: 16, fontSize: 14, color: '#6b7280' },
  devButton: { marginTop: 32, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed' },
  devButtonText: { fontSize: 13, color: '#6b7280' },
});
