import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface LoadingProps {
  message?: string;
}
export function LoadingScreen({ message = '読み込み中...' }: LoadingProps) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

interface ErrorProps {
  message?: string;
  onRetry?: () => void;
}
export function ErrorScreen({ message = 'エラーが発生しました', onRetry }: ErrorProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>再試行</Text>
        </Pressable>
      )}
    </View>
  );
}

interface EmptyProps {
  icon?: string;
  message: string;
  subMessage?: string;
  action?: { label: string; onPress: () => void };
}
export function EmptyScreen({ icon = '📭', message, subMessage, action }: EmptyProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {subMessage && <Text style={styles.emptySubText}>{subMessage}</Text>}
      {action && (
        <Pressable style={styles.actionBtn} onPress={action.onPress}>
          <Text style={styles.actionBtnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f9fafb' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 20 },
  actionBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
