import { api } from '@/lib/api';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  related_id: number | null;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get<Notification[]>('/notifications');
      setNotifications(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleReadAll = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleTap = async (n: Notification) => {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <LoadingScreen />;
  if (error) return <EmptyScreen icon="⚠️" message="通知の取得に失敗しました" action={{ label: '再試行', onPress: fetchNotifications }} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {unreadCount > 0 && (
        <Pressable style={styles.readAllBtn} onPress={handleReadAll}>
          <Text style={styles.readAllText}>すべて既読にする（{unreadCount}件）</Text>
        </Pressable>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, !item.is_read && styles.cardUnread]} onPress={() => handleTap(item)}>
            <View style={styles.cardBody}>
              {!item.is_read && <View style={styles.unreadDot} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          </Pressable>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />}
        ListEmptyComponent={<EmptyScreen icon="🔔" message="通知がありません" subMessage="リクエストやメッセージが届くとここに表示されます" />}
        contentContainerStyle={notifications.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 15 },
  readAllBtn: { padding: 12, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  readAllText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3 },
  cardUnread: { backgroundColor: '#eff6ff' },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 10, marginTop: 4 },
  title: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  body: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  time: { fontSize: 12, color: '#9ca3af' },
  deleteBtn: { padding: 14 },
  deleteBtnText: { color: '#d1d5db', fontSize: 16 },
});
