import { api } from '@/lib/api';
import { Reservation } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

type EventType = 'lend' | 'return';

interface ScheduleEvent {
  key: string;
  type: EventType;
  reservation: Reservation;
  eventDate: Date;
}

const fmtDT = (d: string) =>
  new Date(d).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit',
  });

function EventCard({ event }: { event: ScheduleEvent }) {
  const { type, reservation: res } = event;
  const isLend = type === 'lend';

  const location = [res.municipality, res.station_name].filter(Boolean).join(' / ');

  const accent = isLend ? '#3b82f6' : '#10b981';
  const label = isLend ? '貸出' : '返却';
  const timeLabel = isLend ? '貸出時間' : '返却時間';
  const timeValue = isLend ? res.start_date : res.end_date;

  return (
    <Pressable
      style={s.card}
      onPress={() => router.push(`/requests/${res.rental_request_id}` as any)}
    >
      <View style={[s.accentBar, { backgroundColor: accent }]} />
      <View style={s.cardBody}>
        {/* ラベル + 台車名 */}
        <View style={s.topRow}>
          <View style={[s.typeBadge, { backgroundColor: accent + '18' }]}>
            <Text style={[s.typeLabel, { color: accent }]}>{label}</Text>
          </View>
          <Text style={s.cartTitle} numberOfLines={1}>
            {res.cart_title ?? '台車'} × {res.quantity}台
          </Text>
        </View>

        {/* 時刻 */}
        <View style={s.timeRow}>
          <Text style={s.timeLabel}>{timeLabel}</Text>
          <Text style={[s.timeValue, { color: accent }]}>{fmtDT(timeValue)}</Text>
        </View>

        {/* 場所 */}
        {location ? (
          <Text style={s.location}>📍 {location}</Text>
        ) : null}
        {res.lending_address ? (
          <Text style={s.location}>🏠 {res.lending_address}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type SectionItem =
  | { kind: 'header'; label: string }
  | { kind: 'event'; event: ScheduleEvent };

export default function Schedule() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
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

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  const userId = user?.id ?? '';
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 86400000);

  // 全イベントを貸出・返却に展開して日付順にソート
  const allEvents: ScheduleEvent[] = [];
  for (const res of reservations) {
    if (res.status === 'cancelled') continue;
    if (res.status === 'reserved' || res.status === 'lent') {
      allEvents.push({ key: `lend-${res.id}`, type: 'lend', reservation: res, eventDate: new Date(res.start_date) });
      allEvents.push({ key: `return-${res.id}`, type: 'return', reservation: res, eventDate: new Date(res.end_date) });
    }
    if (res.status === 'returned') {
      allEvents.push({ key: `return-done-${res.id}`, type: 'return', reservation: res, eventDate: new Date(res.end_date) });
    }
  }
  allEvents.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  const todayEvents  = allEvents.filter((e) => e.eventDate >= todayStart && e.eventDate < todayEnd);
  const futureEvents = allEvents.filter((e) => e.eventDate >= todayEnd);
  const pastEvents   = allEvents.filter((e) => e.eventDate < todayStart);

  const toItems = (evts: ScheduleEvent[]) => evts.map((e) => ({ kind: 'event' as const, event: e }));

  const sections: SectionItem[] = [
    ...(todayEvents.length > 0  ? [{ kind: 'header' as const, label: '本日のスケジュール' },  ...toItems(todayEvents)]  : []),
    ...(futureEvents.length > 0 ? [{ kind: 'header' as const, label: '今後のスケジュール' }, ...toItems(futureEvents)] : []),
    ...(pastEvents.length > 0   ? [{ kind: 'header' as const, label: '過去の予約' },          ...toItems(pastEvents.slice().reverse())]  : []),
  ];

  if (loading) return <LoadingScreen />;
  if (error) return <EmptyScreen icon="⚠️" message="予約の取得に失敗しました" action={{ label: '再試行', onPress: fetch }} />;

  return (
    <FlatList
      data={sections}
      keyExtractor={(item, i) => item.kind === 'header' ? `h-${i}` : item.event.key}
      renderItem={({ item }) =>
        item.kind === 'header'
          ? <Text style={s.sectionHeader}>{item.label}</Text>
          : <EventCard event={item.event} />
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor="#3b82f6" />
      }
      contentContainerStyle={sections.length === 0 ? s.empty : s.list}
      ListEmptyComponent={
        <EmptyScreen icon="📅" message="予定がありません" subMessage="リクエストが承認されると貸出・返却の予定が表示されます" />
      }
      style={s.container}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { paddingBottom: 32 },
  empty: { flex: 1 },

  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  accentBar: { width: 5 },
  cardBody: { flex: 1, padding: 14 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  typeLabel: { fontSize: 12, fontWeight: '700' },
  cartTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  timeLabel: { fontSize: 12, color: '#9ca3af', width: 48 },
  timeValue: { fontSize: 14, fontWeight: '700' },

  location: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
