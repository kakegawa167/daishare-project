import { Stack } from 'expo-router';

export default function RequestsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'リクエスト' }} />
    </Stack>
  );
}
