import { api } from '@/lib/api';
import { Cart } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

function CartCard({ cart }: { cart: Cart }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/search/${cart.owner_id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${cart.title}、${cart.daily_rate != null ? `${cart.daily_rate.toLocaleString()}円/日` : '価格あり'}`}
    >
      <View style={styles.imageWrap}>
        {cart.image_urls.length > 0 ? (
          <Image source={{ uri: cart.image_urls[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>🛒</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{cart.title}</Text>
        {cart.station_name && (
          <Text style={styles.cardMeta} numberOfLines={1}>
            📍 {cart.municipality ?? ''} {cart.station_name}
          </Text>
        )}
        <Text style={styles.cardPrice}>
          {cart.daily_rate != null
            ? <>¥{cart.daily_rate.toLocaleString()}<Text style={styles.cardPriceSuffix}>/日</Text></>
            : cart.weekly_rate != null
            ? <>¥{cart.weekly_rate.toLocaleString()}<Text style={styles.cardPriceSuffix}>/週</Text></>
            : <>¥{(cart.per_rental_rate ?? 0).toLocaleString()}<Text style={styles.cardPriceSuffix}>/回</Text></>}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCarts = useCallback(async (municipality?: string) => {
    setError(false);
    try {
      const params = municipality ? { municipality } : {};
      const res = await api.get<Cart[]>('/carts', { params });
      setCarts(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCarts(); }, [fetchCarts]);

  const handleSearch = () => fetchCarts(query.trim() || undefined);
  const handleRefresh = () => { setRefreshing(true); fetchCarts(query.trim() || undefined); };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      {/* 検索バー */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="市区町村で検索（例: 渋谷区）"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          clearButtonMode="while-editing"
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>検索</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.fill}>
          <EmptyScreen icon="⚠️" message="台車の取得に失敗しました" action={{ label: '再試行', onPress: () => fetchCarts() }} />
        </View>
      ) : (
        <FlatList
          data={carts}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={carts.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
          renderItem={({ item }) => <CartCard cart={item} />}
          ListEmptyComponent={
            <View style={styles.fill}>
              <EmptyScreen
                icon="🔍"
                message="台車が見つかりませんでした"
                subMessage={query ? `「${query}」での検索結果はありません` : 'まだ台車が登録されていません'}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  fill: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1a1a1a',
  },
  searchBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flexGrow: 1, padding: 16 },
  row: { gap: 12, justifyContent: 'space-between' },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  imageWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#f3f4f6' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' },
  imagePlaceholderIcon: { fontSize: 40 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 4, lineHeight: 18 },
  cardMeta: { fontSize: 11, color: '#6b7280', marginBottom: 6 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  cardPriceSuffix: { fontSize: 11, fontWeight: '400', color: '#6b7280' },
});
