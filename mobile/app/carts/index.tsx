import { api } from '@/lib/api';
import { Cart } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function CartCard({ cart, onDelete }: { cart: Cart; onDelete: (id: number) => void }) {
  const handleDelete = () => {
    Alert.alert('台車を削除', `「${cart.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => onDelete(cart.id),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      {cart.image_urls.length > 0 && (
        <Image source={{ uri: cart.image_urls[0] }} style={styles.cardImage} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{cart.title}</Text>
        {cart.station_name && (
          <Text style={styles.cardMeta}>📍 {cart.municipality} / {cart.station_name}</Text>
        )}
        <Text style={styles.cardMeta}>
          {cart.daily_rate != null ? `¥${cart.daily_rate.toLocaleString()} / 日` : cart.weekly_rate != null ? `¥${cart.weekly_rate.toLocaleString()} / 週` : `¥${(cart.per_rental_rate ?? 0).toLocaleString()} / 回`}
          {' ・ '}{cart.quantity}台
        </Text>
        <Text style={[styles.badge, cart.status === 'active' ? styles.badgeActive : styles.badgeInactive]}>
          {cart.status === 'active' ? '公開中' : '非公開'}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable style={styles.editBtn} onPress={() => router.push(`/carts/${cart.id}/edit`)}>
          <Text style={styles.editBtnText}>編集</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MyCarts() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCarts = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get<Cart[]>('/carts/mine');
      setCarts(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/carts/${id}`);
      setCarts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      Alert.alert('エラー', '削除に失敗しました');
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <EmptyScreen icon="⚠️" message="台車一覧の取得に失敗しました" action={{ label: '再試行', onPress: fetchCarts }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={carts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <CartCard cart={item} onDelete={handleDelete} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCarts(); }} />}
        ListEmptyComponent={
          <EmptyScreen
            icon="🛒"
            message="台車が登録されていません"
            subMessage="「台車を登録」ボタンから追加しましょう"
          />
        }
        contentContainerStyle={carts.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/carts/new')}>
        <Text style={styles.fabText}>＋ 台車を登録</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#666', marginBottom: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, marginTop: 6 },
  badgeActive: { backgroundColor: '#d1fae5', color: '#065f46' },
  badgeInactive: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  editBtn: { flex: 1, padding: 12, alignItems: 'center' },
  editBtnText: { color: '#3b82f6', fontWeight: '500' },
  deleteBtn: { flex: 1, padding: 12, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#f0f0f0' },
  deleteBtnText: { color: '#ef4444', fontWeight: '500' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
