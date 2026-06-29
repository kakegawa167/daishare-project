import { CartCategory, CartFormData, LocationFormItem } from '@/lib/types';
import { useCallback, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { StationPicker } from '@/components/StationPicker';

// ─── カテゴリ ─────────────────────────────────
const CATEGORIES: { value: CartCategory; label: string }[] = [
  { value: 'hand_truck',    label: '手押し台車' },
  { value: 'flat_cart',     label: '平台車' },
  { value: 'hand_dolly',    label: 'ハンドトラック' },
  { value: 'outdoor_wagon', label: 'アウトドアワゴン' },
  { value: 'other',         label: 'その他' },
];

interface Props {
  initialData: CartFormData;
  onSubmit: (data: CartFormData) => Promise<void>;
  submitLabel: string;
}
interface Errors {
  title?: string;
  category?: string;
  quantity?: string;
  price?: string;
  daily_rate?: string;
  weekly_rate?: string;
  per_rental_rate?: string;
  locations?: string;
}

// ─── サブコンポーネント ───────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
function SectionTitle({ icon, label, note }: { icon: string; label: string; note?: string }) {
  return (
    <View style={s.secTitle}>
      <Text style={s.secIcon}>{icon}</Text>
      <Text style={s.secLabel}>{label}</Text>
      {note && <View style={s.secNotePill}><Text style={s.secNoteText}>{note}</Text></View>}
    </View>
  );
}
function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={s.fLabel}>
      {children}{required && <Text style={s.req}> *</Text>}
    </Text>
  );
}
function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={s.errRow}>
      <Text style={s.errIcon}>!</Text>
      <Text style={s.errMsg}>{msg}</Text>
    </View>
  );
}
function TextIn({ value, onChange, placeholder, multiline }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[s.input, multiline && s.textarea]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#c4c4c4"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      returnKeyType={multiline ? 'default' : 'next'}
    />
  );
}
function NumIn({ value, onChange, placeholder, unit }: {
  value: string; onChange: (v: string) => void; placeholder: string; unit: string;
}) {
  return (
    <View style={s.numWrap}>
      <TextInput
        style={[s.input, s.numIn]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#c4c4c4"
        keyboardType="decimal-pad"
        returnKeyType="next"
      />
      <Text style={s.unit}>{unit}</Text>
    </View>
  );
}

// ─── 在庫カウンター ────────────────────────────
function QuantityCounter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = parseInt(value, 10) || 1;
  return (
    <View style={s.qtyRow}>
      <Pressable
        style={[s.qtyBtn, n <= 1 && s.qtyBtnDisabled]}
        onPress={() => onChange(String(Math.max(1, n - 1)))}
        disabled={n <= 1}
      >
        <Text style={[s.qtyBtnText, n <= 1 && { color: '#d1d5db' }]}>－</Text>
      </Pressable>
      <TextInput
        style={s.qtyInput}
        value={value}
        onChangeText={(v) => { const num = parseInt(v, 10); if (!isNaN(num) && num >= 1) onChange(String(num)); else if (v === '') onChange('1'); }}
        keyboardType="number-pad"
        textAlign="center"
      />
      <Pressable style={s.qtyBtn} onPress={() => onChange(String(n + 1))}>
        <Text style={s.qtyBtnText}>＋</Text>
      </Pressable>
      <Text style={s.unit}>台</Text>
    </View>
  );
}

// ─── 貸出場所1行 ───────────────────────────────
function LocationRow({
  loc, index, total, onUpdate, onRemove, onPickStation,
}: {
  loc: LocationFormItem;
  index: number;
  total: number;
  onUpdate: (key: keyof LocationFormItem, value: string) => void;
  onRemove: () => void;
  onPickStation: () => void;
}) {
  return (
    <View style={[s.locRow, index > 0 && s.locRowBorder]}>
      <View style={s.locHeader}>
        <Text style={s.locIndex}>場所 {index + 1}</Text>
        {total > 1 && (
          <Pressable onPress={onRemove} style={s.locRemoveBtn}>
            <Text style={s.locRemoveText}>削除</Text>
          </Pressable>
        )}
      </View>

      {/* 駅選択 */}
      <FieldLabel required={index === 0}>路線 / 駅</FieldLabel>
      <Pressable style={s.stationBtn} onPress={onPickStation}>
        {loc.station_id ? (
          <View style={s.stationSelected}>
            <Text style={s.stationName}>{loc.station_name}駅</Text>
            <Text style={s.stationMeta}>{loc.municipality}</Text>
          </View>
        ) : (
          <Text style={s.stationPlaceholder}>路線・駅を選択する</Text>
        )}
        <Text style={s.stationArrow}>›</Text>
      </Pressable>

      {/* 詳細住所 */}
      <FieldLabel>詳細住所（任意）</FieldLabel>
      <TextIn
        value={loc.lending_address}
        onChange={(v) => onUpdate('lending_address', v)}
        placeholder="例: 南口から徒歩3分、○○倉庫前"
      />
    </View>
  );
}

// ─── 画像アップロード ──────────────────────────
async function uploadCartImage(uri: string, userId: string): Promise<string> {
  // expo-image-picker は quality を指定すると必ず file:// URI を返す
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpeg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpeg';
  const contentType = `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`;
  const path = `carts/${userId}/${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from('cart-images').upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('cart-images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── メイン ───────────────────────────────────
export default function CartForm({ initialData, onSubmit, submitLabel }: Props) {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState<CartFormData>(initialData);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof CartFormData>(k: K, v: CartFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const clr = (...keys: (keyof Errors)[]) =>
    setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });

  // ── 貸出場所操作 ────────────────────────────
  const addLocation = useCallback(() => {
    setForm((f) => ({
      ...f,
      locations: [...f.locations, { station_id: null, station_name: null, municipality: null, lending_address: '' }],
    }));
  }, []);

  const removeLocation = useCallback((index: number) => {
    setForm((f) => ({ ...f, locations: f.locations.filter((_, i) => i !== index) }));
  }, []);

  const updateLocation = useCallback((index: number, key: keyof LocationFormItem, value: string) => {
    setForm((f) => {
      const next = [...f.locations];
      next[index] = { ...next[index], [key]: value };
      return { ...f, locations: next };
    });
  }, []);

  const handleStationSelect = useCallback((st: { id: number; name: string; municipality: string }) => {
    if (pickerTargetIndex === null) return;
    setForm((f) => {
      const next = [...f.locations];
      next[pickerTargetIndex] = { ...next[pickerTargetIndex], station_id: st.id, station_name: st.name, municipality: st.municipality };
      return { ...f, locations: next };
    });
    clr('locations');
    setPickerTargetIndex(null);
  }, [pickerTargetIndex]);

  // ── 画像選択・アップロード ──────────────────
  const handleAddImage = useCallback(async () => {
    if (!user) return;
    try {
      let ImagePicker: any;
      try {
        ImagePicker = await import('expo-image-picker');
      } catch {
        Alert.alert('非対応', '写真機能はDev Buildが必要です。\n`npx expo run:ios --device` でiPhoneにインストールしてください。');
        return;
      }
      if (typeof ImagePicker?.requestMediaLibraryPermissionsAsync !== 'function') {
        Alert.alert('非対応', '写真機能はDev Buildが必要です。\n`npx expo run:ios --device` でiPhoneにインストールしてください。');
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('許可が必要です', '写真へのアクセスを許可してください');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,   // quality 指定で file:// URI が返る（ph:// にならない）
        selectionLimit: 5,
      });
      if (result.canceled) return;
      setUploadingImage(true);
      const urls: string[] = [];
      for (const asset of result.assets) {
        const url = await uploadCartImage(asset.uri, user.id);
        urls.push(url);
      }
      setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...urls].slice(0, 5) }));
    } catch (e: any) {
      const msg = e?.message ?? e?.error?.message ?? String(e);
      console.error('image upload error:', msg, e);
      Alert.alert('エラー', `写真のアップロードに失敗しました\n${msg}`);
    } finally {
      setUploadingImage(false);
    }
  }, [user]);

  const handleRemoveImage = useCallback((index: number) => {
    setForm((f) => ({ ...f, image_urls: f.image_urls.filter((_, i) => i !== index) }));
  }, []);

  // ── バリデーション ──────────────────────────
  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.title.trim()) next.title = '台車名を入力してください';
    else if (form.title.length > 200) next.title = '200文字以内で入力してください';
    if (!form.category) next.category = 'カテゴリを選択してください';
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty < 1) next.quantity = '台数は1以上を入力してください';
    if (!form.daily_rate && !form.weekly_rate && !form.per_rental_rate)
      next.price = '日額・週額・1レンタルのいずれかを入力してください';
    if (form.daily_rate && Number(form.daily_rate) <= 0) next.daily_rate = '正の数値を入力してください';
    if (form.weekly_rate && Number(form.weekly_rate) <= 0) next.weekly_rate = '正の数値を入力してください';
    if (form.per_rental_rate && Number(form.per_rental_rate) <= 0) next.per_rental_rate = '正の数値を入力してください';
    if (form.locations.length === 0 || !form.locations[0].station_id)
      next.locations = '貸出場所（路線/駅）を1つ以上選択してください';
    setErrors(next);
    if (Object.keys(next).length) AccessibilityInfo.announceForAccessibility(Object.values(next)[0]);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try { await onSubmit(form); } finally { setSubmitting(false); }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {/* ── 基本情報 ── */}
      <SectionTitle icon="📋" label="基本情報" />
      <Card>
        <FieldLabel required>台車名</FieldLabel>
        <TextIn
          value={form.title}
          onChange={(v) => { set('title', v); clr('title'); }}
          placeholder="例: 折りたたみ平台車（大）"
        />
        <Err msg={errors.title} />

        <View style={s.divider} />

        <FieldLabel required>カテゴリ</FieldLabel>
        <View style={s.catWrap}>
          {CATEGORIES.map((c) => {
            const sel = form.category === c.value;
            return (
              <Pressable
                key={c.value}
                style={[s.catChip, sel && s.catChipSel]}
                onPress={() => { set('category', sel ? null : c.value); clr('category'); }}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[s.catText, sel && s.catTextSel]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Err msg={errors.category} />

        <View style={s.divider} />

        <FieldLabel required>台数（在庫数）</FieldLabel>
        <QuantityCounter value={form.quantity} onChange={(v) => { set('quantity', v); clr('quantity'); }} />
        <Err msg={errors.quantity} />

        <View style={s.divider} />

        <FieldLabel>写真（最大5枚）</FieldLabel>
        <View style={s.photoGrid}>
          {form.image_urls.map((url, i) => (
            <View key={i} style={s.photoThumbWrap}>
              <Image source={{ uri: url }} style={s.photoThumb} />
              <Pressable style={s.photoRemove} onPress={() => handleRemoveImage(i)}>
                <MaterialIcons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          {form.image_urls.length < 5 && (
            <Pressable
              style={s.photoAddBtn}
              onPress={handleAddImage}
              disabled={uploadingImage}
            >
              {uploadingImage
                ? <ActivityIndicator size="small" color="#9ca3af" />
                : <MaterialIcons name="add-photo-alternate" size={28} color="#9ca3af" />
              }
            </Pressable>
          )}
        </View>
      </Card>

      {/* ── スペック ── */}
      <SectionTitle icon="📐" label="スペック" note="任意" />
      <Card>
        <View style={s.specGrid}>
          <View style={s.specCell}>
            <FieldLabel>重量</FieldLabel>
            <NumIn value={form.weight_kg} onChange={(v) => set('weight_kg', v)} placeholder="10.0" unit="kg" />
          </View>
          <View style={s.specCell}>
            <FieldLabel>耐荷重</FieldLabel>
            <NumIn value={form.max_load_kg} onChange={(v) => set('max_load_kg', v)} placeholder="100" unit="kg" />
          </View>
          <View style={s.specCell}>
            <FieldLabel>横サイズ</FieldLabel>
            <NumIn value={form.width_cm} onChange={(v) => set('width_cm', v)} placeholder="60" unit="cm" />
          </View>
          <View style={s.specCell}>
            <FieldLabel>縦サイズ</FieldLabel>
            <NumIn value={form.length_cm} onChange={(v) => set('length_cm', v)} placeholder="90" unit="cm" />
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.toggleRow}>
          <View>
            <Text style={s.toggleLabel}>折りたたみ可能</Text>
            <Text style={s.toggleSub}>収納・運搬がしやすくなります</Text>
          </View>
          <Switch
            value={form.foldable}
            onValueChange={(v) => set('foldable', v)}
            trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
            thumbColor={form.foldable ? '#3b82f6' : '#fff'}
            ios_backgroundColor="#e5e7eb"
          />
        </View>
      </Card>

      {/* ── 価格 ── */}
      <SectionTitle icon="💴" label="価格" note="いずれか必須" />
      <Card>
        {errors.price && (
          <View style={s.priceAlert}>
            <Text style={s.priceAlertText}>⚠️ {errors.price}</Text>
          </View>
        )}
        <View style={s.priceRow}>
          <View style={s.priceCell}>
            <FieldLabel>日額</FieldLabel>
            <NumIn
              value={form.daily_rate}
              onChange={(v) => { set('daily_rate', v); clr('price', 'daily_rate'); }}
              placeholder="500"
              unit="円/日"
            />
            <Err msg={errors.daily_rate} />
          </View>
          <View style={s.priceDividerV} />
          <View style={s.priceCell}>
            <FieldLabel>週額</FieldLabel>
            <NumIn
              value={form.weekly_rate}
              onChange={(v) => { set('weekly_rate', v); clr('price', 'weekly_rate'); }}
              placeholder="2500"
              unit="円/週"
            />
            <Err msg={errors.weekly_rate} />
          </View>
        </View>
        <View style={s.divider} />
        <FieldLabel>1レンタル</FieldLabel>
        <NumIn
          value={form.per_rental_rate}
          onChange={(v) => { set('per_rental_rate', v); clr('price', 'per_rental_rate'); }}
          placeholder="1000"
          unit="円/回"
        />
        <Err msg={errors.per_rental_rate} />
      </Card>

      {/* ── 貸出場所（複数）── */}
      <SectionTitle icon="📍" label="貸出場所" />
      <Card>
        <Err msg={errors.locations} />
        {form.locations.map((loc, i) => (
          <LocationRow
            key={i}
            loc={loc}
            index={i}
            total={form.locations.length}
            onUpdate={(key, v) => updateLocation(i, key, v)}
            onRemove={() => removeLocation(i)}
            onPickStation={() => setPickerTargetIndex(i)}
          />
        ))}
        <Pressable style={s.addLocBtn} onPress={addLocation}>
          <Text style={s.addLocText}>＋ 貸出場所を追加</Text>
        </Pressable>
      </Card>

      {/* ── 備考 ── */}
      <SectionTitle icon="📝" label="備考" note="任意" />
      <Card>
        <TextIn
          value={form.description}
          onChange={(v) => set('description', v)}
          placeholder="台車の状態・特徴・注意点など自由に記載してください"
          multiline
        />
      </Card>

      {/* 送信ボタン */}
      <Pressable
        style={[s.submitBtn, submitting && s.submitOff]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.submitText}>{submitLabel}</Text>}
      </Pressable>

      {/* 駅選択モーダル */}
      <StationPicker
        visible={pickerTargetIndex !== null}
        onClose={() => setPickerTargetIndex(null)}
        onSelect={handleStationSelect}
        currentStationId={pickerTargetIndex !== null ? form.locations[pickerTargetIndex]?.station_id : null}
      />
    </ScrollView>
  );
}

// ─── スタイル ─────────────────────────────────
const BLUE = '#3b82f6';
const BLUE_LIGHT = '#eff6ff';
const GRAY = '#6b7280';
const BORDER = '#f0f0f0';

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f6f8' },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  secTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 24 },
  secIcon: { fontSize: 18 },
  secLabel: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  secNotePill: { backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  secNoteText: { fontSize: 11, fontWeight: '600', color: '#d97706' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  fLabel: { fontSize: 13, fontWeight: '600', color: GRAY, marginBottom: 8, marginTop: 4 },
  req: { color: '#ef4444' },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },

  errRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  errIcon: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444',
    color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 16,
  },
  errMsg: { fontSize: 12, color: '#ef4444', flex: 1 },

  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
    backgroundColor: '#fafafa', color: '#111827',
  },
  textarea: { height: 100, textAlignVertical: 'top' },

  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fafafa',
  },
  catChipSel: { borderColor: BLUE, backgroundColor: BLUE_LIGHT },
  catText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  catTextSel: { color: BLUE },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumbWrap: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  photoThumb: { width: 80, height: 80 },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoAddBtn: {
    width: 80, height: 80, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderStyle: 'dashed',
    backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center',
  },

  // 在庫数カウンター
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnDisabled: { borderColor: '#e5e7eb' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: BLUE, lineHeight: 22 },
  qtyInput: {
    width: 56, height: 36, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    fontSize: 16, fontWeight: '700', color: '#111827',
    backgroundColor: '#fafafa',
  },

  specGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  specCell: { width: '50%', paddingHorizontal: 6 },
  numWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numIn: { flex: 1 },
  unit: { fontSize: 12, color: GRAY, minWidth: 36 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#9ca3af' },

  priceAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10,
    backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', marginBottom: 12,
  },
  priceAlertText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  priceRow: { flexDirection: 'row', gap: 0 },
  priceCell: { flex: 1 },
  priceDividerV: { width: 1, backgroundColor: BORDER, marginHorizontal: 12, marginTop: 28 },

  // 貸出場所
  locRow: { paddingTop: 4 },
  locRowBorder: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 14, paddingTop: 14 },
  locHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  locIndex: { fontSize: 13, fontWeight: '700', color: '#374151' },
  locRemoveBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#fee2e2' },
  locRemoveText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },

  addLocBtn: {
    marginTop: 14, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1.5,
    borderColor: BLUE, borderStyle: 'dashed',
    alignItems: 'center',
  },
  addLocText: { fontSize: 14, fontWeight: '700', color: BLUE },

  stationBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fafafa',
  },
  stationSelected: { flex: 1 },
  stationName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  stationMeta: { fontSize: 12, color: GRAY, marginTop: 1 },
  stationPlaceholder: { flex: 1, fontSize: 15, color: '#c4c4c4' },
  stationArrow: { fontSize: 20, color: '#d1d5db', marginLeft: 8 },

  submitBtn: {
    marginTop: 32, backgroundColor: BLUE, borderRadius: 14,
    padding: 17, alignItems: 'center', justifyContent: 'center',
    shadowColor: BLUE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitOff: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
