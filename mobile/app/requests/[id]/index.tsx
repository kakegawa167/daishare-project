import { api } from '@/lib/api';
import { Message, RentalRequest, Reservation } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_LABEL: Record<string, string> = {
  pending: '承認待ち',
  accepted: '承認済み',
  rejected: '拒否',
  cancelled: 'キャンセル',
  reserved: '予約確定',
  lent: '貸出中',
  returned: '返却済み',
};
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#10b981',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
  reserved: '#3b82f6',
  lent: '#8b5cf6',
  returned: '#6b7280',
};

const fmtDT = (d: string) =>
  new Date(d).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── レビューモーダル ──────────────────────────────────
function ReviewModal({ reservationId, visible, onClose }: { reservationId: number; visible: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/reservations/${reservationId}/reviews`, { rating, comment });
      Alert.alert('完了', 'レビューを投稿しました');
      onClose();
    } catch {
      Alert.alert('エラー', '投稿に失敗しました（既に投稿済みの可能性があります）');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={s.reviewModal}>
        <Text style={s.reviewTitle}>レビューを書く</Text>
        <Text style={s.reviewLabel}>評価</Text>
        <View style={s.ratingRow}>
          {([1, 2, 3] as const).map((v) => (
            <Pressable key={v} style={[s.ratingBtn, rating === v && s.ratingBtnActive]} onPress={() => setRating(v)}>
              <Text style={[s.ratingBtnText, rating === v && s.ratingBtnTextActive]}>
                {v === 1 ? '😞 悪い' : v === 2 ? '😐 普通' : '😊 良い'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.reviewLabel}>コメント（任意）</Text>
        <TextInput
          style={[s.reviewInput, { height: 80, textAlignVertical: 'top' }]}
          value={comment} onChangeText={setComment} multiline
          placeholder="取引の感想を書いてください" maxLength={500}
        />
        <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 2 }}>{comment.length}/500</Text>
        <Pressable style={[s.reviewSubmit, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.reviewSubmitText}>投稿する</Text>}
        </Pressable>
        <Pressable style={s.reviewCancel} onPress={onClose}>
          <Text style={s.reviewCancelText}>キャンセル</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── リクエスト条件カード ──────────────────────────────
function RequestInfoCard({ req, status }: { req: RentalRequest; status: string }) {
  const [open, setOpen] = useState(false);
  const color = STATUS_COLOR[status] ?? '#9ca3af';
  return (
    <Pressable style={s.infoCard} onPress={() => setOpen((v) => !v)}>
      <View style={s.infoCardTop}>
        <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
          <Text style={[s.statusBadgeText, { color }]}>{STATUS_LABEL[status] ?? status}</Text>
        </View>
        <Text style={s.infoToggleHint}>リクエスト詳細 {open ? '▲' : '▼'}</Text>
      </View>
      {open && (
        <View style={s.infoDetails}>
          <Text style={s.infoRow}>🛒 台車: {req.cart_title ?? '台車'}</Text>
          <Text style={s.infoRow}>🕐 貸出希望: {fmtDT(req.start_date)}</Text>
          <Text style={s.infoRow}>🕐 返却希望: {fmtDT(req.end_date)}</Text>
          <Text style={s.infoRow}>📦 台数: {req.quantity}台</Text>
          {(req.municipality || req.station_name) && (
            <Text style={s.infoRow}>📍 {[req.municipality, req.station_name].filter(Boolean).join(' / ')}</Text>
          )}
          {req.lending_address ? <Text style={s.infoRow}>🏠 {req.lending_address}</Text> : null}
          {req.renter_name ? <Text style={s.infoRow}>👤 借りる人: {req.renter_name}</Text> : null}
          {req.message ? <Text style={s.infoRow}>💬 備考: {req.message}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

// ─── メッセージバブル ──────────────────────────────────
function MessageBubble({ msg, myId }: { msg: Message; myId: string }) {
  const isMine = msg.sender_id === myId;
  const time = new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  if (msg.is_system) {
    return (
      <View style={s.systemMsg}>
        <Text style={s.systemMsgText}>{msg.body}</Text>
      </View>
    );
  }

  return (
    <View style={[s.bubbleWrap, isMine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
      {!isMine && <Text style={s.senderName}>{msg.sender_name}</Text>}
      <View style={s.bubbleRow}>
        {isMine && <Text style={[s.bubbleTime, { marginRight: 6 }]}>{time}</Text>}
        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
          <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{msg.body}</Text>
        </View>
        {!isMine && <Text style={[s.bubbleTime, { marginLeft: 6 }]}>{time}</Text>}
      </View>
    </View>
  );
}

// ─── メイン ────────────────────────────────────────────
export default function RequestChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const myId = user?.id ?? '';
  const insets = useSafeAreaInsets();

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const listRef = useRef<FlatList>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, msgRes] = await Promise.all([
        api.get<RentalRequest>(`/rental-requests/${id}`),
        api.get<Message[]>(`/rental-requests/${id}/messages`),
      ]);
      setRequest(reqRes.data);
      setMessages(msgRes.data);

      if (reqRes.data.status === 'accepted') {
        try {
          const resRes = await api.get<Reservation[]>('/reservations');
          const found = resRes.data.find((r) => r.rental_request_id === Number(id));
          if (found) setReservation(found);
        } catch {}
      }

      await api.post(`/rental-requests/${id}/messages/read`).catch(() => {});
    } catch {
      Alert.alert('エラー', 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:request:${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `rental_request_id=eq.${id}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now(), rental_request_id: Number(id), sender_id: myId,
      body, is_read: false, is_system: false, created_at: new Date().toISOString(),
      sender_name: user?.display_name ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await api.post<Message>(`/rental-requests/${id}/messages`, { body });
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? res.data : m));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(body);
      Alert.alert('エラー', '送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'cancel') => {
    const labels = { accept: '承認', reject: '拒否', cancel: 'キャンセル' };
    Alert.alert(`${labels[action]}`, `リクエストを${labels[action]}しますか？`, [
      { text: 'いいえ', style: 'cancel' },
      { text: 'はい', style: action === 'accept' ? 'default' : 'destructive',
        onPress: async () => { try { await api.post(`/rental-requests/${id}/${action}`); fetchAll(); } catch { Alert.alert('エラー', '操作に失敗しました'); } }
      },
    ]);
  };

  const handleReservationAction = async (action: 'lend' | 'return' | 'cancel') => {
    if (!reservation) return;
    const labels = { lend: '貸出開始', return: '返却完了', cancel: 'キャンセル' };
    Alert.alert(`${labels[action]}`, `${labels[action]}を記録しますか？`, [
      { text: 'いいえ', style: 'cancel' },
      { text: 'はい', onPress: async () => { try { await api.post(`/reservations/${reservation.id}/${action}`); fetchAll(); } catch { Alert.alert('エラー', '操作に失敗しました'); } } },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  if (!request) return null;

  const isLender = request.renter_id !== myId;
  const res = reservation;
  const currentStatus = res?.status ?? request.status;
  const canChat = ['pending', 'accepted', 'reserved', 'lent'].includes(request.status);

  // 相手の名前をヘッダーに表示
  const otherName = isLender
    ? (request.renter_name ?? 'チャット')
    : (request.lender_name ?? 'チャット');

  return (
    <>
      {/* ヘッダータイトルを相手のユーザー名に動的変更 */}
      <Stack.Screen options={{ title: otherName }} />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#e8edf2' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + 44) : 0}
      >
        {/* リクエスト条件カード */}
        <RequestInfoCard req={request} status={currentStatus} />

        {/* アクションボタン */}
        {request.status === 'pending' && isLender && (
          <View style={s.actionRow}>
            <Pressable style={[s.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => handleAction('accept')}>
              <Text style={s.actionBtnText}>✓ 承認する</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => handleAction('reject')}>
              <Text style={[s.actionBtnText, { color: '#ef4444' }]}>✕ 拒否する</Text>
            </Pressable>
          </View>
        )}
        {request.status === 'pending' && !isLender && (
          <View style={s.actionRow}>
            <Pressable style={[s.actionBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => handleAction('cancel')}>
              <Text style={[s.actionBtnText, { color: '#6b7280' }]}>キャンセルする</Text>
            </Pressable>
          </View>
        )}
        {res?.status === 'reserved' && isLender && (
          <View style={s.actionRow}>
            <Pressable style={[s.actionBtn, { backgroundColor: '#8b5cf6' }]} onPress={() => handleReservationAction('lend')}>
              <Text style={s.actionBtnText}>🚀 貸出開始</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => handleReservationAction('cancel')}>
              <Text style={[s.actionBtnText, { color: '#6b7280' }]}>キャンセル</Text>
            </Pressable>
          </View>
        )}
        {res?.status === 'lent' && isLender && (
          <View style={s.actionRow}>
            <Pressable style={[s.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={() => handleReservationAction('return')}>
              <Text style={s.actionBtnText}>📦 返却完了</Text>
            </Pressable>
          </View>
        )}
        {res?.status === 'returned' && (
          <View style={s.actionRow}>
            <Pressable style={[s.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={() => setShowReview(true)}>
              <Text style={[s.actionBtnText, { color: '#92400e' }]}>⭐ レビューを書く</Text>
            </Pressable>
          </View>
        )}

        {/* メッセージ一覧 */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => <MessageBubble msg={item} myId={myId} />}
          contentContainerStyle={s.msgList}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>まだメッセージがありません{'\n'}最初のメッセージを送りましょう</Text>
            </View>
          }
        />

        {res && <ReviewModal reservationId={res.id} visible={showReview} onClose={() => setShowReview(false)} />}

        {/* 入力欄 */}
        {canChat && (
          <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="メッセージを入力..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
            />
            <Pressable
              style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnOff]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.sendBtnText}>送信</Text>
              }
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  infoCard: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  infoCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  infoToggleHint: { flex: 1, textAlign: 'right', fontSize: 12, color: '#9ca3af' },
  infoDetails: { marginTop: 8, gap: 3 },
  infoRow: { fontSize: 13, color: '#6b7280', lineHeight: 20 },

  actionRow: {
    flexDirection: 'row', gap: 8, padding: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  msgList: { flexGrow: 1, paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },

  systemMsg: { alignItems: 'center', marginVertical: 8 },
  systemMsgText: {
    fontSize: 12, color: '#9ca3af',
    backgroundColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
  },

  bubbleWrap: { marginBottom: 6, maxWidth: '80%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: '#9ca3af', marginBottom: 2, marginLeft: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMine: { backgroundColor: '#3b82f6', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#1f2937', lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 11, color: '#9ca3af' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 10, paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 40, maxHeight: 120,
    backgroundColor: '#f3f4f6', borderRadius: 20,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: '#111827', lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, marginBottom: 0,
    backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: '#93c5fd' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  reviewModal: { flex: 1, padding: 24, backgroundColor: '#fff' },
  reviewTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  reviewLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  ratingBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  ratingBtnText: { fontSize: 13, color: '#374151' },
  ratingBtnTextActive: { color: '#fff', fontWeight: '700' },
  reviewInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15 },
  reviewSubmit: { marginTop: 24, backgroundColor: '#3b82f6', padding: 16, borderRadius: 10, alignItems: 'center' },
  reviewSubmitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  reviewCancel: { marginTop: 12, padding: 12, alignItems: 'center' },
  reviewCancelText: { color: '#6b7280', fontSize: 15 },
});
