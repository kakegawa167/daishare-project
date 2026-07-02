import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { RentalRequest } from '@/lib/types';
import { fmtDateSmart } from '@/lib/format';
import { EmptyScreen, LoadingScreen } from '@/components/ScreenState';
import { useAuthStore } from '@/store/authStore';
import { LoginPrompt } from '@/components/LoginPrompt';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

const STATUS_LABEL: Record<string, string> = {
  pending:   '承認待ち',
  accepted:  '予約中',
  rejected:  '拒否',
  cancelled: 'キャンセル',
  reserved:  '予約確定',
  lent:      '貸出中',
  returned:  '返却済み',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  accepted:  '#10b981',
  rejected:  '#ef4444',
  cancelled: '#9ca3af',
  reserved:  '#10b981',
  lent:      '#8b5cf6',
  returned:  '#6b7280',
};

function ThreadCard({ req, userId }: { req: RentalRequest; userId: string }) {
  const isLender = req.renter_id !== userId;
  const otherName = isLender
    ? (req.renter_name ?? '借りる人')
    : (req.lender_name ?? '貸す人');

  const location = [req.municipality, req.station_name].filter(Boolean).join(' / ');

  // 最終メッセージの時刻表示（LINEスタイル）: 当日=時刻 / 7日以内=N日前 / それ以上=日付（年跨ぎのみ年付き）
  const lastAt = req.last_message_at ? new Date(req.last_message_at) : new Date(req.created_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastAt.getTime()) / 86400000);
  const timeStr = diffDays === 0
    ? lastAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : diffDays < 7
    ? `${diffDays}日前`
    : fmtDateSmart(lastAt);

  // 日程（時刻は省き簡潔に。今年と異なる年のみ年を付ける）＋場所を 1 行のメタに集約
  const dateShort = req.start_date && req.end_date
    ? `${fmtDateSmart(req.start_date)}〜${fmtDateSmart(req.end_date)}`
    : null;
  const metaLine = [dateShort, location].filter(Boolean).join('  ·  ');

  const hasMessage = !!req.last_message_body;
  const previewText = req.last_message_body ?? (req.start_date ? 'リクエスト送信済み' : '問い合わせ中');
  const hasUnread = req.unread_count > 0;

  const st = req.reservation_status ?? req.status;
  const stColor = STATUS_COLOR[st] ?? '#9ca3af';
  const stLabel = STATUS_LABEL[st] ?? st;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { backgroundColor: '#f9fafb' }]}
      onPress={() => router.push(`/requests/${req.id}` as any)}
    >
      {/* アバター */}
      <View style={s.avatar}>
        <Text style={s.avatarText}>{otherName.charAt(0)}</Text>
      </View>

      {/* メイン情報 */}
      <View style={s.body}>
        {/* 1行目: 名前 + ステータスバッジ + 時刻 */}
        <View style={s.row}>
          <Text style={s.name} numberOfLines={1}>{otherName}</Text>
          <View style={[s.statusBadge, { backgroundColor: stColor + '22' }]}>
            <Text style={[s.statusBadgeText, { color: stColor }]}>{stLabel}</Text>
          </View>
          <Text style={s.time}>{timeStr}</Text>
        </View>

        {/* 2行目: 予約識別（台車名 × 台数） */}
        <View style={s.cartRow}>
          <MaterialIcons name="shopping-cart" size={13} color="#1d4ed8" />
          <Text style={s.cartLine} numberOfLines={1}>{req.cart_title ?? '台車'} × {req.quantity}台</Text>
        </View>

        {/* 3行目: 最終メッセージ（主役）＋ 未読バッジ */}
        <View style={s.previewRow}>
          <Text
            style={[s.preview, !hasMessage && s.previewMuted, hasUnread && s.previewUnread]}
            numberOfLines={1}
          >
            {previewText}
          </Text>
          {hasUnread && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{req.unread_count > 99 ? '99+' : req.unread_count}</Text>
            </View>
          )}
        </View>

        {/* 4行目: 日程・場所（補足・小さく1行に集約） */}
        {metaLine ? (
          <Text style={s.metaLine} numberOfLines={1}>{metaLine}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function Messages() {
  const { user, session } = useAuthStore();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get<RentalRequest[]>('/rental-requests');
      // rejected/cancelled を除外し、最終メッセージ日時で降順ソート
      const active = res.data
        .filter((r) => r.status !== 'rejected' && r.status !== 'cancelled')
        .sort((a, b) => {
          const ta = a.last_message_at ?? a.created_at;
          const tb = b.last_message_at ?? b.created_at;
          return new Date(tb).getTime() - new Date(ta).getTime();
        });
      setRequests(active);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (session) fetchRequests(); }, [fetchRequests, session]));

  if (!session) return <LoginPrompt message="メッセージを確認するにはログインが必要です" />;

  if (loading) return <LoadingScreen />;
  if (error) return (
    <EmptyScreen icon={<MaterialIcons name="warning-amber" size={56} color="#d1d5db" />} message="取得に失敗しました" action={{ label: '再試行', onPress: fetchRequests }} />
  );

  return (
    <FlatList
      data={requests}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ThreadCard req={item} userId={user?.id ?? ''} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchRequests(); }}
          tintColor="#3b82f6"
        />
      }
      contentContainerStyle={requests.length === 0 ? s.empty : s.list}
      ListEmptyComponent={
        <EmptyScreen
          icon={<MaterialIcons name="chat-bubble-outline" size={56} color="#d1d5db" />}
          message="メッセージがありません"
          subMessage="リクエストが届くとここに表示されます"
        />
      }
      style={s.container}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { paddingBottom: 24 },
  empty: { flex: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#3b82f6' },

  body: { flex: 1, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  time: { fontSize: 12, color: '#9ca3af', flexShrink: 0 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, flexShrink: 0 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartLine: { flex: 1, fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  // 最終メッセージ = 主役（大きく・濃く）
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  preview: { flex: 1, fontSize: 14, color: '#4b5563', lineHeight: 19 },
  previewUnread: { color: '#111827', fontWeight: '700' },
  previewMuted: { color: '#9ca3af', fontStyle: 'italic' },

  // 日程・場所 = 補足（小さく・薄く）
  metaLine: { fontSize: 11, color: '#9ca3af' },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});
