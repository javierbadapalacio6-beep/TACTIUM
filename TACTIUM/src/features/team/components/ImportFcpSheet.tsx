import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { BottomSheet } from '@components/ui';
import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  searchFcpTeams,
  fetchFcpRoster,
  type FcpTeam,
  type FcpPlayer,
  type FcpGender,
} from '@core/federation/cantabra';
import type { ScannedPlayer } from '@core/services/imageRecognition';

interface Props {
  open: boolean;
  onClose: () => void;
  // Mismo contrato que el escaneo de ranking: el caller hace el upsert.
  onImport: (scanned: ScannedPlayer[]) => Promise<void> | void;
}

export const ImportFcpSheet: React.FC<Props> = ({ open, onClose, onImport }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [gender, setGender] = useState<FcpGender>('M');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FcpTeam[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FcpTeam | null>(null);
  const [roster, setRoster] = useState<FcpPlayer[] | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setGender('M');
      setQuery('');
      setResults([]);
      setSelected(null);
      setRoster(null);
      setError(null);
    }
  }, [open]);

  // Búsqueda con debounce (no mientras hay equipo seleccionado).
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selected) return;
    if (tRef.current) clearTimeout(tRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    tRef.current = setTimeout(async () => {
      try {
        setResults(await searchFcpTeams(q, gender));
        setError(null);
      } catch (e) {
        setError((e as { message?: string })?.message ?? 'Error al buscar.');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [query, gender, selected]);

  const changeGender = (g: FcpGender) => {
    setGender(g);
    setSelected(null);
    setRoster(null);
    setResults([]);
  };

  const selectTeam = async (t: FcpTeam) => {
    setSelected(t);
    setRoster(null);
    setLoadingRoster(true);
    setError(null);
    try {
      setRoster(await fetchFcpRoster(t.idEquipo));
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Error al cargar.');
    } finally {
      setLoadingRoster(false);
    }
  };

  const confirmImport = async () => {
    if (!roster?.length || importing) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(roster.map((p) => ({ name: p.name, pts: p.pts })));
      onClose();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'No se pudo importar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        selected && roster && roster.length ? (
          <Pressable
            disabled={importing}
            onPress={confirmImport}
            style={({ pressed }) => [
              styles.cta,
              importing && { opacity: 0.5 },
              pressed && !importing && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaText}>
              {importing
                ? 'Importando…'
                : `Importar ${roster.length} ${roster.length === 1 ? 'jugador' : 'jugadores'}`}
            </Text>
          </Pressable>
        ) : undefined
      }
    >
      <Text style={styles.eyebrow}>FEDERACIÓN CÁNTABRA</Text>
      <Text style={styles.title} numberOfLines={1}>
        {selected ? selected.nombre : 'Importar plantilla'}
      </Text>
      {selected?.grupo ? (
        <Text style={styles.subtitle}>{selected.grupo}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!selected ? (
        <>
          {/* Selector de género */}
          <View style={styles.genderRow}>
            {(
              [
                ['M', 'Masculino'],
                ['F', 'Femenino'],
              ] as const
            ).map(([g, label]) => {
              const sel = gender === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => changeGender(g)}
                  style={[styles.genderBtn, sel && styles.genderBtnActive]}
                >
                  <Text
                    style={[
                      styles.genderText,
                      { color: sel ? '#000' : c.textMuted },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.help}>
            Busca tu equipo y vuelca su plantilla con los puntos oficiales.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="characters"
            placeholder="Nombre del equipo (p.ej. MEDIO CUDEYO A)"
            placeholderTextColor={c.textFaint}
            style={styles.input}
          />
          {searching ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 16 }} />
          ) : null}
          <ScrollView
            style={{ maxHeight: 300, marginTop: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {results.map((t) => (
              <Pressable
                key={t.idEquipo}
                onPress={() => selectTeam(t)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {t.nombre}
                  </Text>
                  {t.grupo ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {t.grupo}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.rowArrow}>→</Text>
              </Pressable>
            ))}
            {!searching && query.trim().length >= 2 && results.length === 0 ? (
              <Text style={styles.help}>Sin resultados. Prueba otro nombre.</Text>
            ) : null}
          </ScrollView>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => {
              setSelected(null);
              setRoster(null);
            }}
            hitSlop={8}
            style={{ marginTop: 4, marginBottom: 10 }}
          >
            <Text style={styles.back}>← Cambiar de equipo</Text>
          </Pressable>

          {loadingRoster ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 16 }} />
          ) : roster && roster.length ? (
            <>
              <Text style={styles.help}>
                {roster.length} jugadores. Se añaden con sus puntos; los que ya
                tengas (por nombre) se actualizan.
              </Text>
              <ScrollView style={{ maxHeight: 300, marginTop: 8 }}>
                {roster.map((p, i) => (
                  <View key={`${p.name}-${i}`} style={styles.prow}>
                    <Text style={styles.pname} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.ppts}>{p.pts}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.help}>
              Este equipo no tiene plantilla publicada en la federación.
            </Text>
          )}
        </>
      )}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: c.accent,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
  },
  subtitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textMuted,
    marginTop: 4,
    marginBottom: 4,
  },
  help: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
    marginBottom: 4,
    marginTop: 8,
  },
  error: {
    fontSize: 13,
    color: c.error,
    marginTop: 8,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: Radius.md,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
    marginTop: 12,
  },
  genderBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: { backgroundColor: c.accent },
  genderText: { fontSize: 14, fontWeight: '700' },
  input: {
    marginTop: 10,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    color: c.text,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    marginBottom: 8,
  },
  rowName: { color: c.text, fontSize: 15, fontWeight: '600' },
  rowSub: {
    color: c.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    marginTop: 2,
  },
  rowArrow: { color: c.accent, fontSize: 16, marginLeft: 8 },
  back: { color: c.textMuted, fontFamily: Fonts.mono, fontSize: 12 },
  prow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
  },
  pname: { flex: 1, color: c.text, fontSize: 14 },
  ppts: {
    color: c.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 12,
    marginLeft: 8,
  },
  cta: {
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
});
