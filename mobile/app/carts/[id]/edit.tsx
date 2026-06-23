import CartForm from '@/components/CartForm';
import { api } from '@/lib/api';
import { Cart, CartFormData } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

const toStr = (v: number | null | undefined) => (v != null ? String(v) : '');

export default function EditCart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialData, setInitialData] = useState<CartFormData | null>(null);
  const [initialStation, setInitialStation] = useState<{ id: number; name: string; municipality: string; line_id: number } | null>(null);

  useEffect(() => {
    api.get<Cart>(`/carts/${id}`).then((r) => {
      const c = r.data;
      if (c.station_id && c.station_name) {
        setInitialStation({ id: c.station_id, name: c.station_name, municipality: c.municipality ?? '', line_id: 0 });
      }
      setInitialData({
        title: c.title,
        category: c.category,
        description: c.description ?? '',
        weight_kg: toStr(c.weight_kg),
        max_load_kg: toStr(c.max_load_kg),
        width_cm: toStr(c.width_cm),
        length_cm: toStr(c.length_cm),
        foldable: c.foldable,
        daily_rate: toStr(c.daily_rate),
        weekly_rate: toStr(c.weekly_rate),
        per_rental_rate: toStr(c.per_rental_rate),
        quantity: String(c.quantity),
        station_id: c.station_id,
        lending_address: c.lending_address ?? '',
        image_urls: c.image_urls,
      });
    }).catch(() => Alert.alert('エラー', '台車情報の取得に失敗しました'));
  }, [id]);

  const toNum = (v: string) => (v ? Number(v) : null);

  const handleSubmit = async (form: CartFormData) => {
    await api.put(`/carts/${id}`, {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || null,
      weight_kg: toNum(form.weight_kg),
      max_load_kg: toNum(form.max_load_kg),
      width_cm: toNum(form.width_cm),
      length_cm: toNum(form.length_cm),
      foldable: form.foldable,
      daily_rate: toNum(form.daily_rate),
      weekly_rate: toNum(form.weekly_rate),
      per_rental_rate: toNum(form.per_rental_rate),
      quantity: Number(form.quantity) || 1,
      station_id: form.station_id,
      lending_address: form.lending_address.trim() || null,
      image_urls: form.image_urls,
    });
    Alert.alert('完了', '台車情報を更新しました', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (!initialData) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return <CartForm initialData={initialData} initialStation={initialStation} onSubmit={handleSubmit} submitLabel="更新する" />;
}
