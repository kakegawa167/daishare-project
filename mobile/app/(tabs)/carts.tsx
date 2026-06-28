import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Cart } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { LoginPrompt } from '@/components/LoginPrompt';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

// ─── 並び替えオプション ───────────────────────
type SortKey = 'id_asc' | 'id_desc' | 'price_asc' | 'price_desc';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'id_asc',    label: '登録が早い順' },
  { key: 'id_desc',   label: '登録が新しい順' },
  { key: 'price_asc', label: '価格が安い順' },
  { key: 'price_desc',label: '価格が高い順' },
];

function lowestPrice(cart: Cart): number {
  const rates = [cart.daily_rate, cart.weekly_rate, cart.per_rental_rate].filter((r): r is number => r != null);
  return rates.length ? Math.min(...rates) : 0;
}

// ─── カードコンポーネント ─────────────────────
function CartCard({
  cart,
  onDelete,
  onToggleStatus,
}: {
  cart: Cart;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number, current: Cart['status']) => void;
}) {
  const isActive = cart.status === 'active';

  return (
    <Pressable style={s.card} onPress={() => router.push(`/carts/${cart.id}/edit` as any)}>
      {/* サムネイル */}
      <View style={s.thumb}>
        {cart.image_urls.length > 0 ? (
          <Image source={{ uri: cart.image_urls[0] }} style={s.thumbImg} resizeMode="cover" />
        ) : (
          <View style={s.thumbPlaceholder}>
            <MaterialIcons name="shopping-cart" size={32} color="#9ca3af" />
          </View>
        )}
      </View>

      {/* メイン情報 */}
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{cart.title}</Text>

        {/* 在庫台数 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
          <MaterialIcons name="inventory-2" size={12} color="#3b82f6" />
          <Text style={s.stockBadge}>在庫 {cart.quantity}台</Text>
        </View>

        {/* 貸出場所（複数）*/}
        {(cart.locations && cart.locations.length > 0
          ? cart.locations
          : cart.station_name ? [{ station_name: cart.station_name, municipality: cart.municipality, lending_address: cart.lending_address }] : []
        ).map((loc, i) => {
          const locLabel = [loc.municipality, loc.station_name].filter(Boolean).join(' · ');
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 }}>
              <MaterialIcons name="place" size={12} color="#9ca3af" />
              <Text style={s.meta} numberOfLines={1}>
                {locLabel || '場所未設定'}{loc.lending_address ? `  ${loc.lending_address}` : ''}
              </Text>
            </View>
          );
        })}

        <Text style={s.price}>
          {[
            cart.daily_rate != null && `¥${cart.daily_rate.toLocaleString()}/日`,
            cart.weekly_rate != null && `¥${cart.weekly_rate.toLocaleString()}/週`,
            cart.per_rental_rate != null && `¥${cart.per_rental_rate.toLocaleString()}/回`,
          ].filter(Boolean).join('  ')}
        </Text>

        {/* 公開トグル */}
        <View style={s.toggleRow}>
          <Text style={[s.statusLabel, isActive ? s.statusOn : s.statusOff]}>
            {isActive ? '公開中' : '非公開'}
          </Text>
          <Switch
            value={isActive}
            onValueChange={() => onToggleStatus(cart.id, cart.status)}
            trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
            thumbColor={isActive ? '#3b82f6' : '#9ca3af'}
            ios_backgroundColor="#e5e7eb"
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      </View>

      {/* 削除ボタン */}
      <Pressable
        style={s.deleteBtn}
        onPress={(e) => {
          e.stopPropagation();
          Alert.alert('台車を削除', `「${cart.title}」を削除しますか？`, [
            { text: 'キャンセル', style: 'cancel' },
            { text: '削除', style: 'destructive', onPress: () => onDelete(cart.id) },
          ]);
        }}
        accessibilityLabel="削除"
        hitSlop={8}
      >
        <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
      </Pressable>
    </Pressable>
  );
}

// ─── メイン画面 ───────────────────────────────
export default function Carts() {
  const { user, session } = useAuthStore();
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('id_asc');
  const [showSort, setShowSort] = useState(false);

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

  useFocusEffect(useCallback(() => { if (session) fetchCarts(); }, [fetchCarts, session]));

  const sorted = useMemo(() => {
    const arr = [...carts];
    switch (sortKey) {
      case 'id_asc':    return arr.sort((a, b) => a.id - b.id);
      case 'id_desc':   return arr.sort((a, b) => b.id - a.id);
      case 'price_asc': return arr.sort((a, b) => lowestPrice(a) - lowestPrice(b));
      case 'price_desc':return arr.sort((a, b) => lowestPrice(b) - lowestPrice(a));
    }
  }, [carts, sortKey]);

  if (!session) return <LoginPrompt message="台車を登録・管理するにはログインが必要です" />;

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/carts/${id}`);
      setCarts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      Alert.alert('エラー', '削除に失敗しました');
    }
  };

  const handleToggleStatus = async (id: number, current: Cart['status']) => {
    try {
      const res = await api.patch<Cart>(`/carts/${id}/status`);
      setCarts((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch {
      Alert.alert('エラー', '公開設定の変更に失敗しました');
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return (
    <EmptyScreen icon={<MaterialIcons name="warning-amber" size={56} color="#d1d5db" />} message="台車一覧の取得に失敗しました" action={{ label: '再試行', onPress: fetchCarts }} />
  );

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? '';

  return (
    <View style={s.container}>
      {/* プラン超過警告バナー */}
      {user?.is_over_limit && (
        <View style={s.overLimitBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <MaterialIcons name="warning-amber" size={16} color="#92400e" style={{ marginTop: 1 }} />
            <Text style={[s.overLimitText, { flex: 1 }]}>プランを変更したため新規登録が制限されています。台車1台・地点1件以内にすると追加できます。</Text>
          </View>
        </View>
      )}

      {/* ツールバー */}
      {carts.length > 0 && (
        <View style={s.toolbar}>
          <Text style={s.toolbarCount}>{carts.length}台登録中</Text>
          <Pressable style={s.sortBtn} onPress={() => setShowSort((v) => !v)}>
            <Text style={s.sortBtnText}>⇅ {currentSortLabel}</Text>
          </Pressable>
        </View>
      )}

      {/* 並び替えドロップダウン */}
      {showSort && (
        <View style={s.sortMenu}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[s.sortItem, sortKey === opt.key && s.sortItemSel]}
              onPress={() => { setSortKey(opt.key); setShowSort(false); }}
            >
              <Text style={[s.sortItemText, sortKey === opt.key && s.sortItemTextSel]}>
                {sortKey === opt.key ? '✓ ' : '　'}{opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CartCard cart={item} onDelete={handleDelete} onToggleStatus={handleToggleStatus} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCarts(); }} tintColor="#3b82f6" />
        }
        contentContainerStyle={sorted.length === 0 ? s.emptyWrap : s.list}
        ListEmptyComponent={
          <EmptyScreen
            icon={<MaterialIcons name="shopping-cart" size={56} color="#d1d5db" />}
            message="台車が登録されていません"
            subMessage="下のボタンから台車を追加しましょう"
            action={{ label: '＋ 台車を登録', onPress: () => router.push('/carts/new' as any) }}
          />
        }
      />

      {/* FAB */}
      <Pressable style={s.fab} onPress={() => router.push('/carts/new' as any)}>
        <Text style={s.fabText}>＋ 台車を登録</Text>
      </Pressable>
    </View>
  );
}

// ─── スタイル ─────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },

  // ツールバー
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  toolbarCount: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  sortBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },

  // ドロップダウン
  sortMenu: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  sortItem: { paddingHorizontal: 20, paddingVertical: 13 },
  sortItemSel: { backgroundColor: '#eff6ff' },
  sortItemText: { fontSize: 14, color: '#374151' },
  sortItemTextSel: { color: '#3b82f6', fontWeight: '700' },

  // リスト
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  emptyWrap: { flex: 1 },

  // カード
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  thumb: { width: 88, height: 88 },
  thumbImg: { width: 88, height: 88 },
  thumbPlaceholder: { width: 88, height: 88, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  stockBadge: { fontSize: 11, fontWeight: '700', color: '#3b82f6', marginBottom: 2 },
  meta: { fontSize: 12, color: '#9ca3af', marginBottom: 1 },
  price: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 6, marginTop: 3 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overLimitBanner: {
    backgroundColor: '#fff7ed', borderBottomWidth: 1, borderBottomColor: '#fed7aa',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  overLimitText: { fontSize: 13, color: '#92400e', lineHeight: 18 },

  statusLabel: { fontSize: 12, fontWeight: '700' },
  statusOn: { color: '#059669' },
  statusOff: { color: '#9ca3af' },

  deleteBtn: {
    paddingHorizontal: 14, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#e5e7eb',
  },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
