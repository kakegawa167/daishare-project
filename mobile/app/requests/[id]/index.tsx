import { api } from '@/lib/api';
import { Message, RentalRequest, Reservation } from '@/lib/types';
import { useAuthStore } from '@/store/authStore';
import { useLocalSearchParams } from 'expo-router';
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

const STATUS_LABEL: Record<string, string> = {
  pending: '承認待ち',
  accepted: '承認済み',
  rejected: '拒否',
  cancelled: 'キャンセル',
  reserved: '予約確定',
  lent: '貸出中',
  returned: '返却済み',
};

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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.reviewModal}>
        <Text style={styles.reviewTitle}>レビューを書く</Text>
        <Text style={styles.reviewLabel}>評価</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3].map((v) => (
            <Pressable key={v} style={[styles.ratingBtn, rating === v && styles.ratingBtnActive]} onPress={() => setRating(v)}>
              <Text style={[styles.ratingBtnText, rating === v && styles.ratingBtnTextActive]}>
                {v === 1 ? '😞 悪い' : v === 2 ? '😐 普通' : '😊 良い'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.reviewLabel}>コメント（任意）</Text>
        <TextInput style={[styles.reviewInput, { height: 80, textAlignVertical: 'top' }]} value={comment} onChangeText={setComment} multiline placeholder="取引の感想を書いてください" />
        <Pressable style={[styles.reviewSubmit, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.reviewSubmitText}>投稿する</Text>}
        </Pressable>
        <Pressable style={styles.reviewCancel} onPress={onClose}>
          <Text style={styles.reviewCancelText}>キャンセル</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function MessageBubble({ msg, myId }: { msg: Message; myId: string }) {
  const isMine = msg.sender_id === myId;
  const time = new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  if (msg.is_system) {
    return (
      <View style={styles.systemMsg}>
        <Text style={styles.systemMsgText}>{msg.body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      {!isMine && <Text style={styles.senderName}>{msg.sender_name}</Text>}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{msg.body}</Text>
      </View>
      <Text style={styles.bubbleTime}>{time}</Text>
    </View>
  );
}

export default function RequestChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const myId = user?.id ?? '';

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

      // 予約が存在する場合は取得
      if (reqRes.data.status === 'accepted') {
        try {
          const resRes = await api.get<Reservation[]>('/reservations');
          const found = resRes.data.find((r) => r.rental_request_id === Number(id));
          if (found) setReservation(found);
        } catch {}
      }

      // 既読更新
      await api.post(`/rental-requests/${id}/messages/read`).catch(() => {});
    } catch {
      Alert.alert('エラー', 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await api.post<Message>(`/rental-requests/${id}/messages`, { body });
      setMessages((prev) => [...prev, res.data]);
      setInput('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('エラー', '送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'cancel') => {
    const labels = { accept: '承認', reject: '拒否', cancel: 'キャンセル' };
    Alert.alert(`${labels[action]}`, `リクエストを${labels[action]}しますか？`, [
      { text: 'いいえ', style: 'cancel' },
      {
        text: 'はい',
        style: action === 'accept' ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await api.post(`/rental-requests/${id}/${action}`);
            fetchAll();
          } catch {
            Alert.alert('エラー', '操作に失敗しました');
          }
        },
      },
    ]);
  };

  const handleReservationAction = async (action: 'lend' | 'return' | 'cancel') => {
    if (!reservation) return;
    const labels = { lend: '貸出開始', return: '返却完了', cancel: 'キャンセル' };
    Alert.alert(`${labels[action]}`, `${labels[action]}を記録しますか？`, [
      { text: 'いいえ', style: 'cancel' },
      {
        text: 'はい',
        onPress: async () => {
          try {
            await api.post(`/reservations/${reservation.id}/${action}`);
            fetchAll();
          } catch {
            Alert.alert('エラー', '操作に失敗しました');
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (!request) return null;

  const isLender = request.renter_id !== myId;
  const res = reservation;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* ステータスバー */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTitle}>{request.cart_title}</Text>
        <Text style={styles.statusLabel}>{STATUS_LABEL[res?.status ?? request.status] ?? request.status}</Text>
      </View>

      {/* アクションボタン */}
      {request.status === 'pending' && isLender && (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleAction('accept')}>
            <Text style={styles.acceptText}>承認する</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleAction('reject')}>
            <Text style={styles.rejectText}>拒否する</Text>
          </Pressable>
        </View>
      )}
      {request.status === 'pending' && !isLender && (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => handleAction('cancel')}>
            <Text style={styles.cancelText}>キャンセルする</Text>
          </Pressable>
        </View>
      )}
      {res?.status === 'reserved' && isLender && (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleReservationAction('lend')}>
            <Text style={styles.acceptText}>貸出開始</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={() => handleReservationAction('cancel')}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </Pressable>
        </View>
      )}
      {res?.status === 'lent' && isLender && (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleReservationAction('return')}>
            <Text style={styles.acceptText}>返却完了</Text>
          </Pressable>
        </View>
      )}
      {res?.status === 'returned' && (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={() => setShowReview(true)}>
            <Text style={{ color: '#92400e', fontWeight: '700' }}>⭐ レビューを書く</Text>
          </Pressable>
        </View>
      )}

      {/* メッセージ一覧 */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <MessageBubble msg={item} myId={myId} />}
        contentContainerStyle={styles.messageList}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.center}><Text style={styles.emptyText}>まだメッセージがありません</Text></View>
        }
      />

      {/* レビューモーダル */}
      {res && <ReviewModal reservationId={res.id} visible={showReview} onClose={() => setShowReview(false)} />}

      {/* 入力欄 */}
      {['pending', 'accepted'].includes(request.status) && (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="メッセージを入力..."
            multiline
            maxLength={500}
          />
          <Pressable style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || sending}>
            <Text style={styles.sendBtnText}>送信</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statusTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  statusLabel: { fontSize: 13, color: '#3b82f6', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  acceptBtn: { backgroundColor: '#10b981' },
  acceptText: { color: '#fff', fontWeight: '700' },
  rejectBtn: { backgroundColor: '#fee2e2' },
  rejectText: { color: '#ef4444', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#f3f4f6' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  messageList: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  emptyText: { color: '#9ca3af', marginTop: 40 },
  systemMsg: { alignItems: 'center', marginVertical: 8 },
  systemMsgText: { fontSize: 12, color: '#9ca3af', backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  bubbleRow: { marginBottom: 10 },
  bubbleRowMine: { alignItems: 'flex-end' },
  senderName: { fontSize: 11, color: '#9ca3af', marginBottom: 2, marginLeft: 4 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: '#3b82f6', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#1f2937', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 11, color: '#9ca3af', marginTop: 2, marginHorizontal: 4 },
  inputBar: { flexDirection: 'row', padding: 8, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  input: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 100 },
  sendBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#93c5fd' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  reviewModal: { flex: 1, padding: 24 },
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
