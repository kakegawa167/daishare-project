import { api } from '@/lib/api';
import { Cart, CartCategory } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// ─── 定数 ────────────────────────────────────────
const TOKYO_23KU = [
  '千代田区','中央区','港区','新宿区','文京区','台東区',
  '墨田区','江東区','品川区','目黒区','大田区','世田谷区',
  '渋谷区','中野区','杉並区','豊島区','北区','荒川区',
  '板橋区','練馬区','足立区','葛飾区','江戸川区',
];

const CATEGORIES: { value: CartCategory; label: string }[] = [
  { value: 'hand_truck',    label: '手押し台車' },
  { value: 'flat_cart',     label: '平台車' },
  { value: 'hand_dolly',    label: 'ハンドトラック' },
  { value: 'outdoor_wagon', label: 'アウトドアワゴン' },
  { value: 'other',         label: 'その他' },
];

const PRICE_OPTIONS: { label: string; value: number | null }[] = [
  { label: '上限なし', value: null },
  { label: '〜¥1,000/日', value: 1000 },
  { label: '〜¥3,000/日', value: 3000 },
  { label: '〜¥5,000/日', value: 5000 },
];

type SortKey = 'newest' | 'price_asc' | 'price_desc';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',     label: '新しい順' },
  { key: 'price_asc',  label: '価格の安い順' },
  { key: 'price_desc', label: '価格の高い順' },
];

type AreaGroup = { label: string; items: string[] };

function groupMunicipalities(municipalities: string[]): AreaGroup[] {
  const ku23     = municipalities.filter(m => TOKYO_23KU.includes(m));
  const kanagawa = municipalities.filter(m => m.startsWith('横浜市') || m.startsWith('川崎市'));
  const shi      = municipalities.filter(
    m => !TOKYO_23KU.includes(m) && !kanagawa.includes(m) && (m.endsWith('市') || m.includes('市'))
  );
  const other    = municipalities.filter(
    m => !ku23.includes(m) && !shi.includes(m) && !kanagawa.includes(m)
  );
  const groups: AreaGroup[] = [];
  if (ku23.length)      groups.push({ label: '東京23区', items: [...ku23].sort() });
  if (shi.length)       groups.push({ label: '東京市部', items: [...shi].sort() });
  if (kanagawa.length)  groups.push({ label: '神奈川県', items: [...kanagawa].sort() });
  if (other.length)     groups.push({ label: 'その他',  items: [...other].sort() });
  return groups;
}

// 台車の「基準価格」（日額 > 週額 > 1回）
function effectivePrice(cart: Cart): number {
  return cart.daily_rate ?? cart.weekly_rate ?? cart.per_rental_rate ?? Infinity;
}

// ─── 絞り込み型 ──────────────────────────────────
interface FilterState {
  category: CartCategory | null;
  foldable: boolean | null;
  maxDailyRate: number | null;
}
const DEFAULT_FILTER: FilterState = { category: null, foldable: null, maxDailyRate: null };

function activeFilterCount(f: FilterState): number {
  return [f.category, f.foldable, f.maxDailyRate].filter(v => v !== null).length;
}

// ─── 台車カード ───────────────────────────────────
function CartCard({ cart }: { cart: Cart }) {
  return (
    <Pressable style={s.card} onPress={() => router.push(`/search/${cart.owner_id}` as any)}>
      <View style={s.imageWrap}>
        {cart.image_urls.length > 0 ? (
          <Image source={{ uri: cart.image_urls[0] }} style={s.image} resizeMode="cover" />
        ) : (
          <View style={s.imagePlaceholder}>
            <Text style={s.imagePlaceholderIcon}>🛒</Text>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{cart.title}</Text>
        {cart.station_name && (
          <Text style={s.cardMeta} numberOfLines={1}>📍 {cart.municipality} {cart.station_name}</Text>
        )}
        <Text style={s.cardPrice}>
          {cart.daily_rate != null
            ? <>{`¥${cart.daily_rate.toLocaleString()}`}<Text style={s.cardPriceSuffix}>/日</Text></>
            : cart.weekly_rate != null
            ? <>{`¥${cart.weekly_rate.toLocaleString()}`}<Text style={s.cardPriceSuffix}>/週</Text></>
            : <>{`¥${(cart.per_rental_rate ?? 0).toLocaleString()}`}<Text style={s.cardPriceSuffix}>/回</Text></>}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── エリア選択モーダル ──────────────────────────
function AreaModal({
  visible, onClose, selected, onSelect, allCarts,
}: {
  visible: boolean;
  onClose: () => void;
  selected: string | null;
  onSelect: (m: string | null) => void;
  allCarts: Cart[];
}) {
  const [groups, setGroups] = useState<AreaGroup[]>([]);

  // 市区町村ごとの台車数（allCarts から集計）
  const countByMuni = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of allCarts) {
      if (c.municipality) map[c.municipality] = (map[c.municipality] ?? 0) + 1;
    }
    return map;
  }, [allCarts]);

  useEffect(() => {
    if (!visible) return;
    api.get<string[]>('/stations/municipalities')
      .then(r => setGroups(groupMunicipalities(r.data)))
      .catch(() => {});
  }, [visible]);

  const pick = (m: string | null) => { onSelect(m); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={am.container}>
        <View style={am.header}>
          <Text style={am.title}>エリアを選択</Text>
          <Pressable onPress={onClose}><Text style={am.close}>閉じる</Text></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* すべてのエリア */}
          <Pressable style={[am.item, selected === null && am.itemSel]} onPress={() => pick(null)}>
            <Text style={[am.itemText, selected === null && am.itemTextSel]}>すべてのエリア</Text>
            <View style={am.itemRight}>
              <Text style={[am.count, selected === null && am.countSel]}>{allCarts.length}件</Text>
              {selected === null && <Text style={am.check}>✓</Text>}
            </View>
          </Pressable>

          {groups.map(g => {
            const groupTotal = g.items.reduce((s, m) => s + (countByMuni[m] ?? 0), 0);
            return (
              <View key={g.label}>
                <View style={am.groupHeader}>
                  <Text style={am.groupLabel}>{g.label}</Text>
                  <Text style={am.groupCount}>{groupTotal}件</Text>
                </View>
                {g.items.map(muni => {
                  const cnt = countByMuni[muni] ?? 0;
                  const disabled = cnt === 0;
                  const isSel = selected === muni;
                  return (
                    <Pressable
                      key={muni}
                      disabled={disabled}
                      style={[am.item, am.itemIndent, isSel && am.itemSel, disabled && am.itemDisabled]}
                      onPress={() => pick(muni)}
                    >
                      <Text style={[am.itemText, isSel && am.itemTextSel, disabled && am.itemTextDisabled]}>
                        {muni}
                      </Text>
                      <View style={am.itemRight}>
                        <Text style={[am.count, isSel && am.countSel, disabled && am.countDisabled]}>
                          {cnt}件
                        </Text>
                        {isSel && <Text style={am.check}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── ソートメニュー ──────────────────────────────
function SortMenu({
  visible, current, onSelect, onClose,
}: { visible: boolean; current: SortKey; onSelect: (k: SortKey) => void; onClose: () => void }) {
  if (!visible) return null;
  return (
    <>
      <Pressable style={sm.backdrop} onPress={onClose} />
      <View style={sm.menu}>
        {SORT_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[sm.item, current === opt.key && sm.itemSel]}
            onPress={() => { onSelect(opt.key); onClose(); }}
          >
            <Text style={[sm.itemText, current === opt.key && sm.itemTextSel]}>{opt.label}</Text>
            {current === opt.key && <Text style={sm.check}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </>
  );
}

// ─── 絞り込みモーダル ─────────────────────────────
function FilterModal({
  visible, onClose, filter, onApply,
}: { visible: boolean; onClose: () => void; filter: FilterState; onApply: (f: FilterState) => void }) {
  const [draft, setDraft] = useState<FilterState>(filter);
  useEffect(() => { if (visible) setDraft(filter); }, [visible, filter]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={fm.container}>
        <View style={fm.header}>
          <Pressable onPress={() => setDraft(DEFAULT_FILTER)}>
            <Text style={fm.reset}>リセット</Text>
          </Pressable>
          <Text style={fm.title}>絞り込み</Text>
          <Pressable onPress={onClose}><Text style={fm.close}>閉じる</Text></Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* カテゴリ */}
          <Text style={fm.section}>台車カテゴリー</Text>
          <View style={fm.chips}>
            {CATEGORIES.map(cat => {
              const sel = draft.category === cat.value;
              return (
                <Pressable key={cat.value} style={[fm.chip, sel && fm.chipSel]}
                  onPress={() => setDraft(d => ({ ...d, category: sel ? null : cat.value }))}>
                  <Text style={[fm.chipText, sel && fm.chipTextSel]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* スペック */}
          <Text style={fm.section}>スペック</Text>
          <View style={fm.switchRow}>
            <Text style={fm.switchLabel}>折りたたみ可能のみ</Text>
            <Switch
              value={draft.foldable === true}
              onValueChange={v => setDraft(d => ({ ...d, foldable: v ? true : null }))}
              trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
              thumbColor={draft.foldable ? '#3b82f6' : '#9ca3af'}
              ios_backgroundColor="#e5e7eb"
            />
          </View>

          {/* 料金 */}
          <Text style={fm.section}>料金（日額）</Text>
          <View style={fm.chips}>
            {PRICE_OPTIONS.map(opt => {
              const sel = draft.maxDailyRate === opt.value;
              return (
                <Pressable key={String(opt.value)} style={[fm.chip, sel && fm.chipSel]}
                  onPress={() => setDraft(d => ({ ...d, maxDailyRate: opt.value }))}>
                  <Text style={[fm.chipText, sel && fm.chipTextSel]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={fm.footer}>
          <Pressable style={fm.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
            <Text style={fm.applyText}>この条件で絞り込む</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── メイン画面 ──────────────────────────────────
export default function Home() {
  const [allCarts, setAllCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // エリア（API フィルタ）
  const [municipality, setMunicipality] = useState<string | null>(null);
  // 絞り込み（クライアントサイド）
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  // ソート（クライアントサイド）
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  // モーダル表示状態
  const [areaModal, setAreaModal]     = useState(false);
  const [sortMenu, setSortMenu]       = useState(false);
  const [filterModal, setFilterModal] = useState(false);

  const fetchCarts = useCallback(async (muni: string | null = municipality) => {
    setError(false);
    try {
      const params: Record<string, string> = {};
      if (muni) params.municipality = muni;
      const res = await api.get<Cart[]>('/carts', { params });
      setAllCarts(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [municipality]);

  useFocusEffect(useCallback(() => { fetchCarts(municipality); }, []));

  const handleAreaSelect = (muni: string | null) => {
    setMunicipality(muni);
    fetchCarts(muni);
  };

  const handleRefresh = () => { setRefreshing(true); fetchCarts(municipality); };

  // クライアントサイドフィルタ + ソート
  const displayedCarts = useMemo(() => {
    let result = [...allCarts];

    if (filter.category)
      result = result.filter(c => c.category === filter.category);
    if (filter.foldable === true)
      result = result.filter(c => c.foldable);
    if (filter.maxDailyRate !== null)
      result = result.filter(c => (c.daily_rate ?? Infinity) <= filter.maxDailyRate!);

    if (sortKey === 'price_asc')
      result.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    else if (sortKey === 'price_desc')
      result.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    // newest: APIが id DESC で返すのでそのまま

    return result;
  }, [allCarts, filter, sortKey]);

  const filterCount = activeFilterCount(filter);
  const sortLabel   = SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? '新しい順';

  if (loading) return <LoadingScreen />;

  return (
    <View style={s.container}>

      {/* ── 検索バー（エリアのみ） ── */}
      <View style={s.searchBar}>
        <Pressable style={s.searchBtn} onPress={() => setAreaModal(true)}>
          <Text style={s.searchIcon}>🔍</Text>
          <Text style={[s.searchText, municipality ? s.searchTextActive : null]} numberOfLines={1}>
            {municipality ?? 'エリアで検索'}
          </Text>
          {municipality && (
            <Pressable hitSlop={10} onPress={() => handleAreaSelect(null)}>
              <Text style={s.searchClear}>×</Text>
            </Pressable>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={s.fill}>
          <EmptyScreen icon="⚠️" message="台車の取得に失敗しました" action={{ label: '再試行', onPress: () => fetchCarts() }} />
        </View>
      ) : (
        <FlatList
          data={displayedCarts}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={displayedCarts.length === 0 ? s.emptyContainer : s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
          renderItem={({ item }) => <CartCard cart={item} />}
          ListEmptyComponent={
            <View style={s.fill}>
              <EmptyScreen icon="🔍" message="台車が見つかりませんでした" subMessage="条件を変えてみてください" />
            </View>
          }
          ListHeaderComponent={
            <View style={s.toolbar}>
              {/* 件数 */}
              <Text style={s.count}>{displayedCarts.length}件</Text>

              <View style={s.toolbarRight}>
                {/* ソート */}
                <Pressable style={s.toolBtn} onPress={() => setSortMenu(v => !v)}>
                  <Text style={s.toolBtnText}>{sortLabel} ▾</Text>
                </Pressable>

                {/* 絞り込み */}
                <Pressable style={[s.toolBtn, filterCount > 0 && s.toolBtnActive]} onPress={() => setFilterModal(true)}>
                  <Text style={[s.toolBtnText, filterCount > 0 && s.toolBtnTextActive]}>
                    ≡ 絞り込み{filterCount > 0 ? ` (${filterCount})` : ''}
                  </Text>
                </Pressable>
              </View>
            </View>
          }
        />
      )}

      {/* ソートメニュー（ドロップダウン） */}
      <SortMenu
        visible={sortMenu}
        current={sortKey}
        onSelect={k => setSortKey(k)}
        onClose={() => setSortMenu(false)}
      />

      <AreaModal
        visible={areaModal}
        onClose={() => setAreaModal(false)}
        selected={municipality}
        onSelect={handleAreaSelect}
        allCarts={allCarts}
      />
      <FilterModal
        visible={filterModal}
        onClose={() => setFilterModal(false)}
        filter={filter}
        onApply={setFilter}
      />
    </View>
  );
}

// ─── スタイル: メイン ────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  fill: { flex: 1 },

  searchBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f3f4f6', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchIcon: { fontSize: 15, color: '#9ca3af' },
  searchText: { flex: 1, fontSize: 15, color: '#9ca3af', fontWeight: '500' },
  searchTextActive: { color: '#111827', fontWeight: '600' },
  searchClear: { fontSize: 18, color: '#6b7280', fontWeight: '700', paddingHorizontal: 2 },

  // 結果ツールバー
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  count: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  toolbarRight: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  toolBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  toolBtnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  toolBtnTextActive: { color: '#3b82f6' },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  emptyContainer: { flexGrow: 1, paddingHorizontal: 16 },
  row: { gap: 12, justifyContent: 'space-between' },
  card: {
    width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 4,
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

// ─── スタイル: ソートメニュー ─────────────────────
const sm = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
  },
  menu: {
    position: 'absolute', top: 110, right: 16, zIndex: 20,
    backgroundColor: '#fff', borderRadius: 12, minWidth: 160,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  itemSel: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  itemTextSel: { color: '#3b82f6', fontWeight: '700' },
  check: { fontSize: 14, color: '#3b82f6', fontWeight: '700' },
});

// ─── スタイル: エリアモーダル ─────────────────────
const am = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  close: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6,
  },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase' },
  groupCount: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  itemIndent: { paddingLeft: 28 },
  itemSel: { backgroundColor: '#eff6ff' },
  itemDisabled: { backgroundColor: '#fafafa' },
  itemText: { fontSize: 15, color: '#374151' },
  itemTextSel: { color: '#3b82f6', fontWeight: '700' },
  itemTextDisabled: { color: '#c8ccd0' },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  countSel: { color: '#3b82f6' },
  countDisabled: { color: '#d1d5db' },
  check: { fontSize: 16, color: '#3b82f6', fontWeight: '700' },
});

// ─── スタイル: 絞り込みモーダル ──────────────────
const fm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  reset: { fontSize: 14, color: '#6b7280' },
  close: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },
  section: {
    fontSize: 12, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5,
    textTransform: 'uppercase', marginTop: 24, marginBottom: 12, marginHorizontal: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  chipSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextSel: { color: '#3b82f6', fontWeight: '700' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#f0f0f0',
  },
  switchLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  footer: {
    padding: 20, paddingBottom: 36, backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
  },
  applyBtn: {
    backgroundColor: '#3b82f6', borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  applyText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
