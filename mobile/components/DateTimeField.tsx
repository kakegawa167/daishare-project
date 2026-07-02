import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 日付ボタン＋時刻ボタンの日時ピッカー（リクエスト送信・返却日変更で共通）。
 * - 日付: カレンダー（inline / ja-JP）＋「確定」ボタン
 * - 時刻: スピナー（ja-JP）＋「キャンセル / 確定」
 */
export function DateTimeField({
  label, value, onChange, minimumDate,
}: { label?: string; value: Date; onChange: (d: Date) => void; minimumDate?: Date }) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState(value);
  const [tempTime, setTempTime] = useState(value);
  const insets = useSafeAreaInsets();

  const dateLabel = value.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const timeLabel = value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={d.field}>
      {label ? <Text style={d.label}>{label}</Text> : null}
      <View style={d.row}>
        <Pressable style={d.btn} onPress={() => { setTempDate(value); setShowDate(true); }}>
          <MaterialIcons name="calendar-today" size={14} color="#3b82f6" />
          <Text style={d.btnText}>{dateLabel}</Text>
        </Pressable>
        <Pressable style={d.btn} onPress={() => { setTempTime(value); setShowTime(true); }}>
          <MaterialIcons name="access-time" size={14} color="#3b82f6" />
          <Text style={d.btnText}>{timeLabel}</Text>
        </Pressable>
      </View>

      {/* カレンダーモーダル */}
      <Modal visible={showDate} transparent animationType="fade" onRequestClose={() => setShowDate(false)}>
        <Pressable style={d.backdrop} onPress={() => setShowDate(false)} />
        <View style={[d.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="inline"
            locale="ja-JP"
            minimumDate={minimumDate}
            onChange={(_, dt) => { if (dt) setTempDate(dt); }}
          />
          <Pressable style={d.confirmBtn} onPress={() => {
            setShowDate(false);
            const n = new Date(tempDate);
            n.setHours(value.getHours(), value.getMinutes());
            onChange(n);
          }}>
            <Text style={d.confirmText}>確定</Text>
          </Pressable>
        </View>
      </Modal>

      {/* 時刻モーダル */}
      <Modal visible={showTime} transparent animationType="slide" onRequestClose={() => setShowTime(false)}>
        <Pressable style={d.backdrop} onPress={() => setShowTime(false)} />
        <View style={[d.timeSheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={d.timeHeader}>
            <Pressable onPress={() => setShowTime(false)}>
              <Text style={d.timeCancel}>キャンセル</Text>
            </Pressable>
            <Text style={d.timeTitle}>時刻を選択</Text>
            <Pressable onPress={() => {
              setShowTime(false);
              const n = new Date(value);
              n.setHours(tempTime.getHours(), tempTime.getMinutes());
              onChange(n);
            }}>
              <Text style={d.timeDone}>確定</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={tempTime}
            mode="time"
            display="spinner"
            locale="ja-JP"
            onChange={(_, dt) => { if (dt) setTempTime(dt); }}
          />
        </View>
      </Modal>
    </View>
  );
}

const d = StyleSheet.create({
  field: { padding: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  btnText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, paddingHorizontal: 12,
  },
  confirmBtn: {
    marginHorizontal: 16, marginTop: 8, backgroundColor: '#3b82f6',
    borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  timeSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 4,
  },
  timeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  timeTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  timeCancel: { fontSize: 15, color: '#6b7280' },
  timeDone: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },
});
