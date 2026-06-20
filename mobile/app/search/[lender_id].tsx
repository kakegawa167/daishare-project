import { api } from '@/lib/api';
import { Cart, RentalRequest } from '@/lib/types';

interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name: string | null;
}

const RATING_LABEL = ['', '😞 悪い', '😐 普通', '😊 良い'];
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function RequestModal({
  cart,
  visible,
  onClose,
  onSubmit,
}: {
  cart: Cart;
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { start_date: Date; end_date: Date; quantity: number; message: string }) => Promise<void>;
}) {
  const tomorrow = new Date(Date.now() + 86400000);
  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 2 * 86400000));
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ quantity?: string; date?: string }>({});

  const handleSubmit = async () => {
    const errs: { quantity?: string; date?: string } = {};
    if (endDate <= startDate) errs.date = '返却日は貸出日より後にしてください';
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty < 1 || !Number.isInteger(qty)) errs.quantity = '1以上の整数を入力してください';
    else if (qty > cart.quantity) errs.quantity = `台数は${cart.quantity}台以下にしてください`;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({ start_date: startDate, end_date: endDate, quantity: qty, message });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.modalTitle} accessibilityRole="header">リクエスト送信</Text>
        <Text style={styles.modalCartTitle}>{cart.title}</Text>

        {errors.date && <Text style={styles.modalError} accessibilityRole="alert">{errors.date}</Text>}

        <Text style={styles.fieldLabel}>貸出開始日</Text>
        <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, d) => { if (d) { setStartDate(d); setErrors((e) => ({ ...e, date: undefined })); } }} minimumDate={tomorrow} />

        <Text style={styles.fieldLabel}>返却日</Text>
        <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, d) => { if (d) { setEndDate(d); setErrors((e) => ({ ...e, date: undefined })); } }} minimumDate={new Date(startDate.getTime() + 86400000)} />

        <Text style={styles.fieldLabel}>台数（最大{cart.quantity}台）</Text>
        <TextInput
          style={[styles.input, errors.quantity ? styles.inputError : null]}
          value={quantity}
          onChangeText={(v) => { setQuantity(v); setErrors((e) => ({ ...e, quantity: undefined })); }}
          keyboardType="number-pad"
          accessibilityLabel={`台数（最大${cart.quantity}台）`}
          returnKeyType="done"
        />
        {errors.quantity && <Text style={styles.modalError} accessibilityRole="alert">{errors.quantity}</Text>}

        <Text style={styles.fieldLabel}>メッセージ（任意）</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
          placeholder="用途や希望を伝えましょう"
          accessibilityLabel="メッセージ（任意）"
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="リクエストを送信する"
          accessibilityState={{ disabled: submitting }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>リクエストを送信する</Text>}
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="キャンセル">
          <Text style={styles.cancelBtnText}>キャンセル</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

export default function LenderDetail() {
  const { lender_id } = useLocalSearchParams<{ lender_id: string }>();
  const [carts, setCarts] = useState<Cart[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);

  const fetchCarts = useCallback(async () => {
    try {
      const [cartsRes, reviewsRes] = await Promise.all([
        api.get<Cart[]>('/carts'),
        api.get<Review[]>(`/users/${lender_id}/reviews`),
      ]);
      setCarts(cartsRes.data.filter((c) => c.owner_id === lender_id));
      setReviews(reviewsRes.data);
    } catch {
      Alert.alert('エラー', '情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [lender_id]);

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  const handleRequest = async (data: { start_date: Date; end_date: Date; quantity: number; message: string }) => {
    if (!selectedCart) return;
    await api.post<RentalRequest>('/rental-requests', {
      cart_id: selectedCart.id,
      start_date: data.start_date.toISOString(),
      end_date: data.end_date.toISOString(),
      quantity: data.quantity,
      message: data.message || null,
    });
    Alert.alert('完了', 'リクエストを送信しました');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  const ownerName = carts[0]?.owner_name ?? '貸主';
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const ListHeader = (
    <View>
      <View style={styles.profileHeader}>
        <Text style={styles.header}>{ownerName}</Text>
        {avgRating && (
          <Text style={styles.rating}>⭐ {avgRating} ({reviews.length}件)</Text>
        )}
      </View>
      {reviews.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>レビュー</Text>
          {reviews.slice(0, 3).map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <Text style={styles.reviewRating}>{RATING_LABEL[r.rating]}</Text>
              {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              <Text style={styles.reviewAuthor}>{r.reviewer_name ?? '匿名'}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.cartsTitle}>台車一覧</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={carts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image_urls.length > 0 && <Image source={{ uri: item.image_urls[0] }} style={styles.cardImage} />}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
              <Text style={styles.cardRate}>¥{item.daily_rate.toLocaleString()} / 日 ・ {item.quantity}台</Text>
              {item.station_name && <Text style={styles.cardMeta}>📍 {item.municipality} / {item.station_name}</Text>}
              <Pressable style={styles.requestBtn} onPress={() => setSelectedCart(item)}>
                <Text style={styles.requestBtnText}>リクエストを送る</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<View style={styles.center}><Text>台車がありません</Text></View>}
      />
      {selectedCart && (
        <RequestModal
          cart={selectedCart}
          visible={!!selectedCart}
          onClose={() => setSelectedCart(null)}
          onSubmit={handleRequest}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  header: { fontSize: 20, fontWeight: '700' },
  rating: { fontSize: 15, color: '#f59e0b', fontWeight: '600' },
  reviewSection: { marginHorizontal: 16, marginBottom: 8 },
  reviewSectionTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', marginBottom: 8 },
  reviewCard: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 6 },
  reviewRating: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  reviewComment: { fontSize: 13, color: '#374151', marginBottom: 4 },
  reviewAuthor: { fontSize: 12, color: '#9ca3af' },
  cartsTitle: { fontSize: 15, fontWeight: '700', color: '#374151', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  cardImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  cardRate: { fontSize: 15, fontWeight: '700', color: '#3b82f6', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  requestBtn: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  requestBtnText: { color: '#fff', fontWeight: '600' },
  modalContent: { padding: 24, paddingBottom: 48 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalCartTitle: { fontSize: 15, color: '#6b7280', marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, minHeight: 48 },
  inputError: { borderColor: '#ef4444', borderWidth: 1.5 },
  modalError: { color: '#ef4444', fontSize: 13, marginTop: 4 },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: { marginTop: 28, backgroundColor: '#3b82f6', padding: 16, borderRadius: 10, alignItems: 'center', minHeight: 54 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 15 },
});
