import { api } from '@/lib/api';
import { RentalRequest, RequestStatus } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ─── ステータス定義 ───────────────────────────────
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending:   '承認待ち',
  accepted:  '予約中',
  rejected:  '拒否',
  cancelled: 'キャンセル',
};
const STATUS_COLOR: Record<RequestStatus, string> = {
  pending:   '#f59e0b',
  accepted:  '#10b981',
  rejected:  '#ef4444',
  cancelled: '#9ca3af',
};

type RoleTab = 'renter' | 'lender'; // both の場合に上部で切り替え
type ContentTab = 'request' | 'booked' | 'history';

const RENTER_TABS: { key: ContentTab; label: string }[] = [
  { key: 'request', label: 'リクエスト送信' },
  { key: 'booked',  label: '予約中' },
  { key: 'history', label: '履歴' },
];
const LENDER_TABS: { key: ContentTab; label: string }[] = [
  { key: 'request', label: 'リクエスト受信' },
  { key: 'booked',  label: '予約中' },
  { key: 'history', label: '履歴' },
];

// ─── リクエストカード ─────────────────────────────
function RequestCard({
  req, userId, isLenderView, onAction,
}: {
  req: RentalRequest;
  userId: string;
  isLenderView: boolean;
  onAction: () => void;
}) {
  const fmtDT = (d: string) =>
    new Date(d).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleAccept = async () => {
    try { await api.post(`/rental-requests/${req.id}/accept`); onAction(); }
    catch { Alert.alert('エラー', '承認に失敗しました'); }
  };
  const handleReject = async () => {
    try { await api.post(`/rental-requests/${req.id}/reject`); onAction(); }
    catch { Alert.alert('エラー', '拒否に失敗しました'); }
  };
  const handleCancel = async () => {
    Alert.alert('キャンセル確認', 'このリクエストをキャンセルしますか？', [
      { text: 'いいえ', style: 'cancel' },
      { text: 'はい', style: 'destructive', onPress: async () => {
        try { await api.post(`/rental-requests/${req.id}/cancel`); onAction(); }
        catch { Alert.alert('エラー', 'キャンセルに失敗しました'); }
      }},
    ]);
  };

  return (
    <View style={c.card}>
      <View style={c.cardTop}>
        <Text style={c.cartTitle} numberOfLines={1}>{req.cart_title ?? '台車'}</Text>
        <View style={[c.badge, { backgroundColor: STATUS_COLOR[req.status] + '20' }]}>
          <Text style={[c.badgeText, { color: STATUS_COLOR[req.status] }]}>
            {STATUS_LABEL[req.status]}
          </Text>
        </View>
      </View>

      {/* 相手方表示 */}
      {isLenderView && req.renter_name && (
        <Text style={c.meta}>👤 借りる人: {req.renter_name}</Text>
      )}

      <Text style={c.meta}>🕐 貸出希望: {fmtDT(req.start_date)}</Text>
      <Text style={c.meta}>🕐 返却希望: {fmtDT(req.end_date)}</Text>
      <Text style={c.meta}>📦 台数: {req.quantity}台</Text>

      {(req.municipality || req.station_name) && (
        <Text style={c.meta}>📍 {[req.municipality, req.station_name].filter(Boolean).join(' / ')}</Text>
      )}
      {req.lending_address ? (
        <Text style={c.meta}>🏠 {req.lending_address}</Text>
      ) : null}

      {req.message ? (
        <Text style={c.msgPreview}>💬 {req.message}</Text>
      ) : null}

      {/* 貸す人アクション: pending のとき承認/拒否 */}
      {req.status === 'pending' && isLenderView && (
        <View style={c.actions}>
          <Pressable style={[c.btn, c.btnAccept]} onPress={(e) => { e.stopPropagation?.(); handleAccept(); }}>
            <Text style={c.btnAcceptText}>承認</Text>
          </Pressable>
          <Pressable style={[c.btn, c.btnReject]} onPress={(e) => { e.stopPropagation?.(); handleReject(); }}>
            <Text style={c.btnRejectText}>拒否</Text>
          </Pressable>
        </View>
      )}

      {/* 借りる人アクション: pending のときキャンセル */}
      {req.status === 'pending' && !isLenderView && (
        <Pressable style={[c.btn, c.btnCancel]} onPress={(e) => { e.stopPropagation?.(); handleCancel(); }}>
          <Text style={c.btnCancelText}>キャンセル</Text>
        </Pressable>
      )}

      {/* 予約中・履歴はチャットへのリンクを強調 */}
      <View style={c.footer}>
        <Pressable style={c.chatBtn} onPress={() => router.push(`/requests/${req.id}` as any)}>
          <Text style={c.chatBtnText}>💬 チャット・詳細を開く</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── リスト ───────────────────────────────────────
function RequestList({
  requests, userId, isLenderView, onAction, refreshing, onRefresh,
  emptyIcon, emptyMessage, emptySubMessage,
}: {
  requests: RentalRequest[];
  userId: string;
  isLenderView: boolean;
  onAction: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  emptyIcon: string;
  emptyMessage: string;
  emptySubMessage: string;
}) {
  return (
    <FlatList
      data={requests}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => (
        <RequestCard req={item} userId={userId} isLenderView={isLenderView} onAction={onAction} />
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      contentContainerStyle={requests.length === 0 ? s.emptyWrap : s.list}
      ListEmptyComponent={
        <EmptyScreen icon={emptyIcon} message={emptyMessage} subMessage={emptySubMessage} />
      }
    />
  );
}

// ─── タブバー ─────────────────────────────────────
function TabBar({
  tabs, active, onChange,
}: { tabs: { key: ContentTab; label: string }[]; active: ContentTab; onChange: (t: ContentTab) => void }) {
  return (
    <View style={s.tabRow}>
      {tabs.map(tab => (
        <Pressable
          key={tab.key}
          style={[s.tabBtn, active === tab.key && s.tabBtnActive]}
          onPress={() => onChange(tab.key)}
        >
          <Text style={[s.tabBtnText, active === tab.key && s.tabBtnTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── メイン ───────────────────────────────────────
export default function Reservations() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contentTab, setContentTab] = useState<ContentTab>('request');

  // both の場合に上部ロール切り替えに使う
  const userType = user?.user_type ?? 'renter';
  const [roleTab, setRoleTab] = useState<RoleTab>(
    userType === 'lender' ? 'lender' : 'renter'
  );

  const fetch = useCallback(async () => {
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

  useFocusEffect(useCallback(() => { fetch(); }, []));

  const userId  = user?.id ?? '';
  const now     = new Date();

  // 自分が借りる人のリクエスト
  const asRenter = requests.filter(r => r.renter_id === userId);
  // 自分が貸す人のリクエスト（自分の台車へのリクエスト）
  const asLender = requests.filter(r => r.renter_id !== userId);

  // タブごとに振り分け（履歴：cancelled / rejected / accepted で期限切れ）
  const classify = (list: RentalRequest[], tab: ContentTab): RentalRequest[] => {
    if (tab === 'request') return list.filter(r => r.status === 'pending');
    if (tab === 'booked')  return list.filter(r => r.status === 'accepted' && new Date(r.end_date) >= now);
    // history: cancelled, rejected, accepted で返却期限切れ
    return list.filter(r =>
      r.status === 'cancelled' || r.status === 'rejected' ||
      (r.status === 'accepted' && new Date(r.end_date) < now)
    );
  };

  const isLenderView = userType === 'lender' || (userType === 'both' && roleTab === 'lender');
  const baseList     = isLenderView ? asLender : asRenter;
  const displayList  = useMemo(() => classify(baseList, contentTab), [baseList, contentTab, requests]);

  const tabs         = isLenderView ? LENDER_TABS : RENTER_TABS;

  const emptyConfig: Record<ContentTab, { icon: string; message: string; sub: string }> = {
    request: isLenderView
      ? { icon: '📨', message: '受信リクエストはありません', sub: '台車へのリクエストが届くとここに表示されます' }
      : { icon: '📤', message: '送信済みリクエストはありません', sub: 'ホームから台車を探してリクエストしてみましょう' },
    booked: { icon: '📋', message: '予約中の台車はありません', sub: '' },
    history: { icon: '📁', message: '履歴はありません', sub: '' },
  };

  const handleRefresh = () => { setRefreshing(true); fetch(); };

  if (loading) return <LoadingScreen />;
  if (error) return (
    <EmptyScreen icon="⚠️" message="取得に失敗しました" action={{ label: '再試行', onPress: fetch }} />
  );

  return (
    <View style={s.container}>

      {/* both の場合のみ 貸す人/借りる人 切り替えバー */}
      {userType === 'both' && (
        <View style={s.roleRow}>
          {(['renter', 'lender'] as RoleTab[]).map(role => (
            <Pressable
              key={role}
              style={[s.roleBtn, roleTab === role && s.roleBtnActive]}
              onPress={() => { setRoleTab(role); setContentTab('request'); }}
            >
              <Text style={[s.roleBtnText, roleTab === role && s.roleBtnTextActive]}>
                {role === 'renter' ? '借りる' : '貸す'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* コンテンツタブ */}
      <TabBar tabs={tabs} active={contentTab} onChange={t => setContentTab(t)} />

      <RequestList
        requests={displayList}
        userId={userId}
        isLenderView={isLenderView}
        onAction={fetch}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        emptyIcon={emptyConfig[contentTab].icon}
        emptyMessage={emptyConfig[contentTab].message}
        emptySubMessage={emptyConfig[contentTab].sub}
      />
    </View>
  );
}

// ─── スタイル ─────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  emptyWrap: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  roleRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  roleBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', alignItems: 'center',
  },
  roleBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  roleBtnTextActive: { color: '#3b82f6' },

  tabRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  tabBtnText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  tabBtnTextActive: { color: '#3b82f6', fontWeight: '700' },
});

const c = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cartTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8, color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  msgPreview: { fontSize: 13, fontStyle: 'italic', marginTop: 6, color: '#9ca3af' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnAccept: { backgroundColor: '#10b981' },
  btnAcceptText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnReject: { backgroundColor: '#fee2e2' },
  btnRejectText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  btnCancel: { marginTop: 10, backgroundColor: '#f3f4f6' },
  btnCancelText: { color: '#6b7280', fontWeight: '500', fontSize: 14 },
  footer: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f3f4f6', paddingTop: 10 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#eff6ff', borderRadius: 10, paddingVertical: 9,
  },
  chatBtnText: { fontSize: 14, color: '#3b82f6', fontWeight: '700' },
});
