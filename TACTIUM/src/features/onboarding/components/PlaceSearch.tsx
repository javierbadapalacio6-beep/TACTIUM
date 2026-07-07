import React, { useEffect, useRef, useState } from 'react';
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
import { searchPlaces, type PlaceResult } from '@core/services/venues';

// Buscador de ubicación en vivo (Google Places vía edge function). El club
// escribe su nombre y elige su ficha real → dirección + coords + web se
// rellenan solas. Usado en el alta de sede y (opcional) en la sede habitual.
export const PlaceSearch: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (place: PlaceResult) => void;
  title?: string;
}> = ({ open, onClose, onSelect, title = 'Busca tu club' }) => {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setErrored(false);
      return;
    }
    let alive = true;
    const mine = ++reqId.current;
    setLoading(true);
    setErrored(false);
    // Debounce alto: cada llamada cuesta (API de pago). 450ms.
    const t = setTimeout(() => {
      searchPlaces(term)
        .then((r) => {
          if (!alive || mine !== reqId.current) return;
          setResults(r);
        })
        .catch(() => {
          if (!alive || mine !== reqId.current) return;
          setResults([]);
          setErrored(true);
        })
        .finally(() => {
          if (alive && mine === reqId.current) setLoading(false);
        });
    }, 450);
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
            placeholder="Nombre del club… (ej. Smash Padel Santander)"
            placeholderTextColor={Colors.textFaint}
            autoFocus
            autoCorrect={false}
          />
          {loading ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <IconX size={14} color={Colors.textFaint} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={results}
          keyExtractor={(p) => p.placeId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTxt}>
                {q.trim().length < 2
                  ? 'Escribe el nombre de tu club para buscarlo en el mapa.'
                  : errored
                    ? 'No se pudo buscar ahora mismo. Inténtalo de nuevo.'
                    : loading
                      ? 'Buscando…'
                      : 'Sin resultados. Prueba con otro nombre o añade la ciudad.'}
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
                  {item.address ??
                    [item.city, item.province].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          )}
        />
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
  emptyTxt: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
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
