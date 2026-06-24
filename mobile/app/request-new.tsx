import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '@/lib/api';
import { Cart } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface LenderProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

const fmt = (d: Date) =>
  d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── 日時ピッカー ──────────────────────────────────────
function DateTimeField({
  label, value, onChange, minimumDate,
}: { label: string; value: Date; onChange: (d: Date) => void; minimumDate?: Date }) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  return (
    <View style={s.dtField}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.dtRow}>
        <Pressable style={s.dtBtn} onPress={() => setShowDate(true)}>
          <Text style={s.dtBtnText}>📅 {value.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</Text>
        </Pressable>
        <Pressable style={s.dtBtn} onPress={() => setShowTime(true)}>
          <Text style={s.dtBtnText}>🕐 {value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</Text>
        </Pressable>
      </View>
      {showDate && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={(_, d) => { setShowDate(false); if (d) { const n = new Date(d); n.setHours(value.getHours(), value.getMinutes()); onChange(n); } }}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => { setShowTime(false); if (d) { const n = new Date(value); n.setHours(d.getHours(), d.getMinutes()); onChange(n); } }}
        />
      )}
    </View>
  );
}

// ─── 台車選択行 ────────────────────────────────────────
function CartSelectRow({
  cart, qty, onChange,
}: { cart: Cart; qty: number; onChange: (v: number) => void }) {
  const rate = cart.daily_rate != null ? `¥${cart.daily_rate.toLocaleString()}/日`
    : cart.weekly_rate != null ? `¥${cart.weekly_rate.toLocaleString()}/週`
    : `¥${(cart.per_rental_rate ?? 0).toLocaleString()}/回`;

  return (
    <View style={[s.cartRow, qty > 0 && s.cartRowSelected]}>
      {cart.image_urls[0] ? (
        <Image source={{ uri: cart.image_urls[0] }} style={s.cartThumb} />
      ) : (
        <View style={[s.cartThumb, s.cartThumbPlaceholder]}>
          <Text style={{ fontSize: 20 }}>🛒</Text>
        </View>
      )}
      <View style={s.cartRowInfo}>
        <Text style={s.cartRowTitle} numberOfLines={1}>{cart.title}</Text>
        <Text style={s.cartRowRate}>{rate} ・ 在庫{cart.quantity}台</Text>
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

// ─── メイン ────────────────────────────────────────────
export default function RequestNew() {
  const { lender_id } = useLocalSearchParams<{ lender_id: string }>();
  const [profile, setProfile] = useState<LenderProfile | null>(null);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setMinutes(0, 0, 0);
  const dayAfter = new Date(tomorrow.getTime() + 86400000);

  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(dayAfter);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [message, setMessage] = useState('');

  // 台車をstation_idでグループ化
  const stations = useMemo(() => {
    const map = new Map<number | null, Cart[]>();
    for (const c of carts) {
      const key = c.station_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  }, [carts]);

  const totalSelected = useMemo(
    () => Object.values(quantities).reduce((a, b) => a + b, 0),
    [quantities]
  );

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, cartsRes] = await Promise.all([
          api.get<LenderProfile>(`/users/${lender_id}/profile`),
          api.get<Cart[]>('/carts', { params: { owner_id: lender_id } }),
        ]);
        setProfile(profileRes.data);
        setCarts(cartsRes.data);
      } catch {
        Alert.alert('エラー', '情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [lender_id]);

  const handleSubmit = async () => {
    if (totalSelected === 0) { Alert.alert('エラー', '台車を1台以上選択してください'); return; }
    if (endDate <= startDate) { Alert.alert('エラー', '返却希望日は貸出希望日より後にしてください'); return; }

    setSubmitting(true);
    try {
      const selected = Object.entries(quantities).filter(([, q]) => q > 0);
      await Promise.all(
        selected.map(([cartId, qty]) =>
          api.post('/rental-requests', {
            cart_id: Number(cartId),
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            quantity: qty,
            message: message.trim() || null,
          })
        )
      );
      Alert.alert('完了', 'リクエストを送信しました', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/reservations') },
      ]);
    } catch {
      Alert.alert('エラー', 'リクエストの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* 貸す人 */}
      <View style={s.lenderRow}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.lenderAvatar} />
        ) : (
          <View style={[s.lenderAvatar, s.lenderAvatarPlaceholder]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
              {(profile?.display_name ?? '?').charAt(0)}
            </Text>
          </View>
        )}
        <Text style={s.lenderName}>{profile?.display_name ?? '貸す人'}</Text>
      </View>

      {/* 日時 */}
      <View style={s.card}>
        <DateTimeField
          label="貸出希望日"
          value={startDate}
          onChange={setStartDate}
          minimumDate={tomorrow}
        />
        <View style={s.divider} />
        <DateTimeField
          label="返却希望日"
          value={endDate}
          onChange={setEndDate}
          minimumDate={new Date(startDate.getTime() + 3600000)}
        />
      </View>

      {/* 台車選択 */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>台車を選ぶ</Text>
        {totalSelected > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>合計 {totalSelected} 台選択中</Text>
          </View>
        )}
      </View>

      {stations.map(([stationId, stCarts]) => {
        const first = stCarts[0];
        return (
          <View key={stationId ?? 'none'} style={s.stationGroup}>
            {/* 貸出場所 */}
            <View style={s.stationHeader}>
              <Text style={s.stationName}>
                📍 {[first.municipality, first.station_name].filter(Boolean).join(' / ') || '場所未設定'}
              </Text>
              {first.lending_address ? (
                <Text style={s.stationAddress}>{first.lending_address}</Text>
              ) : null}
            </View>
            {stCarts.map((cart) => (
              <CartSelectRow
                key={cart.id}
                cart={cart}
                qty={quantities[cart.id] ?? 0}
                onChange={(v) => setQuantities((prev) => ({ ...prev, [cart.id]: v }))}
              />
            ))}
          </View>
        );
      })}

      {/* メッセージ */}
      <Text style={s.fieldLabel}>メッセージ（任意）</Text>
      <TextInput
        style={[s.input, s.textarea]}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        placeholder="貸す人さんへのメッセージがあれば入力してください"
        placeholderTextColor="#c4c4c4"
        textAlignVertical="top"
      />

      {/* 送信 */}
      <Pressable
        style={[s.submitBtn, (submitting || totalSelected === 0) && s.submitBtnOff]}
        onPress={handleSubmit}
        disabled={submitting || totalSelected === 0}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.submitBtnText}>
              リクエストを送信する{totalSelected > 0 ? `（${totalSelected}台）` : ''}
            </Text>
        }
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  lenderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  lenderAvatar: { width: 40, height: 40, borderRadius: 20 },
  lenderAvatarPlaceholder: { backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  lenderName: { fontSize: 15, fontWeight: '700', color: '#111827' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb', marginHorizontal: 16 },

  dtField: { padding: 14 },
  dtRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  dtBtn: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center',
  },
  dtBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5 },
  badge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#3b82f6' },

  stationGroup: { marginBottom: 12 },
  stationHeader: {
    backgroundColor: '#f3f4f6', borderRadius: 10, padding: 10, marginBottom: 6,
  },
  stationName: { fontSize: 13, fontWeight: '700', color: '#374151' },
  stationAddress: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  cartRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 10, marginBottom: 6, gap: 10,
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cartRowSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  cartThumb: { width: 56, height: 56, borderRadius: 8 },
  cartThumbPlaceholder: { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  cartRowInfo: { flex: 1 },
  cartRowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cartRowRate: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnDisabled: { borderColor: '#e5e7eb' },
  counterBtnText: { fontSize: 18, fontWeight: '700', color: '#3b82f6', lineHeight: 22 },
  counterVal: { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb',
    padding: 12, fontSize: 15, color: '#111827',
  },
  textarea: { height: 100, textAlignVertical: 'top' },

  submitBtn: {
    marginTop: 24, backgroundColor: '#3b82f6', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnOff: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
