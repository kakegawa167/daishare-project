import CartForm from '@/components/CartForm';
import { api } from '@/lib/api';
import { CartFormData } from '@/lib/types';
import { router } from 'expo-router';
import { Alert } from 'react-native';

const EMPTY: CartFormData = {
  title: '',
  category: null,
  description: '',
  weight_kg: '',
  max_load_kg: '',
  width_cm: '',
  length_cm: '',
  foldable: false,
  daily_rate: '',
  weekly_rate: '',
  per_rental_rate: '',
  quantity: '1',
  station_id: null,
  lending_address: '',
  image_urls: [],
};

const toNum = (v: string) => (v ? Number(v) : null);

export default function NewCart() {
  const handleSubmit = async (form: CartFormData) => {
    await api.post('/carts', {
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
    Alert.alert('完了', '台車を登録しました', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return <CartForm initialData={EMPTY} onSubmit={handleSubmit} submitLabel="台車を登録する" />;
}
