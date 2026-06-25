import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

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
      <MaterialIcons name="error-outline" size={48} color="#ef4444" style={{ marginBottom: 12 }} />
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
  icon?: React.ReactNode;
  message: string;
  subMessage?: string;
  action?: { label: string; onPress: () => void };
}
export function EmptyScreen({ icon, message, subMessage, action }: EmptyProps) {
  return (
    <View style={styles.center}>
      {icon ? (
        <View style={{ marginBottom: 16 }}>{icon}</View>
      ) : (
        <MaterialIcons name="inbox" size={56} color="#d1d5db" style={{ marginBottom: 16 }} />
      )}
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
  errorText: { fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 20 },
  actionBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
