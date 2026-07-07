import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconSearch, IconX, IconPin } from '@components/ui/Icon';
import { searchVenues, type Venue } from '@core/services/venues';

// Buscador del directorio de clubes/sedes. Usado en el alta de perfil (sede
// habitual) y en el alta de sede (reclamar tu club).
export const VenuePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (venue: Venue) => void;
  title?: string;
}> = ({ open, onClose, onSelect, title = 'Elige tu club' }) => {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchVenues(q)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <IconX size={16} color={Colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <IconSearch size={16} color={Colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="Busca por nombre o ciudad…"
            placeholderTextColor={Colors.textFaint}
            autoFocus
            autoCorrect={false}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <IconX size={14} color={Colors.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {loading && results.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(v) => v.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTxt}>
                  Sin resultados. Prueba con otro nombre o ciudad.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <IconPin size={16} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[item.city, item.province].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  center: { paddingTop: 50, alignItems: 'center', paddingHorizontal: 30 },
  emptyTxt: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hair,
  },
  rowName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Colors.textMuted, fontSize: 12, fontFamily: Fonts.mono, marginTop: 2 },
});
