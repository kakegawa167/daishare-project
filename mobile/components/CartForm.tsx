import { CartCategory, CartFormData } from '@/lib/types';
import { api } from '@/lib/api';
import { useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StationPicker } from '@/components/StationPicker';

// ─── カテゴリ ─────────────────────────────────
const CATEGORIES: { value: CartCategory; label: string }[] = [
  { value: 'hand_truck',    label: '手押し台車' },
  { value: 'flat_cart',     label: '平台車' },
  { value: 'hand_dolly',    label: 'ハンドトラック' },
  { value: 'outdoor_wagon', label: 'アウトドアワゴン' },
  { value: 'other',         label: 'その他' },
];

// ─── 型 ──────────────────────────────────────
interface StationInfo { id: number; name: string; municipality: string; line_id: number }
interface Props {
  initialData: CartFormData;
  onSubmit: (data: CartFormData) => Promise<void>;
  submitLabel: string;
}
interface Errors {
  title?: string;
  category?: string;
  station_id?: string;
  price?: string;
  daily_rate?: string;
  weekly_rate?: string;
  per_rental_rate?: string;
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

// ─── メイン ───────────────────────────────────
export default function CartForm({ initialData, onSubmit, submitLabel }: Props) {
  const [form, setForm] = useState<CartFormData>(initialData);
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof CartFormData>(k: K, v: CartFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const clr = (...keys: (keyof Errors)[]) =>
    setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });

  const handleStationSelect = (st: StationInfo) => {
    set('station_id', st.id);
    setStationInfo(st);
    clr('station_id');
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.title.trim()) next.title = '台車名を入力してください';
    else if (form.title.length > 200) next.title = '200文字以内で入力してください';
    if (!form.category) next.category = 'カテゴリを選択してください';
    if (!form.station_id) next.station_id = '路線と駅を選択してください';
    if (!form.daily_rate && !form.weekly_rate && !form.per_rental_rate)
      next.price = '日額・週額・1レンタルのいずれかを入力してください';
    if (form.daily_rate && Number(form.daily_rate) <= 0) next.daily_rate = '正の数値を入力してください';
    if (form.weekly_rate && Number(form.weekly_rate) <= 0) next.weekly_rate = '正の数値を入力してください';
    if (form.per_rental_rate && Number(form.per_rental_rate) <= 0) next.per_rental_rate = '正の数値を入力してください';
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

        <FieldLabel>写真</FieldLabel>
        <Pressable style={s.photoBtn} disabled>
          <Text style={s.photoBtnIcon}>＋</Text>
          <Text style={s.photoBtnText}>写真を追加</Text>
          <Text style={s.photoBtnSub}>準備中</Text>
        </Pressable>
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

      {/* ── 貸出場所 ── */}
      <SectionTitle icon="📍" label="貸出場所" />
      <Card>
        <FieldLabel required>路線 / 駅</FieldLabel>
        <Pressable
          style={[s.stationBtn, errors.station_id && s.stationBtnErr]}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="路線と駅を選択"
        >
          {stationInfo ? (
            <View style={s.stationSelected}>
              <Text style={s.stationName}>{stationInfo.name}駅</Text>
              <Text style={s.stationMeta}>{stationInfo.municipality}</Text>
            </View>
          ) : (
            <Text style={s.stationPlaceholder}>路線・駅を選択する</Text>
          )}
          <Text style={s.stationArrow}>›</Text>
        </Pressable>
        <Err msg={errors.station_id} />

        <View style={s.divider} />

        <FieldLabel>貸出場所の詳細</FieldLabel>
        <TextIn
          value={form.lending_address}
          onChange={(v) => set('lending_address', v)}
          placeholder="例: 南口から徒歩3分、○○倉庫前"
        />
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
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleStationSelect}
        currentStationId={form.station_id}
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

  // セクションタイトル
  secTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 24 },
  secIcon: { fontSize: 18 },
  secLabel: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  secNotePill: {
    backgroundColor: '#fef3c7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  secNoteText: { fontSize: 11, fontWeight: '600', color: '#d97706' },

  // カード
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // フィールド
  fLabel: { fontSize: 13, fontWeight: '600', color: GRAY, marginBottom: 8, marginTop: 4 },
  req: { color: '#ef4444' },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 14 },

  // エラー
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  errIcon: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444',
    color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 16,
  },
  errMsg: { fontSize: 12, color: '#ef4444', flex: 1 },

  // テキスト入力
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
    backgroundColor: '#fafafa', color: '#111827',
  },
  textarea: { height: 100, textAlignVertical: 'top' },

  // カテゴリ
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  catChipSel: { borderColor: BLUE, backgroundColor: BLUE_LIGHT },
  catText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  catTextSel: { color: BLUE },

  // 写真
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#e5e7eb', borderStyle: 'dashed', backgroundColor: '#fafafa',
  },
  photoBtnIcon: { fontSize: 22, color: '#d1d5db', fontWeight: '300' },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#9ca3af', flex: 1 },
  photoBtnSub: {
    fontSize: 11, color: '#d1d5db', backgroundColor: '#f3f4f6',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },

  // スペック
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  specCell: { width: '50%', paddingHorizontal: 6 },
  numWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numIn: { flex: 1 },
  unit: { fontSize: 12, color: GRAY, minWidth: 36 },

  // トグル
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#9ca3af' },

  // 価格
  priceAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 10, backgroundColor: '#fef2f2', borderRadius: 8,
    borderWidth: 1, borderColor: '#fecaca', marginBottom: 12,
  },
  priceAlertText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  priceRow: { flexDirection: 'row', gap: 0 },
  priceCell: { flex: 1 },
  priceDividerV: { width: 1, backgroundColor: BORDER, marginHorizontal: 12, marginTop: 28 },

  // 駅選択
  stationBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fafafa',
  },
  stationBtnErr: { borderColor: '#ef4444' },
  stationSelected: { flex: 1 },
  stationName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  stationMeta: { fontSize: 12, color: GRAY, marginTop: 1 },
  stationPlaceholder: { flex: 1, fontSize: 15, color: '#c4c4c4' },
  stationArrow: { fontSize: 20, color: '#d1d5db', marginLeft: 8 },

  // 送信
  submitBtn: {
    marginTop: 32, backgroundColor: BLUE, borderRadius: 14,
    padding: 17, alignItems: 'center', justifyContent: 'center',
    shadowColor: BLUE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitOff: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
