import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';

const IOS_CLIENT_ID = '651721992870-hisjdf2fvehs7r9n5utlru1r7nbhb8b7.apps.googleusercontent.com';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID });
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error('No ID token');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: data.idToken,
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
    <View style={styles.container}>
      <Text style={styles.title}>ダイシェア</Text>
      <Text style={styles.subtitle}>台車のシェアリングサービス</Text>
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={handleGoogleSignIn}
        disabled={loading}
        style={styles.button}
      />
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
});
