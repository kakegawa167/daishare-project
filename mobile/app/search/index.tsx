import { api } from '@/lib/api';
import { Cart, CartLocation } from '@/lib/types';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// 1台車 × 1地点 の表示単位
interface CartLocationCard {
  cart: Cart;
  location: CartLocation | null;
  cardKey: string;
}

function CartCard({ item }: { item: CartLocationCard }) {
  const { cart, location } = item;
  const locLabel = location
    ? [location.municipality, location.station_name].filter(Boolean).join(' / ')
    : [cart.municipality, cart.station_name].filter(Boolean).join(' / ');
  const address = location?.lending_address ?? cart.lending_address;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/search/${cart.owner_id}?cart_id=${cart.id}` as any)}>
      {cart.image_urls.length > 0 && (
        <Image source={{ uri: cart.image_urls[0] }} style={styles.cardImage} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{cart.title}</Text>
        <Text style={styles.cardOwner}>{cart.owner_name ?? '不明'}</Text>
        {locLabel ? (
          <Text style={styles.cardMeta}>📍 {locLabel}</Text>
        ) : null}
        {address ? (
          <Text style={styles.cardMeta} numberOfLines={1}>🏠 {address}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardRate}>
            {cart.daily_rate != null ? `¥${cart.daily_rate.toLocaleString()} / 日`
              : cart.weekly_rate != null ? `¥${cart.weekly_rate.toLocaleString()} / 週`
              : `¥${(cart.per_rental_rate ?? 0).toLocaleString()} / 回`}
          </Text>
          <Text style={styles.cardStock}>在庫 {cart.quantity}台</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCarts = useCallback(async (municipality?: string) => {
    setLoading(true);
    try {
      const params = municipality ? { municipality } : {};
      const res = await api.get<Cart[]>('/carts', { params });
      setCarts(res.data);
    } catch {
      Alert.alert('エラー', '台車の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCarts(); }, [fetchCarts]);

  const handleSearch = () => fetchCarts(query.trim() || undefined);

  // 各台車を地点数分に展開
  const cards: CartLocationCard[] = carts.flatMap((cart) => {
    const locs = cart.locations && cart.locations.length > 0 ? cart.locations : [null];
    return locs.map((loc, i) => ({
      cart,
      location: loc,
      cardKey: `${cart.id}-${i}`,
    }));
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="市区町村で検索（例: 渋谷区）"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>検索</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.cardKey}
          renderItem={({ item }) => <CartCard item={item} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>台車が見つかりません</Text>
            </View>
          }
          contentContainerStyle={cards.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchBar: {
    flexDirection: 'row', padding: 12, gap: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 15,
  },
  searchBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  cardOwner: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardRate: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },
  cardStock: { fontSize: 12, fontWeight: '600', color: '#059669', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
});
