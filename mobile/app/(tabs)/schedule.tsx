import { api } from '@/lib/api';
import { Reservation, ReservationStatus } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved: '予約確定',
  lent: '貸出中',
  returned: '返却済み',
  cancelled: 'キャンセル',
};
const STATUS_COLOR: Record<ReservationStatus, string> = {
  reserved: '#3b82f6',
  lent: '#f59e0b',
  returned: '#10b981',
  cancelled: '#9ca3af',
};

function ReservationCard({ res }: { res: Reservation }) {
  const start = new Date(res.start_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  const end = new Date(res.end_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  const days = Math.max(1, Math.ceil((new Date(res.end_date).getTime() - new Date(res.start_date).getTime()) / 86400000));
  const total = Math.round(res.daily_rate * days * res.quantity);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/requests/${res.rental_request_id}` as any)}>
      <View style={[styles.statusBar, { backgroundColor: STATUS_COLOR[res.status] }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.dateRange}>{start} 〜 {end}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLOR[res.status] + '20' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[res.status] }]}>{STATUS_LABEL[res.status]}</Text>
          </View>
        </View>
        <Text style={styles.partnerName}>{res.lender_name ?? res.renter_name ?? '相手'}</Text>
        <Text style={styles.meta}>{res.quantity}台 ・ ¥{total.toLocaleString()}（{days}日）</Text>
      </View>
    </Pressable>
  );
}

type SectionItem =
  | { type: 'header'; label: string }
  | { type: 'item'; data: Reservation };

export default function Schedule() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReservations = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get<Reservation[]>('/reservations');
      setReservations(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const now = new Date();
  const upcoming = reservations.filter((r) => new Date(r.end_date) >= now && r.status !== 'cancelled');
  const past = reservations.filter((r) => new Date(r.end_date) < now || r.status === 'cancelled');

  const sections: SectionItem[] = [
    ...(upcoming.length > 0 ? [{ type: 'header' as const, label: '今後の予約' }, ...upcoming.map((r) => ({ type: 'item' as const, data: r }))] : []),
    ...(past.length > 0 ? [{ type: 'header' as const, label: '過去の予約' }, ...past.map((r) => ({ type: 'item' as const, data: r }))] : []),
  ];

  if (loading) return <LoadingScreen />;
  if (error) return <EmptyScreen icon="⚠️" message="予約の取得に失敗しました" action={{ label: '再試行', onPress: fetchReservations }} />;

  return (
    <FlatList
      data={sections}
      keyExtractor={(item, i) => String(i)}
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return <Text style={styles.sectionHeader}>{item.label}</Text>;
        }
        return <ReservationCard res={item.data} />;
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReservations(); }} tintColor="#3b82f6" />
      }
      contentContainerStyle={sections.length === 0 ? styles.empty : styles.list}
      ListEmptyComponent={
        <EmptyScreen
          icon="📅"
          message="予約がありません"
          subMessage="台車をレンタルすると承認後ここに表示されます"
        />
      }
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { paddingBottom: 24 },
  empty: { flex: 1 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dateRange: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  partnerName: { fontSize: 13, color: '#374151', marginBottom: 2 },
  meta: { fontSize: 13, color: '#6b7280' },
});
