import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useAuthStore } from '@/store/authStore';

// ─── 通知設定 ────────────────────────────────
export const NOTIF_KEY = '@daishare/notif_settings';

export interface NotifSettings {
  enabled: boolean;
  request: boolean;
  message: boolean;
  reminder: boolean;
  reminderMinutes: number;
}
export const DEFAULT_NOTIF: NotifSettings = {
  enabled: true, request: true, message: true, reminder: true, reminderMinutes: 720,
};

export function minutesToParts(total: number) {
  return { h: Math.floor(total / 60), m: total % 60 };
}
export function partsToMinutes(h: number, m: number) {
  return Math.max(10, Math.min(1440, h * 60 + m));
}
export function formatReminder(total: number): string {
  const { h, m } = minutesToParts(total);
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

// ─── ドラムロール ────────────────────────────
const ITEM_H = 48;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);
const DRUM_H = ITEM_H * VISIBLE;

export function DrumRoll({
  items, value, onChange,
}: { items: { label: string; value: number }[]; value: number; onChange: (v: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, items.findIndex((it) => it.value === value));

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 80);
    return () => clearTimeout(t);
  }, [idx]);

  const snap = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    onChange(items[i].value);
  };

  const padItems = [
    ...Array(PAD).fill(null).map((_, i) => ({ label: '', value: -(i + 1) })),
    ...items,
    ...Array(PAD).fill(null).map((_, i) => ({ label: '', value: -(i + 100) })),
  ];

  return (
    <View style={dr.wrap}>
      <View style={dr.highlight} pointerEvents="none" />
      <ScrollView ref={ref} showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H} decelerationRate="fast"
        onMomentumScrollEnd={snap} onScrollEndDrag={snap}
        style={{ height: DRUM_H }}>
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
    borderRadius: 10,
  },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 17, color: '#c4c4c4', fontWeight: '500' },
  labelSel: { fontSize: 21, color: '#111827', fontWeight: '700' },
});

// ─── 小コンポーネント ─────────────────────────
function SectionTitle({ label }: { label: string }) {
  return <View style={s.secTitle}><Text style={s.secLabel}>{label}</Text></View>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {children ?? <Text style={s.rowValue}>{value}</Text>}
    </View>
  );
}

const USER_TYPE_LABELS: Record<string, string> = { renter: '借主', lender: '貸主', both: '両方' };

// ─── プロフィール表示画面 ──────────────────────
export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF);

  // フォーカス時に通知設定を再読み込み（編集画面から戻った後も反映）
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      if (raw) setNotif({ ...DEFAULT_NOTIF, ...JSON.parse(raw) });
    });
  }, []));

  const setN = <K extends keyof NotifSettings>(k: K, v: NotifSettings[K]) => {
    const next = { ...notif, [k]: v };
    setNotif(next);
    AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };

  const { h: remH, m: remM } = minutesToParts(notif.reminderMinutes);

  if (!user) return <ActivityIndicator style={{ flex: 1 }} color="#3b82f6" />;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── アバター ── */}
      <View style={s.avatarSection}>
        <View style={s.avatarWrap}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarImg, s.avatarPlaceholder]}>
              <Text style={s.avatarInitial}>{user.display_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={s.avatarName}>{user.display_name}</Text>
        <Text style={s.avatarEmail}>{user.email}</Text>
      </View>

      {/* ── プロフィール情報 ── */}
      <SectionTitle label="プロフィール" />
      <Card>
        <Row label="名前" value={user.display_name} />
        <View style={s.divider} />
        <Row label="自己紹介" value={user.bio || '未設定'} />
        <View style={s.divider} />
        <Row label="タイプ" value={USER_TYPE_LABELS[user.user_type]} />
      </Card>

      <Pressable style={s.editBtn} onPress={() => router.push('/profile-edit' as any)}>
        <Text style={s.editBtnText}>プロフィールを編集</Text>
      </Pressable>

      {/* ── 通知設定 ── */}
      <SectionTitle label="通知設定" />
      <Card>
        <Row label="通知">
          <Switch value={notif.enabled} onValueChange={(v) => setN('enabled', v)}
            trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
            thumbColor={notif.enabled ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
        </Row>
        {notif.enabled && (
          <>
            <View style={s.divider} />
            <Row label="リクエスト通知">
              <Switch value={notif.request} onValueChange={(v) => setN('request', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={notif.request ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
            </Row>
            <View style={s.divider} />
            <Row label="メッセージ通知">
              <Switch value={notif.message} onValueChange={(v) => setN('message', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={notif.message ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
            </Row>
            <View style={s.divider} />
            <Row label="予約リマインド">
              <Switch value={notif.reminder} onValueChange={(v) => setN('reminder', v)}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={notif.reminder ? '#3b82f6' : '#9ca3af'} ios_backgroundColor="#e5e7eb" />
            </Row>
            {notif.reminder && (
              <>
                <View style={s.divider} />
                <View style={s.reminderSection}>
                  <Text style={s.reminderTitle}>リマインドタイミング</Text>
                  <Text style={s.reminderSummary}>{formatReminder(notif.reminderMinutes)}前に通知</Text>
                  <View style={s.drumWrap}>
                    <DrumRoll value={remH}
                      onChange={(h) => setN('reminderMinutes', h === 24 ? 1440 : partsToMinutes(h, remM))}
                      items={Array.from({ length: 25 }, (_, i) => ({ label: `${i}時間`, value: i }))} />
                    <Text style={s.drumSep}>:</Text>
                    <DrumRoll value={remH === 24 ? 0 : remM}
                      onChange={(m) => { if (remH < 24) setN('reminderMinutes', partsToMinutes(remH, m)); }}
                      items={[0, 10, 20, 30, 40, 50].map((m) => ({
                        label: `${String(m).padStart(2, '0')}分`, value: m,
                      }))} />
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
        ])}>
        <Text style={s.logoutText}>ログアウト</Text>
      </Pressable>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f6f8' },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', paddingVertical: 16 },
  avatarWrap: {},
  avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  avatarPlaceholder: { backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#fff' },
  avatarName: { marginTop: 10, fontSize: 18, fontWeight: '700', color: '#111827' },
  avatarEmail: { marginTop: 2, fontSize: 13, color: '#9ca3af' },

  secTitle: { marginTop: 24, marginBottom: 10 },
  secLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f0f0f0', marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  rowLabel: { fontSize: 15, color: '#374151', fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 15, color: '#6b7280', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },

  editBtn: { marginTop: 14, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#3b82f6' },
  editBtnText: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },

  reminderSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  reminderTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  reminderSummary: { fontSize: 17, fontWeight: '700', color: '#3b82f6', marginBottom: 12 },
  drumWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 4 },
  drumSep: { fontSize: 22, fontWeight: '700', color: '#9ca3af', paddingBottom: 4 },

  logoutBtn: { marginTop: 24, padding: 15, alignItems: 'center', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fff' },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
