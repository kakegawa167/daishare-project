import { Stack } from 'expo-router';

export default function CartsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: '戻る' }}>
      <Stack.Screen name="index" options={{ title: '自分の台車' }} />
      <Stack.Screen name="new" options={{ title: '台車を登録' }} />
      <Stack.Screen name="[id]/edit" options={{ title: '台車を編集' }} />
    </Stack>
  );
}
