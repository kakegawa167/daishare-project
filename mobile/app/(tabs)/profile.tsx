import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  reminderMinutes: number; // 合計分 (最小10, 最大1440)
}
const DEFAULT_NOTIF: NotifSettings = {
  enabled: true,
  request: true,
  message: true,
  reminder: true,
  reminderMinutes: 720, // 12時間前
};

function minutesToParts(total: number): { h: number; m: number } {
  return { h: Math.floor(total / 60), m: total % 60 };
}
function partsToMinutes(h: number, m: number): number {
  return Math.max(10, Math.min(1440, h * 60 + m));
}
function formatReminder(total: number): string {
  const { h, m } = minutesToParts(total);
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

// ─── ドラムロール ────────────────────────────
const ITEM_H = 48;
const VISIBLE = 5;                    // 表示行数（奇数推奨）
const PAD = Math.floor(VISIBLE / 2); // 上下の余白行数 = 2
const DRUM_H = ITEM_H * VISIBLE;

function DrumRoll({
  items, value, onChange,
}: { items: { label: string; value: number }[]; value: number; onChange: (v: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, items.findIndex((it) => it.value === value));

  // 初期・value変化時にスクロール位置を合わせる
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [idx]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    onChange(items[i].value);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // snapToInterval が止まった後も呼ぶ（drag後に止まるケース）
    onMomentumEnd(e);
  };

  // 上下にPAD個の空白行を追加してスクロールで端まで中央表示できるようにする
  const padItems = [
    ...Array(PAD).fill(null).map((_, i) => ({ label: '', value: -(i + 1) })),
    ...items,
    ...Array(PAD).fill(null).map((_, i) => ({ label: '', value: -(i + 100) })),
  ];

  return (
    <View style={dr.wrap}>
      <View style={dr.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onScrollEnd}
        style={{ height: DRUM_H }}
      >
        {padItems.map((it, i) => (
          <View key={i} style={dr.item}>
            {it.label !== '' && (
              <Text style={[dr.label, it.value === value && dr.labelSel]}>{it.label}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const dr = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', position: 'relative' },
  highlight: {
    position: 'absolute', left: 6, right: 6,
    top: ITEM_H * PAD, height: ITEM_H,
    backgroundColor: '#eff6ff',
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#bfdbfe',
    borderRadius: 10, zIndex: 0,
  },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 17, color: '#c4c4c4', fontWeight: '500' },
  labelSel: { fontSize: 21, color: '#111827', fontWeight: '700' },
});

// ─────────────────────────────────────────────
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
  // draft: 保存ボタンを押すまで反映しないnotif一時状態
  const [draft, setDraft] = useState<NotifSettings>(DEFAULT_NOTIF);

  // 初期値セット
  useEffect(() => {
    if (user) {
      setForm({ display_name: user.display_name, bio: user.bio ?? '', user_type: user.user_type });
    }
  }, [user]);

  // 通知設定ロード → draftに反映
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      if (raw) setDraft({ ...DEFAULT_NOTIF, ...JSON.parse(raw) });
    });
  }, []);

  const setN = <K extends keyof NotifSettings>(k: K, v: NotifSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const { h: remH, m: remM } = minutesToParts(draft.reminderMinutes);
  const setReminderH = (h: number) => setN('reminderMinutes', partsToMinutes(h, remM));
  const setReminderM = (m: number) => setN('reminderMinutes', partsToMinutes(remH, m));

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
      // 通知設定をここで永続化
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(draft));
      setEditing(false);
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
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

      {/* 編集ボタン（編集モードでない時のみ表示） */}
      {!editing && (
        <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
          <Text style={s.editBtnText}>プロフィールを編集</Text>
        </Pressable>
      )}

      {/* ── 通知設定 ── */}
      <SectionTitle label="通知設定" />
      <Card>
        <Row label="通知" last={!draft.enabled}>
          <Switch value={draft.enabled} onValueChange={(v) => setN('enabled', v)}
            trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
            thumbColor={draft.enabled ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
        </Row>

        {draft.enabled && (
          <>
            <View style={s.divider} />
            <Row label="リクエスト通知">
              <Switch value={draft.request} onValueChange={(v) => setN('request', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={draft.request ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
            </Row>
            <View style={s.divider} />
            <Row label="メッセージ通知">
              <Switch value={draft.message} onValueChange={(v) => setN('message', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={draft.message ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
            </Row>
            <View style={s.divider} />
            <Row label="予約リマインド" last={!draft.reminder}>
              <Switch value={draft.reminder} onValueChange={(v) => setN('reminder', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={draft.reminder ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
            </Row>

            {draft.reminder && (
              <>
                <View style={s.divider} />
                <View style={s.reminderSection}>
                  <Text style={s.reminderTitle}>リマインドタイミング</Text>
                  <Text style={s.reminderSummary}>{formatReminder(draft.reminderMinutes)}前に通知</Text>
                  <View style={s.drumWrap}>
                    <DrumRoll
                      value={remH}
                      onChange={(h) => {
                        if (h === 24) setN('reminderMinutes', 1440);
                        else setReminderH(h);
                      }}
                      items={Array.from({ length: 25 }, (_, i) => ({ label: `${i}時間`, value: i }))}
                    />
                    <Text style={s.drumSep}>:</Text>
                    <DrumRoll
                      value={remH === 24 ? 0 : remM}
                      onChange={(m) => { if (remH < 24) setReminderM(m); }}
                      items={[0, 10, 20, 30, 40, 50].map((m) => ({
                        label: `${String(m).padStart(2, '0')}分`,
                        value: m,
                      }))}
                    />
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </Card>

      {/* ── 保存ボタン ── */}
      <Pressable style={[s.saveBtn, saving && s.saveBtnOff]} onPress={handleSave} disabled={saving}>
        <Text style={s.saveBtnText}>{saving ? '保存中...' : '保存する'}</Text>
      </Pressable>

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

  saveBtn: {
    marginTop: 20, backgroundColor: '#3b82f6', borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnOff: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  editBtn: {
    marginTop: 14, backgroundColor: '#fff', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#3b82f6',
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },

  reminderSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  reminderTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  reminderSummary: { fontSize: 17, fontWeight: '700', color: '#3b82f6', marginBottom: 12 },
  drumWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 4 },
  drumSep: { fontSize: 22, fontWeight: '700', color: '#9ca3af', paddingBottom: 4 },

  logoutBtn: {
    marginTop: 24, padding: 15, alignItems: 'center', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff',
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
