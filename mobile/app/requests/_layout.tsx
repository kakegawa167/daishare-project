import { Stack } from 'expo-router';

export default function RequestsLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]/index" options={{ title: 'メッセージ' }} />
    </Stack>
  );
}
