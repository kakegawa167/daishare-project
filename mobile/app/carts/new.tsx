import CartForm from '@/components/CartForm';
import { api } from '@/lib/api';
import { CartFormData } from '@/lib/types';
import { router } from 'expo-router';
import { Alert } from 'react-native';

const EMPTY: CartFormData = {
  title: '',
  description: '',
  daily_rate: '',
  quantity: '1',
  station_id: null,
  image_urls: [],
};

export default function NewCart() {
  const handleSubmit = async (form: CartFormData) => {
    await api.post('/carts', {
      title: form.title,
      description: form.description || null,
      daily_rate: Number(form.daily_rate),
      quantity: Number(form.quantity) || 1,
      station_id: form.station_id,
      image_urls: form.image_urls,
    });
    Alert.alert('完了', '台車を登録しました', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return <CartForm initialData={EMPTY} onSubmit={handleSubmit} submitLabel="登録する" />;
}
