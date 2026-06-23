import { api } from '@/lib/api';
import { Cart, CartCategory } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

// ─── 定数 ───────────────────────────────────────
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

type AreaGroup = { label: string; items: string[] };

function groupMunicipalities(municipalities: string[]): AreaGroup[] {
  const ku23   = municipalities.filter(m => TOKYO_23KU.includes(m));
  const shi    = municipalities.filter(m => !TOKYO_23KU.includes(m) && m.endsWith('市') && !m.includes('市') === false && !m.startsWith('横浜市') && !m.startsWith('川崎市'));
  const kanagawa = municipalities.filter(m => m.startsWith('横浜市') || m.startsWith('川崎市'));
  const other  = municipalities.filter(
    m => !ku23.includes(m) && !shi.includes(m) && !kanagawa.includes(m)
  );
  const groups: AreaGroup[] = [];
  if (ku23.length)      groups.push({ label: '東京23区', items: ku23.sort() });
  if (shi.length)       groups.push({ label: '東京市部', items: shi.sort() });
  if (kanagawa.length)  groups.push({ label: '神奈川県', items: kanagawa.sort() });
  if (other.length)     groups.push({ label: 'その他', items: other.sort() });
  return groups;
}

// ─── フィルタ型 ──────────────────────────────────
interface Filters {
  municipality: string | null;
  category: CartCategory | null;
  foldable: boolean | null;
}
const DEFAULT_FILTERS: Filters = { municipality: null, category: null, foldable: null };

// ─── 台車カード ──────────────────────────────────
function CartCard({ cart }: { cart: Cart }) {
  return (
    <Pressable
      style={s.card}
      onPress={() => router.push(`/search/${cart.owner_id}` as any)}
      accessibilityRole="button"
    >
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
          <Text style={s.cardMeta} numberOfLines={1}>
            📍 {cart.municipality ?? ''} {cart.station_name}
          </Text>
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

// ─── エリア選択モーダル ───────────────────────────
function AreaModal({
  visible, onClose, onSelect, selected,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (m: string | null) => void;
  selected: string | null;
}) {
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [groups, setGroups] = useState<AreaGroup[]>([]);

  useEffect(() => {
    if (!visible) return;
    api.get<string[]>('/stations/municipalities').then(r => {
      setMunicipalities(r.data);
      setGroups(groupMunicipalities(r.data));
    }).catch(() => {});
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.header}>
          <Text style={m.headerTitle}>エリアを選択</Text>
          <Pressable onPress={onClose} style={m.closeBtn}>
            <Text style={m.closeBtnText}>閉じる</Text>
          </Pressable>
        </View>
        <ScrollView style={m.scroll} showsVerticalScrollIndicator={false}>
          {/* 全エリア */}
          <Pressable
            style={[m.item, selected === null && m.itemSel]}
            onPress={() => { onSelect(null); onClose(); }}
          >
            <Text style={[m.itemText, selected === null && m.itemTextSel]}>すべてのエリア</Text>
            {selected === null && <Text style={m.check}>✓</Text>}
          </Pressable>

          {groups.map(group => (
            <View key={group.label}>
              <View style={m.groupHeader}>
                <Text style={m.groupLabel}>{group.label}</Text>
              </View>
              {group.items.map(muni => (
                <Pressable
                  key={muni}
                  style={[m.item, m.itemIndent, selected === muni && m.itemSel]}
                  onPress={() => { onSelect(muni); onClose(); }}
                >
                  <Text style={[m.itemText, selected === muni && m.itemTextSel]}>{muni}</Text>
                  {selected === muni && <Text style={m.check}>✓</Text>}
                </Pressable>
              ))}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── 絞り込みモーダル ─────────────────────────────
function FilterModal({
  visible, onClose, filters, onChange,
}: {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);

  useEffect(() => { if (visible) setDraft(filters); }, [visible]);

  const apply = () => { onChange(draft); onClose(); };
  const reset = () => setDraft({ ...DEFAULT_FILTERS, municipality: filters.municipality });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={f.container}>
        <View style={f.header}>
          <Pressable onPress={reset}>
            <Text style={f.resetText}>リセット</Text>
          </Pressable>
          <Text style={f.headerTitle}>絞り込み</Text>
          <Pressable onPress={onClose}>
            <Text style={f.closeText}>閉じる</Text>
          </Pressable>
        </View>

        <ScrollView style={f.scroll} showsVerticalScrollIndicator={false}>
          {/* カテゴリ */}
          <Text style={f.sectionTitle}>台車タイプ</Text>
          <View style={f.chips}>
            {CATEGORIES.map(cat => {
              const sel = draft.category === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  style={[f.chip, sel && f.chipSel]}
                  onPress={() => setDraft(d => ({ ...d, category: sel ? null : cat.value }))}
                >
                  <Text style={[f.chipText, sel && f.chipTextSel]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* 折りたたみ */}
          <Text style={f.sectionTitle}>オプション</Text>
          <View style={f.row}>
            <Text style={f.rowLabel}>折りたたみ可能のみ</Text>
            <Switch
              value={draft.foldable === true}
              onValueChange={v => setDraft(d => ({ ...d, foldable: v ? true : null }))}
              trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
              thumbColor={draft.foldable ? '#3b82f6' : '#9ca3af'}
              ios_backgroundColor="#e5e7eb"
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={f.footer}>
          <Pressable style={f.applyBtn} onPress={apply}>
            <Text style={f.applyBtnText}>この条件で検索</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── メイン画面 ──────────────────────────────────
export default function Home() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [areaModal, setAreaModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);

  const fetchCarts = useCallback(async (f: Filters = filters) => {
    setError(false);
    try {
      const params: Record<string, string> = {};
      if (f.municipality) params.municipality = f.municipality;
      if (f.category)     params.category = f.category;
      if (f.foldable !== null) params.foldable = String(f.foldable);
      const res = await api.get<Cart[]>('/carts', { params });
      setCarts(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { fetchCarts(filters); }, []));

  const handleFiltersChange = (next: Filters) => {
    setFilters(next);
    fetchCarts(next);
  };

  const handleRefresh = () => { setRefreshing(true); fetchCarts(filters); };

  // アクティブフィルタ数（エリア除く）
  const activeFilterCount = [filters.category, filters.foldable].filter(v => v !== null).length;

  if (loading) return <LoadingScreen />;

  return (
    <View style={s.container}>
      {/* ── 検索バー ── */}
      <View style={s.searchBar}>
        {/* エリアボタン */}
        <Pressable
          style={[s.filterBtn, filters.municipality && s.filterBtnActive]}
          onPress={() => setAreaModal(true)}
        >
          <Text style={[s.filterBtnText, filters.municipality && s.filterBtnTextActive]} numberOfLines={1}>
            📍 {filters.municipality ?? 'エリア'}
          </Text>
          {filters.municipality && (
            <Pressable
              hitSlop={8}
              onPress={() => handleFiltersChange({ ...filters, municipality: null })}
            >
              <Text style={s.filterClear}>×</Text>
            </Pressable>
          )}
        </Pressable>

        {/* 絞り込みボタン */}
        <Pressable
          style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          onPress={() => setFilterModal(true)}
        >
          <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnTextActive]}>
            {activeFilterCount > 0 ? `絞り込み (${activeFilterCount})` : '絞り込み'}
          </Text>
        </Pressable>
      </View>

      {/* アクティブフィルタ チップ */}
      {(filters.category || filters.foldable !== null) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipBar}
          contentContainerStyle={s.chipBarContent}
        >
          {filters.category && (
            <View style={s.activeChip}>
              <Text style={s.activeChipText}>
                {CATEGORIES.find(c => c.value === filters.category)?.label}
              </Text>
              <Pressable hitSlop={8} onPress={() => handleFiltersChange({ ...filters, category: null })}>
                <Text style={s.activeChipClose}>×</Text>
              </Pressable>
            </View>
          )}
          {filters.foldable === true && (
            <View style={s.activeChip}>
              <Text style={s.activeChipText}>折りたたみ可</Text>
              <Pressable hitSlop={8} onPress={() => handleFiltersChange({ ...filters, foldable: null })}>
                <Text style={s.activeChipClose}>×</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── 一覧 ── */}
      {error ? (
        <View style={s.fill}>
          <EmptyScreen icon="⚠️" message="台車の取得に失敗しました" action={{ label: '再試行', onPress: () => fetchCarts(filters) }} />
        </View>
      ) : (
        <FlatList
          data={carts}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={carts.length === 0 ? s.emptyContainer : s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
          renderItem={({ item }) => <CartCard cart={item} />}
          ListEmptyComponent={
            <View style={s.fill}>
              <EmptyScreen
                icon="🔍"
                message="台車が見つかりませんでした"
                subMessage="条件を変えてもう一度お試しください"
              />
            </View>
          }
        />
      )}

      <AreaModal
        visible={areaModal}
        onClose={() => setAreaModal(false)}
        selected={filters.municipality}
        onSelect={muni => handleFiltersChange({ ...filters, municipality: muni })}
      />
      <FilterModal
        visible={filterModal}
        onClose={() => setFilterModal(false)}
        filters={filters}
        onChange={next => handleFiltersChange({ ...filters, ...next })}
      />
    </View>
  );
}

// ─── スタイル: メイン ────────────────────────────
const s = StyleSheet.create({
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
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  filterBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  filterBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '500', flexShrink: 1 },
  filterBtnTextActive: { color: '#3b82f6', fontWeight: '700' },
  filterClear: { fontSize: 16, color: '#3b82f6', fontWeight: '700', marginLeft: 2 },

  chipBar: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  chipBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dbeafe', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4,
  },
  activeChipText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },
  activeChipClose: { fontSize: 15, color: '#3b82f6', fontWeight: '700' },

  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flexGrow: 1, padding: 16 },
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

// ─── スタイル: エリアモーダル ─────────────────────
const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  closeBtnText: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },
  scroll: { flex: 1 },
  groupHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6,
  },
  groupLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase' },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  itemIndent: { paddingLeft: 28 },
  itemSel: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 15, color: '#374151' },
  itemTextSel: { color: '#3b82f6', fontWeight: '700' },
  check: { fontSize: 16, color: '#3b82f6', fontWeight: '700' },
});

// ─── スタイル: 絞り込みモーダル ──────────────────
const f = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  resetText: { fontSize: 15, color: '#6b7280' },
  closeText: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#6b7280',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 24, marginBottom: 10, marginHorizontal: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  chipSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  chipTextSel: { color: '#3b82f6', fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  footer: {
    padding: 20, paddingBottom: 36,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
  },
  applyBtn: {
    backgroundColor: '#3b82f6', borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  applyBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
