import CartForm from '@/components/CartForm';
import { api } from '@/lib/api';
import { Cart, CartFormData } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

export default function EditCart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialData, setInitialData] = useState<CartFormData | null>(null);

  useEffect(() => {
    api.get<Cart>(`/carts/${id}`).then((r) => {
      const c = r.data;
      setInitialData({
        title: c.title,
        description: c.description ?? '',
        daily_rate: String(c.daily_rate),
        quantity: String(c.quantity),
        station_id: c.station_id,
        image_urls: c.image_urls,
      });
    }).catch(() => Alert.alert('エラー', '台車情報の取得に失敗しました'));
  }, [id]);

  const handleSubmit = async (form: CartFormData) => {
    await api.put(`/carts/${id}`, {
      title: form.title,
      description: form.description || null,
      daily_rate: Number(form.daily_rate),
      quantity: Number(form.quantity) || 1,
      station_id: form.station_id,
      image_urls: form.image_urls,
    });
    Alert.alert('完了', '台車情報を更新しました', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (!initialData) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return <CartForm initialData={initialData} onSubmit={handleSubmit} submitLabel="更新する" />;
}
