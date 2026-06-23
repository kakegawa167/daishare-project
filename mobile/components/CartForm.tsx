import { CartCategory, CartFormData } from '@/lib/types';
import { useEffect, useState } from 'react';
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
import { api } from '@/lib/api';

const CATEGORIES: { value: CartCategory; label: string; icon: string }[] = [
  { value: 'hand_truck',    label: '手押し台車',       icon: '🛒' },
  { value: 'flat_cart',     label: '平台車',           icon: '📦' },
  { value: 'hand_dolly',    label: 'ハンドトラック',   icon: '🔧' },
  { value: 'outdoor_wagon', label: 'アウトドアワゴン', icon: '🏕️' },
  { value: 'other',         label: 'その他',           icon: '⋯' },
];

interface Line { id: number; name: string; stations: Station[] }
interface Station { id: number; name: string; municipality: string }
interface Props {
  initialData: CartFormData;
  onSubmit: (data: CartFormData) => Promise<void>;
  submitLabel: string;
}
interface Errors {
  title?: string;
  price?: string;
  daily_rate?: string;
  weekly_rate?: string;
  per_rental_rate?: string;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{children}</Text>
    </View>
  );
}
function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {children}{required && <Text style={s.required}> *</Text>}
    </Text>
  );
}
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={s.errorText}>{msg}</Text>;
}
function NumericInput({ value, onChange, placeholder, unit }: {
  value: string; onChange: (v: string) => void; placeholder: string; unit?: string;
}) {
  return (
    <View style={s.numericRow}>
      <TextInput
        style={[s.input, s.numericInput]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="decimal-pad"
        returnKeyType="next"
      />
      {unit && <Text style={s.unit}>{unit}</Text>}
    </View>
  );
}

export default function CartForm({ initialData, onSubmit, submitLabel }: Props) {
  const [form, setForm] = useState<CartFormData>(initialData);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    api.get<Line[]>('/lines').then((r) => setLines(r.data)).catch(() => {});
  }, []);

  const set = <K extends keyof CartFormData>(key: K, val: CartFormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleLineSelect = (id: number) => {
    setSelectedLine(id);
    setStations(lines.find((l) => l.id === id)?.stations ?? []);
    set('station_id', null);
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.title.trim()) next.title = '台車名を入力してください';
    else if (form.title.length > 200) next.title = '200文字以内で入力してください';
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
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {/* 基本情報 */}
      <SectionHeader>基本情報</SectionHeader>

      <Label required>台車名</Label>
      <TextInput
        style={[s.input, errors.title && s.inputError]}
        value={form.title}
        onChangeText={(v) => { set('title', v); setErrors((e) => ({ ...e, title: undefined })); }}
        placeholder="例: 折りたたみ平台車（大）"
        maxLength={200}
        returnKeyType="next"
      />
      <FieldError msg={errors.title} />

      <Label>カテゴリ</Label>
      <View style={s.categoryGrid}>
        {CATEGORIES.map((c) => {
          const sel = form.category === c.value;
          return (
            <Pressable
              key={c.value}
              style={[s.categoryCard, sel && s.categoryCardSel]}
              onPress={() => set('category', sel ? null : c.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
            >
              <Text style={s.categoryIcon}>{c.icon}</Text>
              <Text style={[s.categoryLabel, sel && s.categoryLabelSel]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label>写真</Label>
      <View style={s.photoBox}>
        <Text style={s.photoIcon}>📷</Text>
        <Text style={s.photoText}>写真を追加</Text>
        <Text style={s.photoSub}>※ストレージ設定後に有効になります</Text>
      </View>

      {/* スペック */}
      <SectionHeader>スペック（任意）</SectionHeader>

      <View style={s.specGrid}>
        <View style={s.specItem}>
          <Label>重量</Label>
          <NumericInput value={form.weight_kg} onChange={(v) => set('weight_kg', v)} placeholder="10" unit="kg" />
        </View>
        <View style={s.specItem}>
          <Label>耐荷重</Label>
          <NumericInput value={form.max_load_kg} onChange={(v) => set('max_load_kg', v)} placeholder="100" unit="kg" />
        </View>
        <View style={s.specItem}>
          <Label>横サイズ</Label>
          <NumericInput value={form.width_cm} onChange={(v) => set('width_cm', v)} placeholder="60" unit="cm" />
        </View>
        <View style={s.specItem}>
          <Label>縦サイズ</Label>
          <NumericInput value={form.length_cm} onChange={(v) => set('length_cm', v)} placeholder="90" unit="cm" />
        </View>
      </View>

      <View style={s.toggleRow}>
        <View style={s.toggleLeft}>
          <Text style={s.toggleLabel}>折りたたみ可能</Text>
          <Text style={s.toggleSub}>収納・運搬がしやすくなります</Text>
        </View>
        <Switch
          value={form.foldable}
          onValueChange={(v) => set('foldable', v)}
          trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
          thumbColor={form.foldable ? '#3b82f6' : '#fff'}
        />
      </View>

      {/* 価格設定 */}
      <SectionHeader>
        {'価格設定 '}
        <Text style={s.sectionNote}>（いずれか必須）</Text>
      </SectionHeader>

      {errors.price && (
        <View style={s.priceErrBox}>
          <Text style={s.priceErrText}>⚠️ {errors.price}</Text>
        </View>
      )}

      <View style={s.priceGrid}>
        <View style={s.priceHalf}>
          <Label>日額</Label>
          <NumericInput
            value={form.daily_rate}
            onChange={(v) => { set('daily_rate', v); setErrors((e) => ({ ...e, price: undefined, daily_rate: undefined })); }}
            placeholder="500"
            unit="円/日"
          />
          <FieldError msg={errors.daily_rate} />
        </View>
        <View style={s.priceHalf}>
          <Label>週額</Label>
          <NumericInput
            value={form.weekly_rate}
            onChange={(v) => { set('weekly_rate', v); setErrors((e) => ({ ...e, price: undefined, weekly_rate: undefined })); }}
            placeholder="2500"
            unit="円/週"
          />
          <FieldError msg={errors.weekly_rate} />
        </View>
        <View style={s.priceFull}>
          <Label>1レンタル</Label>
          <NumericInput
            value={form.per_rental_rate}
            onChange={(v) => { set('per_rental_rate', v); setErrors((e) => ({ ...e, price: undefined, per_rental_rate: undefined })); }}
            placeholder="1000"
            unit="円/回"
          />
          <FieldError msg={errors.per_rental_rate} />
        </View>
      </View>

      {/* 備考 */}
      <SectionHeader>備考（任意）</SectionHeader>

      <TextInput
        style={[s.input, s.textarea]}
        value={form.description}
        onChangeText={(v) => set('description', v)}
        placeholder="台車の状態・特徴・注意点など"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* 場所 */}
      <SectionHeader>貸出場所（任意）</SectionHeader>

      {lines.length > 0 && (
        <>
          <Label>路線</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            {lines.map((l) => {
              const sel = selectedLine === l.id;
              return (
                <Pressable key={l.id} style={[s.chip, sel && s.chipSel]} onPress={() => handleLineSelect(l.id)}>
                  <Text style={[s.chipText, sel && s.chipTextSel]}>{l.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
      {stations.length > 0 && (
        <>
          <Label>駅</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            {stations.map((st) => {
              const sel = form.station_id === st.id;
              return (
                <Pressable key={st.id} style={[s.chip, sel && s.chipSel]} onPress={() => set('station_id', st.id)}
                  accessibilityState={{ selected: sel }}>
                  <Text style={[s.chipText, sel && s.chipTextSel]}>{st.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* 送信 */}
      <Pressable style={[s.submitBtn, submitting && s.submitBtnOff]} onPress={handleSubmit} disabled={submitting}>
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.submitBtnText}>{submitLabel}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { paddingBottom: 80 },

  sectionHeader: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5 },
  sectionNote: { fontSize: 12, color: '#ef4444', fontWeight: '500' },

  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14, paddingHorizontal: 20 },
  required: { color: '#ef4444' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12,
    fontSize: 15, backgroundColor: '#fff', minHeight: 48, marginHorizontal: 20,
  },
  inputError: { borderColor: '#ef4444', borderWidth: 1.5 },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 3, marginLeft: 22 },
  textarea: { height: 100, textAlignVertical: 'top' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  categoryCard: {
    width: '30%', alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  categoryCardSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textAlign: 'center' },
  categoryLabelSel: { color: '#3b82f6' },

  photoBox: {
    marginHorizontal: 20, height: 110, borderRadius: 12, borderWidth: 2,
    borderColor: '#d1d5db', borderStyle: 'dashed', alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#f9fafb',
  },
  photoIcon: { fontSize: 28, marginBottom: 4 },
  photoText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  photoSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  specGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  specItem: { width: '50%', paddingHorizontal: 4 },
  numericRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  numericInput: { flex: 1, marginHorizontal: 0 },
  unit: { fontSize: 13, color: '#6b7280', marginLeft: 6, minWidth: 38 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginTop: 14, padding: 14, backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  toggleLeft: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  toggleSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  priceErrBox: {
    marginHorizontal: 20, marginTop: 8, padding: 10,
    backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca',
  },
  priceErrText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  priceHalf: { width: '50%', paddingHorizontal: 4 },
  priceFull: { width: '100%', paddingHorizontal: 4 },

  chipScroll: { paddingLeft: 20, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1,
    borderColor: '#d1d5db', marginRight: 8, backgroundColor: '#fff', minHeight: 44, justifyContent: 'center',
  },
  chipSel: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextSel: { color: '#fff' },

  submitBtn: {
    marginHorizontal: 20, marginTop: 32, backgroundColor: '#3b82f6',
    padding: 16, borderRadius: 12, alignItems: 'center', minHeight: 54, justifyContent: 'center',
  },
  submitBtnOff: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
