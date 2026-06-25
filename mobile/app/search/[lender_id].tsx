import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Cart } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';

interface LenderProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  user_type: string;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name: string | null;
}

const RATING_LABEL = ['', '悪い', '普通', '良い'];
const RATING_COLOR = ['', '#ef4444', '#f59e0b', '#10b981'];
const CATEGORY_LABEL: Record<string, string> = {
  hand_truck: '手押し台車',
  flat_cart: '平台車',
  hand_dolly: 'ハンドトラック',
  outdoor_wagon: 'アウトドアワゴン',
  other: 'その他',
};

// ─── 質問するモーダル ──────────────────────────────────
function InquiryModal({
  visible, cartId, onClose,
}: { visible: boolean; cartId: string | null; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) { Alert.alert('エラー', 'メッセージを入力してください'); return; }
    if (!cartId) { Alert.alert('エラー', '台車が選択されていません'); return; }
    setSubmitting(true);
    try {
      const req = await api.post('/rental-requests', {
        cart_id: Number(cartId),
        message: message.trim(),
      });
      setMessage('');
      onClose();
      router.push(`/requests/${req.data.id}` as any);
    } catch (e: any) {
      Alert.alert('エラー', 'メッセージの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <Text style={m.title}>貸す人に質問する</Text>
        <Text style={m.sub}>台車の詳細や利用条件など、気になることを質問しましょう</Text>
        <TextInput
          style={m.input}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          placeholder="質問内容を入力してください"
          placeholderTextColor="#c4c4c4"
          textAlignVertical="top"
          autoFocus
        />
        <Pressable style={[m.btn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={m.btnText}>送信する</Text>}
        </Pressable>
        <Pressable style={m.cancel} onPress={onClose}>
          <Text style={m.cancelText}>キャンセル</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── 台車カード ────────────────────────────────────────
function CartCard({ cart }: { cart: Cart }) {
  const rate = cart.daily_rate != null ? `¥${cart.daily_rate.toLocaleString()} / 日`
    : cart.weekly_rate != null ? `¥${cart.weekly_rate.toLocaleString()} / 週`
    : `¥${(cart.per_rental_rate ?? 0).toLocaleString()} / 回`;

  return (
    <View style={s.cartCard}>
      {cart.image_urls.length > 0 && (
        <Image source={{ uri: cart.image_urls[0] }} style={s.cartImage} />
      )}
      <View style={s.cartBody}>
        <Text style={s.cartTitle}>{cart.title}</Text>
        {cart.category && (
          <Text style={s.cartCategory}>{CATEGORY_LABEL[cart.category] ?? cart.category}</Text>
        )}
        {cart.description ? <Text style={s.cartDesc} numberOfLines={2}>{cart.description}</Text> : null}
        <Text style={s.cartRate}>{rate}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <MaterialIcons name="inventory-2" size={12} color="#9ca3af" />
          <Text style={s.cartMeta}>{cart.quantity}台 {cart.foldable ? '・折りたたみ可' : ''}</Text>
        </View>
        {(cart.station_name || cart.lending_address) && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 3, marginTop: 2 }}>
            <MaterialIcons name="place" size={12} color="#9ca3af" style={{ marginTop: 2 }} />
            <Text style={s.cartMeta}>
              {[cart.municipality, cart.station_name].filter(Boolean).join(' / ')}
              {cart.lending_address ? `\n${cart.lending_address}` : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── メイン ────────────────────────────────────────────
export default function LenderDetail() {
  const { lender_id, cart_id } = useLocalSearchParams<{ lender_id: string; cart_id?: string }>();
  const [profile, setProfile] = useState<LenderProfile | null>(null);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [inquiryVisible, setInquiryVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, cartsRes, reviewsRes] = await Promise.all([
          api.get<LenderProfile>(`/users/${lender_id}/profile`),
          api.get<Cart[]>('/carts', { params: { owner_id: lender_id } }),
          api.get<Review[]>(`/users/${lender_id}/reviews`),
        ]);
        setProfile(profileRes.data);
        const allCarts: Cart[] = cartsRes.data;
        setCarts(cart_id ? allCarts.filter((c) => String(c.id) === cart_id) : allCarts);
        setReviews(reviewsRes.data);
      } catch {
        Alert.alert('エラー', '情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [lender_id, cart_id]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const ListHeader = (
    <View>
      {/* プロフィール */}
      <View style={s.profileCard}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder]}>
            <Text style={s.avatarInitial}>{(profile?.display_name ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.profileInfo}>
          <Text style={s.profileName}>{profile?.display_name ?? '貸す人'}</Text>
          {avgRating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="star" size={14} color="#f59e0b" />
              <Text style={s.profileRating}>{avgRating}（{reviews.length}件のレビュー）</Text>
            </View>
          )}
          {profile?.bio ? <Text style={s.profileBio}>{profile.bio}</Text> : null}
        </View>
      </View>

      {/* レビュー */}
      {reviews.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>レビュー</Text>
          {reviews.slice(0, 3).map((r) => (
            <View key={r.id} style={s.reviewCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MaterialIcons name="star" size={14} color={RATING_COLOR[r.rating]} />
                <Text style={s.reviewRating}>{RATING_LABEL[r.rating]}</Text>
              </View>
              {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
              <Text style={s.reviewAuthor}>{r.reviewer_name ?? '匿名'}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.sectionTitle} accessibilityRole="header">台車一覧</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        data={carts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => <CartCard cart={item} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={s.empty}><Text style={s.emptyText}>台車が登録されていません</Text></View>
        }
      />

      {/* 下部ボタン */}
      <View style={s.footer}>
        <Pressable
          style={[s.footerBtn, s.footerBtnOutline]}
          onPress={() => setInquiryVisible(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="chat-bubble-outline" size={16} color="#3b82f6" />
            <Text style={s.footerBtnOutlineText}>質問する</Text>
          </View>
        </Pressable>
        <Pressable
          style={[s.footerBtn, s.footerBtnPrimary]}
          onPress={() => router.push(`/request-new?lender_id=${lender_id}${cart_id ? `&cart_id=${cart_id}` : ''}` as any)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="shopping-cart" size={16} color="#fff" />
            <Text style={s.footerBtnPrimaryText}>借りたい</Text>
          </View>
        </Pressable>
      </View>

      <InquiryModal
        visible={inquiryVisible}
        cartId={cart_id ?? null}
        onClose={() => setInquiryVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  profileCard: {
    flexDirection: 'row', padding: 20, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb', gap: 16,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  profileRating: { fontSize: 14, color: '#f59e0b', fontWeight: '600' },
  profileBio: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginTop: 2 },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#6b7280',
    letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  reviewRating: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  reviewComment: { fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 18 },
  reviewAuthor: { fontSize: 12, color: '#9ca3af' },

  cartCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cartImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cartBody: { padding: 14, gap: 4 },
  cartTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cartCategory: { fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  cartDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  cartRate: { fontSize: 16, fontWeight: '700', color: '#3b82f6' },
  cartMeta: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  footerBtn: {
    flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  footerBtnOutline: { borderWidth: 2, borderColor: '#3b82f6', backgroundColor: '#fff' },
  footerBtnOutlineText: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },
  footerBtnPrimary: { backgroundColor: '#3b82f6' },
  footerBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const m = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  sub: { fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 18 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 14, fontSize: 15, height: 160, textAlignVertical: 'top',
    backgroundColor: '#fafafa', color: '#111827',
  },
  btn: {
    marginTop: 20, backgroundColor: '#3b82f6', borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancel: { marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, color: '#6b7280' },
});
