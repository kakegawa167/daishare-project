import { api } from '@/lib/api';
import { CartFormData } from '@/lib/types';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Line {
  id: number;
  name: string;
  stations: Station[];
}
interface Station {
  id: number;
  name: string;
  municipality: string;
}

interface Props {
  initialData: CartFormData;
  onSubmit: (data: CartFormData) => Promise<void>;
  submitLabel: string;
}

interface Errors {
  title?: string;
  daily_rate?: string;
  quantity?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.errorText} accessibilityRole="alert">{message}</Text>;
}

export default function CartForm({ initialData, onSubmit, submitLabel }: Props) {
  const [form, setForm] = useState<CartFormData>(initialData);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    api.get<Line[]>('/lines').then((r) => setLines(r.data)).catch(() => {});
  }, []);

  const handleLineSelect = (lineId: number) => {
    const line = lines.find((l) => l.id === lineId);
    setStations(line?.stations ?? []);
    setForm((f) => ({ ...f, station_id: null }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.title.trim()) next.title = 'タイトルを入力してください';
    else if (form.title.trim().length > 200) next.title = '200文字以内で入力してください';
    const rate = Number(form.daily_rate);
    if (!form.daily_rate) next.daily_rate = '日額を入力してください';
    else if (isNaN(rate) || rate <= 0) next.daily_rate = '正の数値を入力してください';
    else if (rate > 9999999) next.daily_rate = '日額が大きすぎます';
    const qty = Number(form.quantity);
    if (form.quantity && (isNaN(qty) || qty < 1 || !Number.isInteger(qty))) {
      next.quantity = '1以上の整数を入力してください';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      AccessibilityInfo.announceForAccessibility(Object.values(next)[0]);
    }
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label} accessibilityRole="text">タイトル <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, errors.title ? styles.inputError : null]}
        value={form.title}
        onChangeText={(v) => { setForm((f) => ({ ...f, title: v })); setErrors((e) => ({ ...e, title: undefined })); }}
        placeholder="例: 平台車（大）"
        accessibilityLabel="台車タイトル（必須）"
        accessibilityHint="台車の名称を入力してください"
        maxLength={200}
        returnKeyType="next"
      />
      <FieldError message={errors.title} />

      <Text style={styles.label}>説明</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={form.description}
        onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
        placeholder="台車の特徴・状態など"
        multiline
        numberOfLines={4}
        accessibilityLabel="台車の説明"
        textAlignVertical="top"
      />

      <Text style={styles.label}>日額（円）<Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, errors.daily_rate ? styles.inputError : null]}
        value={form.daily_rate}
        onChangeText={(v) => { setForm((f) => ({ ...f, daily_rate: v })); setErrors((e) => ({ ...e, daily_rate: undefined })); }}
        placeholder="500"
        keyboardType="number-pad"
        accessibilityLabel="日額（必須）"
        accessibilityHint="1日あたりのレンタル料金を円で入力してください"
        returnKeyType="next"
      />
      <FieldError message={errors.daily_rate} />

      <Text style={styles.label}>台数</Text>
      <TextInput
        style={[styles.input, errors.quantity ? styles.inputError : null]}
        value={form.quantity}
        onChangeText={(v) => { setForm((f) => ({ ...f, quantity: v })); setErrors((e) => ({ ...e, quantity: undefined })); }}
        placeholder="1"
        keyboardType="number-pad"
        accessibilityLabel="台数"
        returnKeyType="done"
      />
      <FieldError message={errors.quantity} />

      <Text style={styles.label}>路線</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {lines.map((l) => (
          <Pressable
            key={l.id}
            style={[styles.chip, stations[0] && stations.find((s) => s.id === form.station_id) && styles.chipSelected]}
            onPress={() => handleLineSelect(l.id)}
            accessibilityRole="button"
            accessibilityLabel={`路線: ${l.name}`}
          >
            <Text style={styles.chipText}>{l.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {stations.length > 0 && (
        <>
          <Text style={styles.label}>駅</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {stations.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.chip, form.station_id === s.id && styles.chipSelected]}
                onPress={() => setForm((f) => ({ ...f, station_id: s.id }))}
                accessibilityRole="button"
                accessibilityLabel={`駅: ${s.name}`}
                accessibilityState={{ selected: form.station_id === s.id }}
              >
                <Text style={[styles.chipText, form.station_id === s.id && styles.chipTextSelected]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Pressable
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: submitting }}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{submitLabel}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  required: { color: '#ef4444' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  inputError: { borderColor: '#ef4444', borderWidth: 1.5 },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 4, marginLeft: 2 },
  textarea: { height: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextSelected: { color: '#fff' },
  submitBtn: {
    marginTop: 32,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
