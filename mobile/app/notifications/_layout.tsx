import { Stack } from 'expo-router';

export default function NotificationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '通知' }} />
    </Stack>
  );
}
