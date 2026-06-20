import { StyleSheet, Text, View } from 'react-native';

interface Props {
  count: number;
  children: React.ReactNode;
}

export function TabBarBadge({ count, children }: Props) {
  return (
    <View style={styles.container}>
      {children}
      {count > 0 && (
        <View style={styles.badge} accessibilityLabel={`未読${count}件`}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
