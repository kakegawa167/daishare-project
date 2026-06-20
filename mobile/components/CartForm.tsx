import { api } from '@/lib/api';
import { CartFormData } from '@/lib/types';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function CartForm({ initialData, onSubmit, submitLabel }: Props) {
  const [form, setForm] = useState<CartFormData>(initialData);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Line[]>('/lines').then((r) => setLines(r.data)).catch(() => {});
  }, []);

  const handleLineSelect = (lineId: number) => {
    const line = lines.find((l) => l.id === lineId);
    setStations(line?.stations ?? []);
    setForm((f) => ({ ...f, station_id: null }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { Alert.alert('エラー', 'タイトルを入力してください'); return; }
    if (!form.daily_rate || isNaN(Number(form.daily_rate))) { Alert.alert('エラー', '日額を入力してください'); return; }
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>タイトル *</Text>
      <TextInput
        style={styles.input}
        value={form.title}
        onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
        placeholder="例: 平台車（大）"
      />

      <Text style={styles.label}>説明</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={form.description}
        onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
        placeholder="台車の特徴・状態など"
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>日額（円）*</Text>
      <TextInput
        style={styles.input}
        value={form.daily_rate}
        onChangeText={(v) => setForm((f) => ({ ...f, daily_rate: v }))}
        placeholder="500"
        keyboardType="numeric"
      />

      <Text style={styles.label}>台数</Text>
      <TextInput
        style={styles.input}
        value={form.quantity}
        onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
        placeholder="1"
        keyboardType="numeric"
      />

      <Text style={styles.label}>路線</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {lines.map((l) => (
          <Pressable
            key={l.id}
            style={[styles.chip, stations[0] && stations.find((s) => s.id === form.station_id) && styles.chipSelected]}
            onPress={() => handleLineSelect(l.id)}
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
              >
                <Text style={[styles.chipText, form.station_id === s.id && styles.chipTextSelected]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Pressable style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{submitLabel}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
    backgroundColor: '#fff',
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
  },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
