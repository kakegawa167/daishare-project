import { CartCategory, CartFormData } from '@/lib/types';
import { api } from '@/lib/api';
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

// ─── カテゴリ ────────────────────────────────
const CATEGORIES: { value: CartCategory; label: string }[] = [
  { value: 'hand_truck',    label: '手押し台車' },
  { value: 'flat_cart',     label: '平台車' },
  { value: 'hand_dolly',    label: 'ハンドトラック' },
  { value: 'outdoor_wagon', label: 'アウトドアワゴン' },
  { value: 'other',         label: 'その他' },
];

// ─── 型 ──────────────────────────────────────
interface Line { id: number; name: string; stations: Station[] }
interface Station { id: number; name: string; municipality: string }
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

// ─── 小コンポーネント ─────────────────────────
function Section({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionLabel}>{label}</Text>
        {note && <Text style={s.sectionNote}>{note}</Text>}
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}
function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}{required && <Text style={s.req}> *</Text>}</Text>
      {children}
      {error && <Text style={s.errText}>{error}</Text>}
    </View>
  );
}
function Inp({ value, onChange, placeholder, multiline, keyboardType }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <TextInput
      style={[s.input, multiline && s.textarea]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType ?? 'default'}
      returnKeyType={multiline ? 'default' : 'next'}
    />
  );
}
function NumRow({ value, onChange, placeholder, unit }: {
  value: string; onChange: (v: string) => void; placeholder: string; unit: string;
}) {
  return (
    <View style={s.numRow}>
      <TextInput
        style={[s.input, s.numInput]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType="decimal-pad"
        returnKeyType="next"
      />
      <Text style={s.unit}>{unit}</Text>
    </View>
  );
}

// ─── メインフォーム ───────────────────────────
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
  const clearErr = (...keys: (keyof Errors)[]) =>
    setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });

  const handleLineSelect = (id: number) => {
    setSelectedLine(id);
    setStations(lines.find((l) => l.id === id)?.stations ?? []);
    set('station_id', null);
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
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {/* ── 基本情報 ── */}
      <Section label="基本情報">
        <Field label="台車名" required error={errors.title}>
          <Inp
            value={form.title}
            onChange={(v) => { set('title', v); clearErr('title'); }}
            placeholder="例: 折りたたみ平台車（大）"
          />
        </Field>

        <Field label="カテゴリ" required error={errors.category}>
          <View style={s.categoryRow}>
            {CATEGORIES.map((c) => {
              const sel = form.category === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[s.catChip, sel && s.catChipSel]}
                  onPress={() => { set('category', sel ? null : c.value); clearErr('category'); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                >
                  <Text style={[s.catText, sel && s.catTextSel]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="写真">
          <View style={s.photoBox}>
            <Text style={s.photoIcon}>📷</Text>
            <Text style={s.photoText}>写真を追加（準備中）</Text>
          </View>
        </Field>
      </Section>

      {/* ── スペック ── */}
      <Section label="スペック" note="任意">
        <View style={s.specGrid}>
          <View style={s.specHalf}>
            <Field label="重量">
              <NumRow value={form.weight_kg} onChange={(v) => set('weight_kg', v)} placeholder="10" unit="kg" />
            </Field>
          </View>
          <View style={s.specHalf}>
            <Field label="耐荷重">
              <NumRow value={form.max_load_kg} onChange={(v) => set('max_load_kg', v)} placeholder="100" unit="kg" />
            </Field>
          </View>
          <View style={s.specHalf}>
            <Field label="横サイズ">
              <NumRow value={form.width_cm} onChange={(v) => set('width_cm', v)} placeholder="60" unit="cm" />
            </Field>
          </View>
          <View style={s.specHalf}>
            <Field label="縦サイズ">
              <NumRow value={form.length_cm} onChange={(v) => set('length_cm', v)} placeholder="90" unit="cm" />
            </Field>
          </View>
        </View>

        <View style={s.toggleRow}>
          <View>
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
      </Section>

      {/* ── 価格 ── */}
      <Section label="価格" note="いずれか必須">
        {errors.price && (
          <View style={s.priceErrBox}>
            <Text style={s.priceErrText}>⚠️ {errors.price}</Text>
          </View>
        )}
        <View style={s.priceGrid}>
          <View style={s.priceHalf}>
            <Field label="日額" error={errors.daily_rate}>
              <NumRow
                value={form.daily_rate}
                onChange={(v) => { set('daily_rate', v); clearErr('price', 'daily_rate'); }}
                placeholder="500"
                unit="円/日"
              />
            </Field>
          </View>
          <View style={s.priceHalf}>
            <Field label="週額" error={errors.weekly_rate}>
              <NumRow
                value={form.weekly_rate}
                onChange={(v) => { set('weekly_rate', v); clearErr('price', 'weekly_rate'); }}
                placeholder="2500"
                unit="円/週"
              />
            </Field>
          </View>
          <View style={s.priceFull}>
            <Field label="1レンタル" error={errors.per_rental_rate}>
              <NumRow
                value={form.per_rental_rate}
                onChange={(v) => { set('per_rental_rate', v); clearErr('price', 'per_rental_rate'); }}
                placeholder="1000"
                unit="円/回"
              />
            </Field>
          </View>
        </View>
      </Section>

      {/* ── 貸出場所 ── */}
      <Section label="貸出場所">
        <Field label="路線 / 駅" required error={errors.station_id}>
          {lines.length > 0 ? (
            <>
              <Text style={s.subLabel}>路線</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                {lines.map((l) => {
                  const sel = selectedLine === l.id;
                  return (
                    <Pressable key={l.id} style={[s.chip, sel && s.chipSel]}
                      onPress={() => { handleLineSelect(l.id); clearErr('station_id'); }}>
                      <Text style={[s.chipText, sel && s.chipTextSel]}>{l.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {stations.length > 0 && (
                <>
                  <Text style={[s.subLabel, { marginTop: 10 }]}>駅</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                    {stations.map((st) => {
                      const sel = form.station_id === st.id;
                      return (
                        <Pressable key={st.id} style={[s.chip, sel && s.chipSel]}
                          onPress={() => { set('station_id', st.id); clearErr('station_id'); }}
                          accessibilityState={{ selected: sel }}>
                          <Text style={[s.chipText, sel && s.chipTextSel]}>{st.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </>
          ) : (
            <Text style={s.loadingText}>路線データを読み込み中...</Text>
          )}
        </Field>

        <Field label="貸出場所詳細">
          <Inp
            value={form.lending_address}
            onChange={(v) => set('lending_address', v)}
            placeholder="例: 渋谷駅 南口 徒歩3分、○○倉庫前"
          />
        </Field>
      </Section>

      {/* ── 備考 ── */}
      <Section label="備考" note="任意">
        <Inp
          value={form.description}
          onChange={(v) => set('description', v)}
          placeholder="台車の状態・特徴・注意点など"
          multiline
        />
      </Section>

      {/* 送信 */}
      <View style={s.submitWrap}>
        <Pressable style={[s.submitBtn, submitting && s.submitBtnOff]} onPress={handleSubmit} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitText}>{submitLabel}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── スタイル ─────────────────────────────────
const s = StyleSheet.create({
  container: { paddingBottom: 40, backgroundColor: '#f9fafb' },

  // セクション
  section: { marginTop: 20 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', letterSpacing: 0.3 },
  sectionNote: { fontSize: 12, color: '#9ca3af' },
  sectionBody: { paddingTop: 4, paddingBottom: 8 },

  // フィールド
  field: { paddingHorizontal: 16, paddingTop: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  req: { color: '#ef4444' },
  errText: { color: '#ef4444', fontSize: 12, marginTop: 4 },

  // テキスト入力
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
    backgroundColor: '#fff', color: '#1a1a1a', minHeight: 46,
  },
  textarea: { height: 96, textAlignVertical: 'top' },

  // カテゴリ
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  catChipSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  catText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  catTextSel: { color: '#3b82f6' },

  // 写真
  photoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#d1d5db', borderStyle: 'dashed', backgroundColor: '#f9fafb',
  },
  photoIcon: { fontSize: 24 },
  photoText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },

  // スペックグリッド
  specGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  specHalf: { width: '50%' },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numInput: { flex: 1 },
  unit: { fontSize: 13, color: '#6b7280', minWidth: 40 },

  // トグル
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 14, padding: 14, backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#9ca3af' },

  // 価格
  priceErrBox: {
    marginHorizontal: 16, marginTop: 10, padding: 10,
    backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca',
  },
  priceErrText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  priceHalf: { width: '50%' },
  priceFull: { width: '100%' },

  // チップ
  subLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  chipScroll: { marginBottom: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
    borderColor: '#d1d5db', marginRight: 8, backgroundColor: '#fff', minHeight: 42, justifyContent: 'center',
  },
  chipSel: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextSel: { color: '#fff', fontWeight: '600' },

  loadingText: { fontSize: 13, color: '#9ca3af', paddingVertical: 8 },

  // 送信
  submitWrap: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 },
  submitBtn: {
    backgroundColor: '#3b82f6', padding: 16, borderRadius: 12,
    alignItems: 'center', minHeight: 54, justifyContent: 'center',
  },
  submitBtnOff: { backgroundColor: '#93c5fd' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
