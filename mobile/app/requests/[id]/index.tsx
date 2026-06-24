import { api } from '@/lib/api';
import { Cart, Message, RentalRequest, Reservation } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  ScrollView,
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

// ─── 台車カード + カウンター ───────────────────────────
function CartEditRow({ cart, qty, onChange }: { cart: Cart; qty: number; onChange: (v: number) => void }) {
  const rate = cart.daily_rate != null ? `¥${cart.daily_rate.toLocaleString()}/日`
    : cart.weekly_rate != null ? `¥${cart.weekly_rate.toLocaleString()}/週`
    : `¥${(cart.per_rental_rate ?? 0).toLocaleString()}/回`;

  return (
    <View style={[s.cartRow, qty > 0 && s.cartRowSelected]}>
      <View style={s.cartRowInfo}>
        <Text style={s.cartRowTitle} numberOfLines={1}>{cart.title}</Text>
        <Text style={s.cartRowRate}>{rate} ・ 在庫{cart.quantity}台</Text>
        {(cart.municipality || cart.station_name) && (
          <Text style={s.cartRowMeta}>📍 {[cart.municipality, cart.station_name].filter(Boolean).join(' / ')}</Text>
        )}
      </View>
      <View style={s.counter}>
        <Pressable
          style={[s.counterBtn, qty === 0 && s.counterBtnDisabled]}
          onPress={() => onChange(Math.max(0, qty - 1))}
          disabled={qty === 0}
        >
          <Text style={[s.counterBtnText, qty === 0 && { color: '#d1d5db' }]}>−</Text>
        </Pressable>
        <Text style={s.counterVal}>{qty}</Text>
        <Pressable
          style={[s.counterBtn, qty >= cart.quantity && s.counterBtnDisabled]}
          onPress={() => onChange(Math.min(cart.quantity, qty + 1))}
          disabled={qty >= cart.quantity}
        >
          <Text style={[s.counterBtnText, qty >= cart.quantity && { color: '#d1d5db' }]}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── リクエスト編集モーダル (貸主用) ──────────────────
function EditRequestModal({
  visible, req, onClose, onSaved,
}: { visible: boolean; req: RentalRequest; onClose: () => void; onSaved: () => void }) {
  const [startDate, setStartDate] = useState(new Date(req.start_date));
  const [endDate, setEndDate] = useState(new Date(req.end_date));
  const [qty, setQty] = useState(req.quantity);
  const [cart, setCart] = useState<Cart | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    api.get<Cart>(`/carts/${req.cart_id}`).then((r) => setCart(r.data)).catch(() => {});
  }, [visible, req.cart_id]);

  const handleSave = async () => {
    if (endDate <= startDate) {
      Alert.alert('エラー', '返却希望日は貸出希望日より後にしてください');
      return;
    }
    if (qty < 1) {
      Alert.alert('エラー', '台数は1台以上選択してください');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/rental-requests/${req.id}`, {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        quantity: qty,
      });
      onSaved();
      onClose();
    } catch {
      Alert.alert('エラー', '更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtD = (d: Date) =>
    d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} accessibilityViewIsModal>
      <ScrollView style={s.editModal} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={s.editTitle}>リクエストを編集</Text>

        <Text style={s.editLabel}>貸出希望日時</Text>
        <Pressable style={s.editDtBtn} onPress={() => setShowStart(true)}>
          <Text style={s.editDtBtnText}>📅 {fmtD(startDate)}</Text>
        </Pressable>
        {showStart && (
          <DateTimePicker
            value={startDate} mode="datetime" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => { setShowStart(false); if (d) setStartDate(d); }}
          />
        )}

        <Text style={s.editLabel}>返却希望日時</Text>
        <Pressable style={s.editDtBtn} onPress={() => setShowEnd(true)}>
          <Text style={s.editDtBtnText}>📅 {fmtD(endDate)}</Text>
        </Pressable>
        {showEnd && (
          <DateTimePicker
            value={endDate} mode="datetime" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => { setShowEnd(false); if (d) setEndDate(d); }}
          />
        )}

        <Text style={s.editLabel}>台車・台数</Text>
        {cart ? (
          <CartEditRow cart={cart} qty={qty} onChange={setQty} />
        ) : (
          <ActivityIndicator style={{ marginVertical: 12 }} color="#3b82f6" />
        )}

        <Pressable style={[s.editSaveBtn, (submitting || qty < 1) && { opacity: 0.6 }]} onPress={handleSave} disabled={submitting || qty < 1}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.editSaveBtnText}>保存する</Text>}
        </Pressable>
        <Pressable style={s.reviewCancel} onPress={onClose}>
          <Text style={s.reviewCancelText}>キャンセル</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

// ─── リクエスト条件カード (常時展開) ──────────────────
function RequestInfoCard({ req, status }: { req: RentalRequest; status: string }) {
  const color = STATUS_COLOR[status] ?? '#9ca3af';
  return (
    <View style={s.infoCard}>
      <View style={s.infoCardTop}>
        <Text style={s.infoCartTitle} numberOfLines={1}>🛒 {req.cart_title ?? '台車'}</Text>
        <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
          <Text style={[s.statusBadgeText, { color }]}>{STATUS_LABEL[status] ?? status}</Text>
        </View>
      </View>
      <View style={s.infoDetails}>
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
    </View>
  );
}

// ─── メッセージバブル ──────────────────────────────────
function MessageBubble({ msg, myId, isLastRead }: { msg: Message; myId: string; isLastRead: boolean }) {
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
        {isMine && (
          <View style={s.bubbleMeta}>
            {isLastRead && <Text style={s.readText}>既読</Text>}
            <Text style={s.bubbleTime}>{time}</Text>
          </View>
        )}
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
  const [showEdit, setShowEdit] = useState(false);
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
          // 相手のメッセージが届いたら既読にする
          if (msg.sender_id !== myId) {
            api.post(`/rental-requests/${id}/messages/read`).catch(() => {});
          }
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `rental_request_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, is_read: updated.is_read } : m));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, myId]);

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

  const handleAction = async (action: 'accept' | 'reject') => {
    const labels = { accept: '承認', reject: '拒否' };
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

  const otherName = isLender
    ? (request.renter_name ?? 'チャット')
    : (request.lender_name ?? 'チャット');

  return (
    <>
      <Stack.Screen options={{ title: otherName }} />

      {/* キーボード対応: FlatListにautomaticallyAdjustKeyboardInsets、inputはKAVで押し上げ */}
      <View style={{ flex: 1, backgroundColor: '#e8edf2' }}>
        {/* リクエスト条件カード */}
        <RequestInfoCard req={request} status={currentStatus} />

        {/* 貸主アクションボタン: pending時 */}
        {request.status === 'pending' && isLender && (
          <View style={s.actionRow}>
            <Pressable style={[s.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => handleAction('accept')}>
              <Text style={s.actionBtnText}>✓ 承認</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={() => setShowEdit(true)}>
              <Text style={s.actionBtnText}>✏️ 編集</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => handleAction('reject')}>
              <Text style={[s.actionBtnText, { color: '#ef4444' }]}>✕ 拒否</Text>
            </Pressable>
          </View>
        )}

        {/* 貸主アクション: 予約確定後 */}
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
          renderItem={({ item, index }) => {
            // 自分が送った既読メッセージのうち最後の1件にだけ「既読」を表示
            const isMine = item.sender_id === myId;
            const isLastRead = isMine && item.is_read && !item.is_system &&
              messages.slice(index + 1).every((m) => !m.is_read || m.sender_id !== myId || m.is_system);
            return <MessageBubble msg={item} myId={myId} isLastRead={isLastRead} />;
          }}
          contentContainerStyle={s.msgList}
          // iOS 15+: キーボード出現時にスクロールを自動調整
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>まだメッセージがありません{'\n'}最初のメッセージを送りましょう</Text>
            </View>
          }
        />

        {/* 入力欄: KAVでキーボードの上に固定 */}
        {canChat && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
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
          </KeyboardAvoidingView>
        )}
      </View>

      {res && <ReviewModal reservationId={res.id} visible={showReview} onClose={() => setShowReview(false)} />}
      {showEdit && request && (
        <EditRequestModal
          visible={showEdit}
          req={request}
          onClose={() => setShowEdit(false)}
          onSaved={fetchAll}
        />
      )}
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
  infoCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoCartTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  infoDetails: { gap: 2 },
  infoRow: { fontSize: 13, color: '#6b7280', lineHeight: 19 },

  actionRow: {
    flexDirection: 'row', gap: 8, padding: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
  bubbleMeta: { alignItems: 'flex-end', marginRight: 6, gap: 2 },
  readText: { fontSize: 10, color: '#3b82f6', fontWeight: '600' },
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: '#93c5fd' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // レビューモーダル
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

  // 台車カード
  cartRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb',
    borderRadius: 12, padding: 12, marginBottom: 6, gap: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  cartRowSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  cartRowInfo: { flex: 1 },
  cartRowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cartRowRate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cartRowMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnDisabled: { borderColor: '#e5e7eb' },
  counterBtnText: { fontSize: 18, fontWeight: '700', color: '#3b82f6', lineHeight: 22 },
  counterVal: { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' },

  // 編集モーダル
  editModal: { flex: 1, padding: 24, backgroundColor: '#fff' },
  editTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  editLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  editDtBtn: {
    backgroundColor: '#f3f4f6', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  editDtBtnText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  editInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#111827',
  },
  editSaveBtn: { marginTop: 24, backgroundColor: '#3b82f6', padding: 16, borderRadius: 10, alignItems: 'center' },
  editSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
