import { api } from '@/lib/api';
import { RentalRequest, RequestStatus } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '承認待ち',
  accepted: '承認済み',
  rejected: '拒否',
  cancelled: 'キャンセル',
};
const STATUS_COLOR: Record<RequestStatus, string> = {
  pending: '#f59e0b',
  accepted: '#10b981',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
};

function RequestCard({ req, userId, onAction }: { req: RentalRequest; userId: string; onAction: () => void }) {
  const isOwner = req.renter_id !== userId;
  const start = new Date(req.start_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  const end = new Date(req.end_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });

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
    <Pressable style={styles.card} onPress={() => router.push(`/requests/${req.id}` as any)}>
      <View style={styles.cardTop}>
        <Text style={styles.cartTitle} numberOfLines={1}>{req.cart_title ?? '台車'}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[req.status] + '20' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[req.status] }]}>{STATUS_LABEL[req.status]}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {isOwner ? `借主: ${req.renter_name ?? '不明'}` : '自分のリクエスト'}
      </Text>
      <Text style={styles.meta}>📅 {start} 〜 {end}　{req.quantity}台</Text>
      {req.message ? (
        <Text style={styles.msgPreview} numberOfLines={1}>"{req.message}"</Text>
      ) : null}

      {req.status === 'pending' && isOwner && (
        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.btnAccept]} onPress={handleAccept}>
            <Text style={styles.btnAcceptText}>承認</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnReject]} onPress={handleReject}>
            <Text style={styles.btnRejectText}>拒否</Text>
          </Pressable>
        </View>
      )}
      {req.status === 'pending' && !isOwner && (
        <Pressable style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
          <Text style={styles.btnCancelText}>キャンセル</Text>
        </Pressable>
      )}
      <Text style={styles.tapHint}>タップしてメッセージを確認 ›</Text>
    </Pressable>
  );
}

export default function Reservations() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
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

  const userId = user?.id ?? '';
  const filtered = requests.filter((r) =>
    tab === 'received' ? r.renter_id !== userId : r.renter_id === userId
  );

  if (loading) return <LoadingScreen />;
  if (error) return (
    <EmptyScreen icon="⚠️" message="取得に失敗しました" action={{ label: '再試行', onPress: fetchRequests }} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'received' && styles.tabBtnActive]} onPress={() => setTab('received')}>
          <Text style={[styles.tabBtnText, tab === 'received' && styles.tabBtnTextActive]}>受信</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]} onPress={() => setTab('sent')}>
          <Text style={[styles.tabBtnText, tab === 'sent' && styles.tabBtnTextActive]}>送信済み</Text>
        </Pressable>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <RequestCard req={item} userId={userId} onAction={fetchRequests} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} tintColor="#3b82f6" />
        }
        contentContainerStyle={filtered.length === 0 ? styles.empty : styles.list}
        ListEmptyComponent={
          <EmptyScreen
            icon={tab === 'received' ? '📨' : '📤'}
            message="リクエストがありません"
            subMessage={tab === 'received'
              ? '台車へのリクエストが届くとここに表示されます'
              : 'ホームから台車を探して申請してみましょう'}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  tabBtnText: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  tabBtnTextActive: { color: '#3b82f6', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  empty: { flex: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
  tapHint: { fontSize: 11, color: '#d1d5db', textAlign: 'right', marginTop: 8 },
});
