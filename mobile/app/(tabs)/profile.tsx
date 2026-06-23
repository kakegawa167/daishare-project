import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// ─── 通知設定の型 ────────────────────────────
const NOTIF_KEY = '@daishare/notif_settings';

interface NotifSettings {
  enabled: boolean;
  request: boolean;
  message: boolean;
  reminder: boolean;
  reminderHour: number; // 1〜24
}
const DEFAULT_NOTIF: NotifSettings = {
  enabled: true,
  request: true,
  message: true,
  reminder: true,
  reminderHour: 12,
};

type UserType = 'lender' | 'renter' | 'both';
const USER_TYPE_LABELS: Record<UserType, string> = { renter: '借主', lender: '貸主', both: '両方' };

// ─── 小コンポーネント ─────────────────────────
function SectionTitle({ label }: { label: string }) {
  return (
    <View style={s.secTitle}>
      <Text style={s.secLabel}>{label}</Text>
    </View>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
function Row({
  label, value, last, children,
}: { label: string; value?: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      {children ?? <Text style={s.rowValue}>{value}</Text>}
    </View>
  );
}

// ─── メイン ───────────────────────────────────
export default function ProfileScreen() {
  const { user, signOut, syncUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: '', bio: '', user_type: 'renter' as UserType });
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF);

  // 初期値セット
  useEffect(() => {
    if (user) {
      setForm({ display_name: user.display_name, bio: user.bio ?? '', user_type: user.user_type });
    }
  }, [user]);

  // 通知設定ロード
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      if (raw) setNotif({ ...DEFAULT_NOTIF, ...JSON.parse(raw) });
    });
  }, []);

  const saveNotif = (next: NotifSettings) => {
    setNotif(next);
    AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };
  const setN = <K extends keyof NotifSettings>(k: K, v: NotifSettings[K]) =>
    saveNotif({ ...notif, [k]: v });

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me', {
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        user_type: form.user_type,
      });
      await syncUser();
      setEditing(false);
    } catch {
      Alert.alert('エラー', 'プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <ActivityIndicator style={{ flex: 1 }} color="#3b82f6" />;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── プロフィール情報 ── */}
      <SectionTitle label="プロフィール" />
      <Card>
        <Row label="名前" last={!editing}>
          {editing ? (
            <TextInput
              style={s.input}
              value={form.display_name}
              onChangeText={(v) => setForm((f) => ({ ...f, display_name: v }))}
              placeholder="表示名"
              placeholderTextColor="#c4c4c4"
              returnKeyType="next"
            />
          ) : (
            <Text style={s.rowValue}>{user.display_name}</Text>
          )}
        </Row>

        <View style={s.divider} />
        <Row label="メールアドレス" value={user.email} last={!editing} />

        {editing && (
          <>
            <View style={s.divider} />
            <Row label="自己紹介" last>
              <TextInput
                style={[s.input, s.textarea]}
                value={form.bio}
                onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                placeholder="台車の使い方や注意点など"
                placeholderTextColor="#c4c4c4"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Row>
          </>
        )}

        {!editing && (
          <>
            <View style={s.divider} />
            <Row label="自己紹介" value={user.bio || '未設定'} last />
          </>
        )}
      </Card>

      {/* ユーザータイプ */}
      <SectionTitle label="利用タイプ" />
      <Card>
        {editing ? (
          <View style={s.typeWrap}>
            {(['renter', 'lender', 'both'] as UserType[]).map((t) => {
              const sel = form.user_type === t;
              return (
                <Pressable key={t} style={[s.typeChip, sel && s.typeChipSel]}
                  onPress={() => setForm((f) => ({ ...f, user_type: t }))}>
                  <Text style={[s.typeChipText, sel && s.typeChipTextSel]}>{USER_TYPE_LABELS[t]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Row label="タイプ" value={USER_TYPE_LABELS[user.user_type]} last />
        )}
      </Card>

      {/* 編集ボタン */}
      {editing ? (
        <View style={s.btnRow}>
          <Pressable style={s.cancelBtn} onPress={() => {
            setEditing(false);
            setForm({ display_name: user.display_name, bio: user.bio ?? '', user_type: user.user_type });
          }}>
            <Text style={s.cancelBtnText}>キャンセル</Text>
          </Pressable>
          <Pressable style={[s.saveBtn, saving && s.saveBtnOff]} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? '保存中...' : '保存する'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
          <Text style={s.editBtnText}>プロフィールを編集</Text>
        </Pressable>
      )}

      {/* ── 通知設定 ── */}
      <SectionTitle label="通知設定" />
      <Card>
        {/* マスターON/OFF */}
        <Row label="通知" last={!notif.enabled}>
          <Switch
            value={notif.enabled}
            onValueChange={(v) => setN('enabled', v)}
            trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
            thumbColor={notif.enabled ? '#3b82f6' : '#9ca3af'}
            ios_backgroundColor="#e5e7eb"
          />
        </Row>

        {notif.enabled && (
          <>
            <View style={s.divider} />
            <Row label="リクエスト通知">
              <Switch
                value={notif.request}
                onValueChange={(v) => setN('request', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={notif.request ? '#3b82f6' : '#9ca3af'}
                ios_backgroundColor="#e5e7eb"
              />
            </Row>
            <View style={s.divider} />
            <Row label="メッセージ通知">
              <Switch
                value={notif.message}
                onValueChange={(v) => setN('message', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={notif.message ? '#3b82f6' : '#9ca3af'}
                ios_backgroundColor="#e5e7eb"
              />
            </Row>
            <View style={s.divider} />
            <Row label="予約リマインド" last={!notif.reminder}>
              <Switch
                value={notif.reminder}
                onValueChange={(v) => setN('reminder', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={notif.reminder ? '#3b82f6' : '#9ca3af'}
                ios_backgroundColor="#e5e7eb"
              />
            </Row>

            {notif.reminder && (
              <>
                <View style={s.divider} />
                <View style={s.reminderSection}>
                  <Text style={s.reminderTitle}>リマインドタイミング</Text>
                  <View style={s.stepper}>
                    <Pressable
                      style={[s.stepBtn, notif.reminderHour <= 1 && s.stepBtnOff]}
                      onPress={() => setN('reminderHour', Math.max(1, notif.reminderHour - 1))}
                      disabled={notif.reminderHour <= 1}
                    >
                      <Text style={s.stepBtnText}>−</Text>
                    </Pressable>
                    <View style={s.stepDisplay}>
                      <Text style={s.stepValue}>{notif.reminderHour}</Text>
                      <Text style={s.stepUnit}>時間前</Text>
                    </View>
                    <Pressable
                      style={[s.stepBtn, notif.reminderHour >= 24 && s.stepBtnOff]}
                      onPress={() => setN('reminderHour', Math.min(24, notif.reminderHour + 1))}
                      disabled={notif.reminderHour >= 24}
                    >
                      <Text style={s.stepBtnText}>＋</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </Card>

      {/* ── ログアウト ── */}
      <Pressable style={s.logoutBtn} onPress={() =>
        Alert.alert('ログアウト', 'ログアウトしますか？', [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ログアウト', style: 'destructive', onPress: signOut },
        ])
      }>
        <Text style={s.logoutText}>ログアウト</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── スタイル ─────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f6f8' },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  secTitle: { marginTop: 24, marginBottom: 10 },
  secLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f0f0f0', marginLeft: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 52,
  },
  rowLast: {},
  rowLabel: { fontSize: 15, color: '#374151', fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 15, color: '#6b7280', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },

  input: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 15,
    backgroundColor: '#fafafa', color: '#111827',
  },
  textarea: { height: 80, textAlignVertical: 'top' },

  typeWrap: { flexDirection: 'row', gap: 8, padding: 16 },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fafafa', alignItems: 'center',
  },
  typeChipSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  typeChipText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  typeChipTextSel: { color: '#3b82f6' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  saveBtn: {
    flex: 2, backgroundColor: '#3b82f6', borderRadius: 12,
    padding: 14, alignItems: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  saveBtnOff: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  editBtn: {
    marginTop: 14, backgroundColor: '#fff', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#3b82f6',
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },

  reminderSection: { paddingHorizontal: 16, paddingVertical: 14 },
  reminderTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
  },
  stepBtnOff: { backgroundColor: '#e5e7eb' },
  stepBtnText: { color: '#fff', fontSize: 20, fontWeight: '600', lineHeight: 24 },
  stepDisplay: { minWidth: 100, alignItems: 'center', paddingHorizontal: 12 },
  stepValue: { fontSize: 32, fontWeight: '800', color: '#111827', lineHeight: 38 },
  stepUnit: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  logoutBtn: {
    marginTop: 24, padding: 15, alignItems: 'center', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff',
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
