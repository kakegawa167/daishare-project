import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  message?: string;
}

export function LoginPrompt({ message = 'この機能を使うにはログインが必要です' }: Props) {
  return (
    <View style={s.container}>
      <MaterialIcons name="lock-outline" size={48} color="#9ca3af" />
      <Text style={s.message}>{message}</Text>
      <Pressable style={s.btn} onPress={() => router.push('/(auth)/login')}>
        <Text style={s.btnText}>ログイン / 新規登録</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: 32,
    gap: 16,
  },
  message: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
