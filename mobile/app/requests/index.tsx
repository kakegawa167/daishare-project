import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { RentalRequest, RequestStatus } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
  inquiry: '問い合わせ中',
  pending: '承認待ち',
  accepted: '承認済み',
  rejected: '拒否',
  cancelled: 'キャンセル',
};
const STATUS_COLOR: Record<RequestStatus, string> = {
  inquiry: '#6366f1',
  pending: '#fbbf24',
  accepted: '#10b981',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
};

function RequestCard({ req, userId, onAction }: { req: RentalRequest; userId: string; onAction: () => void }) {
  const isOwner = req.renter_id !== userId;
  const startDate = req.start_date ? new Date(req.start_date).toLocaleDateString('ja-JP') : null;
  const endDate = req.end_date ? new Date(req.end_date).toLocaleDateString('ja-JP') : null;

  const handleAccept = async () => {
    try { await api.post(`/rental-requests/${req.id}/accept`); onAction(); }
    catch { Alert.alert('エラー', '承認に失敗しました'); }
  };
  const handleReject = async () => {
    try { await api.post(`/rental-requests/${req.id}/reject`); onAction(); }
    catch { Alert.alert('エラー', '拒否に失敗しました'); }
  };
  const handleCancel = async () => {
    Alert.alert('キャンセル', 'リクエストをキャンセルしますか？', [
      { text: 'いいえ', style: 'cancel' },
      { text: 'はい', onPress: async () => {
        try { await api.post(`/rental-requests/${req.id}/cancel`); onAction(); }
        catch { Alert.alert('エラー', 'キャンセルに失敗しました'); }
      }},
    ]);
  };

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/requests/${req.id}` as any)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cartTitle}>{req.cart_title}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[req.status] + '22' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[req.status] }]}>{STATUS_LABEL[req.status]}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{isOwner ? `借りる人: ${req.renter_name ?? '不明'}` : '自分のリクエスト'}</Text>
      {startDate && endDate ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <MaterialIcons name="calendar-today" size={13} color="#6b7280" />
          <Text style={styles.meta}>{startDate} 〜 {endDate}</Text>
        </View>
      ) : null}
      <Text style={styles.meta}>台数: {req.quantity}台</Text>
      {req.message && <Text style={styles.message}>"{req.message}"</Text>}

      {req.status === 'pending' && isOwner && (
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept}>
            <Text style={styles.acceptBtnText}>承認</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={handleReject}>
            <Text style={styles.rejectBtnText}>拒否</Text>
          </Pressable>
        </View>
      )}
      {req.status === 'pending' && !isOwner && (
        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>キャンセル</Text>
        </Pressable>
      )}
      <Text style={styles.tapHint}>タップしてメッセージを見る ›</Text>
    </Pressable>
  );
}

export default function Requests() {
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
  if (error) return <EmptyScreen icon={<MaterialIcons name="warning-amber" size={56} color="#d1d5db" />} message="リクエストの取得に失敗しました" action={{ label: '再試行', onPress: fetchRequests }} />;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'received' && styles.tabActive]} onPress={() => setTab('received')}>
          <Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>受信</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'sent' && styles.tabActive]} onPress={() => setTab('sent')}>
          <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>送信済み</Text>
        </Pressable>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <RequestCard req={item} userId={userId} onAction={fetchRequests} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
        ListEmptyComponent={
          <EmptyScreen
            icon={<MaterialIcons name={tab === 'received' ? 'move-to-inbox' : 'send'} size={56} color="#d1d5db" />}
            message="リクエストがありません"
            subMessage={tab === 'received' ? '台車へのリクエストが届くとここに表示されます' : '台車を探して貸出申請してみましょう'}
          />
        }
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  tabText: { fontSize: 15, color: '#6b7280' },
  tabTextActive: { color: '#3b82f6', fontWeight: '600' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cartTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 13, color: '#6b7280', marginBottom: 3 },
  message: { fontSize: 13, color: '#374151', fontStyle: 'italic', marginTop: 6, padding: 8, backgroundColor: '#f9fafb', borderRadius: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  acceptBtn: { backgroundColor: '#10b981' },
  acceptBtnText: { color: '#fff', fontWeight: '600' },
  rejectBtn: { backgroundColor: '#fee2e2' },
  rejectBtnText: { color: '#ef4444', fontWeight: '600' },
  cancelBtn: { marginTop: 10, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelBtnText: { color: '#6b7280', fontWeight: '500' },
  tapHint: { fontSize: 12, color: '#d1d5db', textAlign: 'right', marginTop: 8 },
});
