import { api } from '@/lib/api';
import { Cart, RentalRequest } from '@/lib/types';
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
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000));
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (endDate <= startDate) { Alert.alert('エラー', '返却日は貸出日より後にしてください'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ start_date: startDate, end_date: endDate, quantity: Number(quantity) || 1, message });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <Text style={styles.modalTitle}>リクエスト送信</Text>
        <Text style={styles.modalCartTitle}>{cart.title}</Text>

        <Text style={styles.fieldLabel}>貸出開始日</Text>
        <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, d) => d && setStartDate(d)} minimumDate={new Date()} />

        <Text style={styles.fieldLabel}>返却日</Text>
        <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, d) => d && setEndDate(d)} minimumDate={startDate} />

        <Text style={styles.fieldLabel}>台数</Text>
        <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

        <Text style={styles.fieldLabel}>メッセージ（任意）</Text>
        <TextInput style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage} multiline numberOfLines={3} placeholder="用途や希望を伝えましょう" />

        <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>リクエストを送信する</Text>}
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>キャンセル</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

export default function LenderDetail() {
  const { lender_id } = useLocalSearchParams<{ lender_id: string }>();
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);

  const fetchCarts = useCallback(async () => {
    try {
      const res = await api.get<Cart[]>('/carts');
      setCarts(res.data.filter((c) => c.owner_id === lender_id));
    } catch {
      Alert.alert('エラー', '台車一覧の取得に失敗しました');
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

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={carts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={<Text style={styles.header}>{ownerName}の台車一覧</Text>}
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
  header: { fontSize: 18, fontWeight: '700', padding: 16 },
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
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: { marginTop: 28, backgroundColor: '#3b82f6', padding: 16, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 15 },
});
