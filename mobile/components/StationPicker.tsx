import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Line {
  id: number;
  name: string;
}

interface Station {
  id: number;
  name: string;
  municipality: string;
  line_id: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (station: Station) => void;
  currentStationId?: number | null;
}

export function StationPicker({ visible, onClose, onSelect, currentStationId }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get<Line[]>('/lines')
      .then((r) => setLines(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  useEffect(() => {
    if (!selectedLine) { setStations([]); return; }
    setLoading(true);
    api.get<Station[]>('/stations', { params: { line_id: selectedLine.id } })
      .then((r) => setStations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLine]);

  const filteredStations = stations.filter((s) =>
    s.name.includes(search) || s.municipality.includes(search)
  );

  const handleClose = () => {
    setSelectedLine(null);
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose} accessibilityViewIsModal>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {selectedLine ? selectedLine.name : '路線を選択'}
          </Text>
          <Pressable onPress={handleClose} accessibilityLabel="閉じる" accessibilityRole="button">
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 24 }} />}

        {!selectedLine ? (
          <FlatList
            data={lines}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => setSelectedLine(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <Text style={styles.rowText}>{item.name}</Text>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <>
            <Pressable style={styles.backBtn} onPress={() => { setSelectedLine(null); setSearch(''); }}>
              <Text style={styles.backText}>‹ 路線一覧に戻る</Text>
            </Pressable>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="駅名・市区町村で検索"
              accessibilityLabel="駅名・市区町村で検索"
              clearButtonMode="while-editing"
            />
            <FlatList
              data={filteredStations}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, item.id === currentStationId && styles.rowSelected]}
                  onPress={() => { onSelect(item); handleClose(); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}駅（${item.municipality}）`}
                  accessibilityState={{ selected: item.id === currentStationId }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowText, item.id === currentStationId && styles.rowTextSelected]}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowSub}>{item.municipality}</Text>
                  </View>
                  {item.id === currentStationId && <Text style={styles.check}>✓</Text>}
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                !loading ? <Text style={styles.empty}>駅が見つかりませんでした</Text> : null
              }
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { fontSize: 20, color: '#9ca3af', padding: 4 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  backText: { color: '#3b82f6', fontSize: 14 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#f9fafb',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowSelected: { backgroundColor: '#eff6ff' },
  rowText: { fontSize: 16, color: '#1f2937', flex: 1 },
  rowTextSelected: { color: '#2563eb', fontWeight: '600' },
  rowSub: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  check: { color: '#2563eb', fontSize: 18 },
  arrow: { fontSize: 20, color: '#d1d5db' },
  separator: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 20 },
  empty: { textAlign: 'center', marginTop: 40, color: '#9ca3af' },
});
