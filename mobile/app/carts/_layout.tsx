import { Stack } from 'expo-router';

export default function CartsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '自分の台車', headerBackTitle: '戻る' }} />
      <Stack.Screen name="new" options={{ title: '台車を登録', headerBackTitle: '戻る' }} />
      <Stack.Screen name="[id]/edit" options={{ title: '台車を編集', headerBackTitle: '戻る' }} />
    </Stack>
  );
}
