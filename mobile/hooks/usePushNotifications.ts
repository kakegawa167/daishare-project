import { api } from '@/lib/api';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerPushToken(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.put('/users/me/push-token', { expo_push_token: token }).catch(() => {});
  } catch {
    // シミュレーター・権限なし等では無視
  }
}

function navigate(data: { related_id?: number; type?: string }) {
  if (!data?.related_id) return;
  if (data.type === 'request_received') {
    router.push('/(tabs)/reservations' as any);
  } else {
    router.push(`/requests/${data.related_id}` as any);
  }
}

export function usePushNotifications() {
  // ナビゲーション準備完了後に pending な遷移を実行するためのキュー
  const pendingNav = useRef<{ related_id?: number; type?: string } | null>(null);

  useEffect(() => {
    registerPushToken();

    // アプリがキルド状態から通知タップで起動した場合
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as { related_id?: number; type?: string };
      // 少し遅延してナビゲーターが準備完了するのを待つ
      setTimeout(() => navigate(data), 300);
    });

    // バックグラウンド / フォアグラウンドから通知タップ
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { related_id?: number; type?: string };
      setTimeout(() => navigate(data), 100);
    });

    return () => sub.remove();
  }, []);
}
