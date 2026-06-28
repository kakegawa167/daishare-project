import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

/**
 * ログインが必要な操作の前に呼ぶ。
 * 未ログインならログイン画面に誘導して false を返す。
 * ログイン済みなら true を返す。
 */
export function requireAuth(actionLabel = 'この操作'): boolean {
  const { session } = useAuthStore.getState();
  if (session) return true;

  Alert.alert(
    'ログインが必要です',
    `${actionLabel}にはログインが必要です。`,
    [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログインする', onPress: () => router.push('/(auth)/login') },
    ]
  );
  return false;
}
