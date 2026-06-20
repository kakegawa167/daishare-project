import { Stack } from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '台車を探す' }} />
      <Stack.Screen name="[lender_id]" options={{ title: '貸主の台車' }} />
    </Stack>
  );
}
