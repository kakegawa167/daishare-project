import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { api } from '@/lib/api';
import { AppUser, useAuthStore } from '@/store/authStore';
import { StationPicker } from '@/components/StationPicker';

type UserType = 'lender' | 'renter' | 'both';

const USER_TYPE_LABELS: Record<UserType, string> = {
  renter: '借主',
  lender: '貸主',
  both: '両方',
};

interface StationInfo {
  id: number;
  name: string;
  municipality: string;
  line_id: number;
}

export default function ProfileScreen() {
  const { user, signOut, syncUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationInfo | null>(null);
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    lending_address: '',
    user_type: 'renter' as UserType,
    base_station_id: null as number | null,
  });

  useEffect(() => {
    if (user) {
      setForm({
        display_name: user.display_name,
        bio: user.bio ?? '',
        lending_address: user.lending_address ?? '',
        user_type: user.user_type,
        base_station_id: user.base_station_id,
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', {
        display_name: form.display_name,
        bio: form.bio || null,
        lending_address: form.lending_address || null,
        user_type: form.user_type,
        base_station_id: form.base_station_id,
      });
      await syncUser();
      setEditing(false);
    } catch {
      Alert.alert('エラー', 'プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>プロフィール</Text>

      <Text style={styles.label}>表示名</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={form.display_name}
          onChangeText={(v) => setForm((f) => ({ ...f, display_name: v }))}
        />
      ) : (
        <Text style={styles.value}>{user.display_name}</Text>
      )}

      <Text style={styles.label}>メールアドレス</Text>
      <Text style={styles.value}>{user.email}</Text>

      <Text style={styles.label}>自己紹介</Text>
      {editing ? (
        <TextInput
          style={[styles.input, styles.multiline]}
          value={form.bio}
          onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
          multiline
          numberOfLines={3}
        />
      ) : (
        <Text style={styles.value}>{user.bio ?? '未設定'}</Text>
      )}

      <Text style={styles.label}>拠点駅</Text>
      {editing ? (
        <TouchableOpacity
          style={styles.stationBtn}
          onPress={() => setShowStationPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="拠点駅を選択"
        >
          <Text style={selectedStation || form.base_station_id ? styles.stationBtnText : styles.stationBtnPlaceholder}>
            {selectedStation ? `${selectedStation.name}駅（${selectedStation.municipality}）` : form.base_station_id ? '駅選択済み（名称読込中）' : '駅を選択してください'}
          </Text>
          <Text style={{ color: '#9ca3af' }}>›</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.value}>{user.base_station_id ? '設定済み' : '未設定'}</Text>
      )}

      <Text style={styles.label}>貸出場所詳細</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={form.lending_address}
          onChangeText={(v) => setForm((f) => ({ ...f, lending_address: v }))}
          placeholder="例: 倉庫前（〇〇駅北口徒歩3分）"
        />
      ) : (
        <Text style={styles.value}>{user.lending_address ?? '未設定'}</Text>
      )}

      <Text style={styles.label}>ユーザータイプ</Text>
      {editing ? (
        <View style={styles.typeRow}>
          {(['renter', 'lender', 'both'] as UserType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, form.user_type === t && styles.typeBtnActive]}
              onPress={() => setForm((f) => ({ ...f, user_type: t }))}
            >
              <Text style={[styles.typeBtnText, form.user_type === t && styles.typeBtnTextActive]}>
                {USER_TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.value}>{USER_TYPE_LABELS[user.user_type]}</Text>
      )}

      {editing ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setEditing(false)}>
            <Text style={styles.btnSecondaryText}>キャンセル</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
            <Text style={styles.btnPrimaryText}>{saving ? '保存中...' : '保存'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setEditing(true)}>
          <Text style={styles.btnPrimaryText}>編集</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btnLogout} onPress={signOut}>
        <Text style={styles.btnLogoutText}>ログアウト</Text>
      </TouchableOpacity>

      <StationPicker
        visible={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        onSelect={(station) => {
          setSelectedStation(station);
          setForm((f) => ({ ...f, base_station_id: station.id }));
        }}
        currentStationId={form.base_station_id}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 12, color: '#888', marginTop: 16, marginBottom: 4 },
  value: { fontSize: 16, color: '#1a1a1a' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  typeBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  typeBtnText: { color: '#666' },
  typeBtnTextActive: { color: '#2563eb', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  btnSecondaryText: { color: '#374151', fontWeight: '600', fontSize: 16 },
  btnLogout: {
    marginTop: 40,
    padding: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  btnLogoutText: { color: '#ef4444', fontWeight: '600' },
  stationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  stationBtnText: { fontSize: 16, color: '#1f2937' },
  stationBtnPlaceholder: { fontSize: 16, color: '#9ca3af' },
});
