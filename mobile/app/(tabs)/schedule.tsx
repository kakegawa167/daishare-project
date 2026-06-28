import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Reservation } from '@/lib/types';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useAuthStore } from '@/store/authStore';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

type EventType = 'lend' | 'return';

interface ScheduleEvent {
  key: string;
  type: EventType;
  reservation: Reservation;
  eventDate: Date;
  isPast: boolean; // 実績として履歴扱いかどうか
}

const fmtDT = (d: string) =>
  new Date(d).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit',
  });

function EventCard({ event }: { event: ScheduleEvent }) {
  const { type, reservation: res, isPast } = event;
  const isLend = type === 'lend';

  const location = [res.municipality, res.station_name].filter(Boolean).join(' / ');
  const accent = isPast ? '#9ca3af' : isLend ? '#3b82f6' : '#10b981';
  const label  = isLend ? '貸出' : '返却';
  const timeLabel = isLend ? '貸出時間' : '返却時間';
  const timeValue = isLend ? res.start_date : res.end_date;

  return (
    <Pressable
      style={[s.card, isPast && s.cardPast]}
      onPress={() => router.push(`/requests/${res.rental_request_id}` as any)}
    >
      <View style={[s.accentBar, { backgroundColor: accent }]} />
      <View style={s.cardBody}>
        <View style={s.topRow}>
          <View style={[s.typeBadge, { backgroundColor: accent + '20' }]}>
            <Text style={[s.typeLabel, { color: accent }]}>{label}</Text>
          </View>
          <Text style={[s.cartTitle, isPast && { color: '#9ca3af' }]} numberOfLines={1}>
            {res.cart_title ?? '台車'} × {res.quantity}台
          </Text>
        </View>
        <View style={s.timeRow}>
          <Text style={s.timeLabel}>{timeLabel}</Text>
          <Text style={[s.timeValue, { color: accent }]}>{fmtDT(timeValue)}</Text>
        </View>
        {location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MaterialIcons name="place" size={12} color="#6b7280" />
            <Text style={s.location}>{location}</Text>
          </View>
        ) : null}
        {res.lending_address ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MaterialIcons name="home" size={12} color="#6b7280" />
            <Text style={s.location}>{res.lending_address}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

type SectionItem =
  | { kind: 'header'; label: string }
  | { kind: 'event'; event: ScheduleEvent }
  | { kind: 'history-toggle'; count: number; open: boolean };

export default function Schedule() {
  const { session } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  useFocusEffect(useCallback(() => { if (session) fetch(); }, [fetch, session]));

  if (!session) return <LoginPrompt message="スケジュールを確認するにはログインが必要です" />;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 86400000);

  // ── イベント展開 ──────────────────────────────────
  // 貸出カード: 貸出開始前 (reserved) → active / 開始済み (lent/returned) → 履歴
  // 返却カード: 返却前 (reserved/lent) → active / 返却済み (returned) → 履歴
  const activeEvents: ScheduleEvent[] = [];
  const historyEvents: ScheduleEvent[] = [];

  for (const res of reservations) {
    if (res.status === 'cancelled') continue;

    // 貸出カード
    const lendEvent: ScheduleEvent = {
      key: `lend-${res.id}`,
      type: 'lend',
      reservation: res,
      eventDate: new Date(res.start_date),
      isPast: false,
    };
    if (res.status === 'reserved') {
      // 貸出前 → active
      activeEvents.push(lendEvent);
    } else {
      // lent / returned → 貸出は履歴
      historyEvents.push({ ...lendEvent, isPast: true });
    }

    // 返却カード
    const returnEvent: ScheduleEvent = {
      key: `return-${res.id}`,
      type: 'return',
      reservation: res,
      eventDate: new Date(res.end_date),
      isPast: false,
    };
    if (res.status === 'returned') {
      // 返却済み → 履歴
      historyEvents.push({ ...returnEvent, isPast: true });
    } else {
      // reserved / lent → 返却はまだactive
      activeEvents.push(returnEvent);
    }
  }

  activeEvents.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  // 履歴は新しい順
  historyEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  const todayEvents  = activeEvents.filter((e) => e.eventDate >= todayStart && e.eventDate < todayEnd);
  const futureEvents = activeEvents.filter((e) => e.eventDate >= todayEnd);
  const pastActiveEvents = activeEvents.filter((e) => e.eventDate < todayStart); // 過去日付だが未完了

  // 履歴にも過去の未完了アクティブイベントを含める
  const allHistory = [
    ...pastActiveEvents.map(e => ({ ...e, isPast: true })),
    ...historyEvents,
  ].sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  const toItems = (evts: ScheduleEvent[]) => evts.map((e) => ({ kind: 'event' as const, event: e }));

  const sections: SectionItem[] = [
    ...(todayEvents.length > 0  ? [{ kind: 'header' as const, label: '本日のスケジュール' },  ...toItems(todayEvents)]  : []),
    ...(futureEvents.length > 0 ? [{ kind: 'header' as const, label: '明日以降のスケジュール' }, ...toItems(futureEvents)] : []),
    ...(allHistory.length > 0 ? [
      { kind: 'history-toggle' as const, count: allHistory.length, open: historyOpen },
      ...(historyOpen ? toItems(allHistory) : []),
    ] : []),
  ];

  if (loading) return <LoadingScreen />;
  if (error) return <EmptyScreen icon={<MaterialIcons name="warning-amber" size={56} color="#d1d5db" />} message="予約の取得に失敗しました" action={{ label: '再試行', onPress: fetch }} />;

  return (
    <FlatList
      data={sections}
      keyExtractor={(item, i) => {
        if (item.kind === 'header') return `h-${i}`;
        if (item.kind === 'history-toggle') return 'history-toggle';
        return item.event.key;
      }}
      renderItem={({ item }) => {
        if (item.kind === 'header') {
          return <Text style={s.sectionHeader}>{item.label}</Text>;
        }
        if (item.kind === 'history-toggle') {
          return (
            <Pressable style={s.historyToggle} onPress={() => setHistoryOpen((v) => !v)}>
              <Text style={s.historyToggleText}>
                {item.open ? '▲' : '▼'} スケジュール履歴（{item.count}件）
              </Text>
            </Pressable>
          );
        }
        return <EventCard event={item.event} />;
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor="#3b82f6" />
      }
      contentContainerStyle={sections.length === 0 ? s.empty : s.list}
      ListEmptyComponent={
        <EmptyScreen icon={<MaterialIcons name="calendar-today" size={56} color="#d1d5db" />} message="予定がありません" subMessage="リクエストが承認されると貸出・返却の予定が表示されます" />
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

  historyToggle: {
    marginHorizontal: 16, marginTop: 20, marginBottom: 4,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#f3f4f6', borderRadius: 10,
    alignItems: 'center',
  },
  historyToggleText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardPast: { opacity: 0.75 },
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
