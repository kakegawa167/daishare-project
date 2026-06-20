import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface MenuCard {
  title: string;
  description: string;
  emoji: string;
  href: string;
}

const MENUS: MenuCard[] = [
  { title: '台車を探す', description: '近くの台車を検索してリクエストを送る', emoji: '🔍', href: '/search' },
  { title: '自分の台車', description: '台車の登録・編集・削除', emoji: '🛒', href: '/carts' },
  { title: 'リクエスト', description: '送受信したリクエストの確認・承認', emoji: '📩', href: '/requests' },
  { title: 'スケジュール', description: '予約の確認と貸出・返却管理', emoji: '📅', href: '/schedule' },
  { title: '通知', description: 'リクエスト・メッセージの通知', emoji: '🔔', href: '/notifications' },
];

export default function Home() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>ダイシェア</Text>
      <Text style={styles.subtitle}>台車の個人間レンタルマッチング</Text>
      {MENUS.map((m) => (
        <Pressable
          key={m.href}
          style={styles.card}
          onPress={() => router.push(m.href as any)}
          accessibilityRole="button"
          accessibilityLabel={`${m.title}：${m.description}`}
        >
          <Text style={styles.cardEmoji} accessibilityElementsHidden>{m.emoji}</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{m.title}</Text>
            <Text style={styles.cardDesc}>{m.description}</Text>
          </View>
          <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48 },
  logo: { fontSize: 32, fontWeight: '800', color: '#3b82f6', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardEmoji: { fontSize: 28, marginRight: 14 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  cardDesc: { fontSize: 13, color: '#6b7280' },
  arrow: { fontSize: 22, color: '#d1d5db' },
});
