import { api } from '@/lib/api';
import { Cart } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
      { text: '削除', style: 'destructive', onPress: () => onDelete(cart.id) },
    ]);
  };

  return (
    <View style={styles.card}>
      {cart.image_urls.length > 0 ? (
        <Image source={{ uri: cart.image_urls[0] }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.placeholderIcon}>🛒</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{cart.title}</Text>
          <Text style={[styles.statusBadge, cart.status === 'active' ? styles.statusActive : styles.statusInactive]}>
            {cart.status === 'active' ? '公開中' : '非公開'}
          </Text>
        </View>
        {cart.station_name && (
          <Text style={styles.cardMeta}>📍 {cart.municipality} / {cart.station_name}</Text>
        )}
        <Text style={styles.cardMeta}>{[
          cart.daily_rate != null && `¥${cart.daily_rate.toLocaleString()}/日`,
          cart.weekly_rate != null && `¥${cart.weekly_rate.toLocaleString()}/週`,
          cart.per_rental_rate != null && `¥${cart.per_rental_rate.toLocaleString()}/回`,
        ].filter(Boolean).join('　')} · {cart.quantity}台</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.editBtn} onPress={() => router.push(`/carts/${cart.id}/edit` as any)}>
          <Text style={styles.editBtnText}>編集</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Carts() {
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

  useFocusEffect(useCallback(() => { fetchCarts(); }, [fetchCarts]));

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCarts(); }} tintColor="#3b82f6" />
        }
        contentContainerStyle={carts.length === 0 ? styles.empty : styles.list}
        ListEmptyComponent={
          <EmptyScreen
            icon="🛒"
            message="台車が登録されていません"
            subMessage="下のボタンから台車を追加しましょう"
            action={{ label: '＋ 台車を登録', onPress: () => router.push('/carts/new' as any) }}
          />
        }
      />
      {carts.length > 0 && (
        <Pressable style={styles.fab} onPress={() => router.push('/carts/new' as any)}>
          <Text style={styles.fabText}>＋ 台車を登録</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  empty: { flex: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImage: { width: '100%', height: 160 },
  cardImagePlaceholder: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 48 },
  cardBody: { padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8, color: '#1a1a1a' },
  statusBadge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#d1fae5', color: '#065f46' },
  statusInactive: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  editBtn: { flex: 1, padding: 13, alignItems: 'center' },
  editBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 14 },
  deleteBtn: { flex: 1, padding: 13, alignItems: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#e5e7eb' },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
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
