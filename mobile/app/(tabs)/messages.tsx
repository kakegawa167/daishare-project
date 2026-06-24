import { api } from '@/lib/api';
import { RentalRequest } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

function ThreadCard({ req, userId }: { req: RentalRequest; userId: string }) {
  const isOwner = req.renter_id !== userId;
  const otherName = isOwner ? (req.renter_name ?? '不明') : '貸す人';
  const start = new Date(req.start_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  const end = new Date(req.end_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  const createdAt = new Date(req.created_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
  const dateStr = diffDays === 0
    ? createdAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : diffDays < 7
    ? `${diffDays}日前`
    : createdAt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/requests/${req.id}` as any)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{otherName.charAt(0)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <Text style={styles.cartName} numberOfLines={1}>{req.cart_title ?? '台車'}</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {req.message ?? `${start} 〜 ${end}　${req.quantity}台`}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Messages() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get<RentalRequest[]>('/rental-requests');
      setRequests(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const active = requests.filter((r) => r.status !== 'rejected' && r.status !== 'cancelled');

  if (loading) return <LoadingScreen />;
  if (error) return (
    <EmptyScreen icon="⚠️" message="取得に失敗しました" action={{ label: '再試行', onPress: fetchRequests }} />
  );

  return (
    <FlatList
      data={active}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ThreadCard req={item} userId={user?.id ?? ''} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} tintColor="#3b82f6" />
      }
      contentContainerStyle={active.length === 0 ? styles.empty : styles.list}
      ListEmptyComponent={
        <EmptyScreen
          icon="💬"
          message="メッセージがありません"
          subMessage="リクエストが承認されるとメッセージのやり取りができます"
        />
      }
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { paddingBottom: 24 },
  empty: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#3b82f6' },
  body: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  date: { fontSize: 12, color: '#9ca3af', marginLeft: 8 },
  cartName: { fontSize: 12, color: '#3b82f6', fontWeight: '600', marginBottom: 2 },
  preview: { fontSize: 13, color: '#6b7280' },
});
