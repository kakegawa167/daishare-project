import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

type UserType = 'lender' | 'renter' | 'both';

function SectionTitle({ label }: { label: string }) {
  return <View style={s.secTitle}><Text style={s.secLabel}>{label}</Text></View>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export default function ProfileEditScreen() {
  const { user, syncUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ display_name: '', bio: '', user_type: 'renter' as UserType });

  useEffect(() => {
    if (user) setForm({ display_name: user.display_name, bio: user.bio ?? '', user_type: user.user_type });
  }, [user]);

  const handlePickAvatar = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ImagePicker: any;
    try {
      ImagePicker = await import('expo-image-picker' as any);
    } catch {
      Alert.alert('非対応', 'この機能はDev Buildが必要です。\nExpo Go では利用できません。');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('権限が必要', '写真へのアクセスを許可してください'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAvatarUri(asset.uri);
    setUploadingAvatar(true);
    try {
      if (!asset.base64) throw new Error('base64 の取得に失敗しました');
      const mime = asset.mimeType ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('not authenticated');
      const path = `avatars/${userId}.${ext}`;

      const binary = atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error } = await supabase.storage.from('avatars')
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await api.put('/users/me', { avatar_url: publicUrl });
      await syncUser();
    } catch (e: any) {
      console.error('avatar upload error:', e?.message, e);
      Alert.alert('エラー', `アイコンのアップロードに失敗しました\n${e?.message ?? ''}`);
      setAvatarUri(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) { Alert.alert('エラー', '名前を入力してください'); return; }
    setSaving(true);
    try {
      const wasNew = user?.is_new;
      await api.put('/users/me', {
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        user_type: form.user_type,
      });
      await syncUser();
      if (wasNew) {
        router.replace('/(tabs)');
      } else {
        router.back();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? '保存に失敗しました';
      Alert.alert('保存できません', msg);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <ActivityIndicator style={{ flex: 1 }} color="#3b82f6" />;

  const avatarSrc = avatarUri ?? user.avatar_url;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

      {/* アバター */}
      <View style={s.avatarSection}>
        <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} style={s.avatarWrap}>
          {uploadingAvatar ? (
            <View style={s.avatarImg}><ActivityIndicator color="#3b82f6" /></View>
          ) : avatarSrc ? (
            <Image source={{ uri: avatarSrc }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarImg, s.avatarPlaceholder]}>
              <Text style={s.avatarInitial}>{user.display_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={s.avatarBadge}><Text style={s.avatarBadgeText}>📷</Text></View>
        </Pressable>
        <Text style={s.avatarHint}>タップして変更</Text>
      </View>

      {/* プロフィール */}
      <SectionTitle label="プロフィール" />
      <Card>
        <View style={s.field}>
          <Text style={s.fieldLabel}>名前 <Text style={s.req}>*</Text></Text>
          <TextInput style={s.input} value={form.display_name}
            onChangeText={(v) => setForm((f) => ({ ...f, display_name: v }))}
            placeholder="名前" placeholderTextColor="#c4c4c4" returnKeyType="next" />
        </View>
        <View style={s.divider} />
        <View style={s.field}>
          <Text style={s.fieldLabel}>自己紹介</Text>
          <TextInput style={[s.input, s.textarea]} value={form.bio}
            onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
            placeholder="台車の使い方や注意点など"
            placeholderTextColor="#c4c4c4" multiline numberOfLines={4} textAlignVertical="top" />
        </View>
      </Card>

      {/* 利用タイプ */}
      <SectionTitle label="利用タイプ" />
      <View style={s.typeCards}>
        {([
          { value: 'renter', icon: 'shopping-bag' as const, label: '借りる', desc: '台車を借りてお得に活用' },
          { value: 'lender', icon: 'sell' as const, label: '貸す',   desc: '台車を貸して副収入を獲得' },
        ] as { value: UserType; icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; desc: string }[]).map(({ value, icon, label, desc }) => {
          const sel = form.user_type === value;
          return (
            <Pressable key={value} style={[s.typeCard, sel && s.typeCardSel]}
              onPress={() => setForm((f) => ({ ...f, user_type: value }))}>
              <MaterialIcons name={icon} size={28} color={sel ? '#1d4ed8' : '#9ca3af'} style={{ marginBottom: 4 }} />
              <Text style={[s.typeCardLabel, sel && s.typeCardLabelSel]}>{label}</Text>
              <Text style={[s.typeCardDesc, sel && s.typeCardDescSel]}>{desc}</Text>
              {sel && <View style={s.typeCardCheck}><Text style={s.typeCardCheckText}>✓</Text></View>}
            </Pressable>
          );
        })}
      </View>

      {/* 保存 */}
      <Pressable style={[s.saveBtn, saving && s.saveBtnOff]} onPress={handleSave} disabled={saving}>
        <Text style={s.saveBtnText}>{saving ? '保存中...' : '保存する'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f6f8' },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', paddingVertical: 12 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#e0e7ff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  avatarPlaceholder: { backgroundColor: '#3b82f6' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb' },
  avatarBadgeText: { fontSize: 14 },
  avatarHint: { marginTop: 8, fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  secTitle: { marginTop: 24, marginBottom: 10 },
  secLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f0f0f0', marginLeft: 16 },

  field: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  req: { color: '#ef4444' },
  input: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: '#fafafa', color: '#111827' },
  textarea: { height: 100, textAlignVertical: 'top' },

  typeCards: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1, borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb',
    backgroundColor: '#fff', padding: 16, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    position: 'relative',
  },
  typeCardSel: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  typeCardLabel: { fontSize: 17, fontWeight: '800', color: '#374151' },
  typeCardLabelSel: { color: '#1d4ed8' },
  typeCardDesc: { fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 15 },
  typeCardDescSel: { color: '#3b82f6' },
  typeCardCheck: {
    position: 'absolute', top: 8, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
  },
  typeCardCheckText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  saveBtn: { marginTop: 28, backgroundColor: '#3b82f6', borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnOff: { backgroundColor: '#93c5fd', shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
