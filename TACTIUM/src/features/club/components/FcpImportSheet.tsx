import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import { useTeamStore } from '@store/teamStore';
import {
  searchFcpClubs,
  importFcpTeams,
  type FcpClubGroup,
  type FcpTeamOption,
} from '@core/services/fcpOnboarding';

/**
 * Onboarding de club federado (Federación Cántabra): busca el club en el
 * catálogo federativo, elige sus equipos y los crea en TACTIUM con la plantilla
 * real (nombre + puntos) volcada. Ver F1 del plan.
 */
export const FcpImportSheet: React.FC<{
  open: boolean;
  clubId: string | null; // null = equipo(s) independiente(s), sin club
  onClose: () => void;
  onImported?: (teams: number, players: number) => void;
}> = ({ open, clubId, onClose, onImported }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const loadForUser = useTeamStore((s) => s.loadForUser);

  const [loading, setLoading] = useState(false);
  const [allGroups, setAllGroups] = useState<FcpClubGroup[]>([]);
  const [query, setQuery] = useState('');
  const [activeClub, setActiveClub] = useState<FcpClubGroup | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  // Carga todo el catálogo una vez al abrir; el filtro es local.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveClub(null);
    setSelected(new Set());
    setLoading(true);
    searchFcpClubs('')
      .then(setAllGroups)
      .catch((e) => toast.error('No se pudo cargar el catálogo', e?.message ?? ''))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter(
      (g) =>
        g.club.toLowerCase().includes(q) ||
        g.teams.some((t) => t.equipo.toLowerCase().includes(q)),
    );
  }, [allGroups, query]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectedOptions: FcpTeamOption[] = useMemo(() => {
    if (!activeClub) return [];
    return activeClub.teams.filter((t) => selected.has(t.id_equipo));
  }, [activeClub, selected]);

  const doImport = async () => {
    if (!selectedOptions.length) return;
    setImporting(true);
    try {
      const res = await importFcpTeams(clubId, selectedOptions);
      const players = res.reduce((n, r) => n + r.players, 0);
      await loadForUser();
      toast.success(
        '¡Equipos importados!',
        `${res.length} ${res.length === 1 ? 'equipo' : 'equipos'} · ${players} jugadores.`,
      );
      onImported?.(res.length, players);
      onClose();
    } catch (e: any) {
      toast.error('No se pudieron importar', e?.message ?? '');
    } finally {
      setImporting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        activeClub && selectedOptions.length ? (
          <Pressable
            onPress={doImport}
            disabled={importing}
            style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.85 }]}
          >
            {importing ? (
              <ActivityIndicator size="small" color={c.textInverse} />
            ) : (
              <Text style={styles.importBtnText}>
                Importar {selectedOptions.length}{' '}
                {selectedOptions.length === 1 ? 'equipo' : 'equipos'}
              </Text>
            )}
          </Pressable>
        ) : undefined
      }
    >
      <Text style={styles.eyebrow}>FEDERACIÓN CÁNTABRA</Text>
      <Text style={styles.title}>
        {activeClub ? activeClub.club : 'Importa tu club'}
      </Text>

      {activeClub ? (
        <>
          <Text style={styles.sub}>
            Marca los equipos a crear. Se volcará la plantilla real de cada uno con
            sus puntos.
          </Text>
          <Pressable onPress={() => setActiveClub(null)} hitSlop={6} style={{ marginTop: 8 }}>
            <Text style={styles.back}>‹ Elegir otro club</Text>
          </Pressable>
          <View style={{ gap: 8, marginTop: 12 }}>
            {activeClub.teams.map((t) => {
              const on = selected.has(t.id_equipo);
              return (
                <Pressable
                  key={t.id_equipo}
                  onPress={() => toggle(t.id_equipo)}
                  style={[styles.teamRow, on && { borderColor: c.accent, backgroundColor: c.accent10 }]}
                >
                  <View style={[styles.check, on && { backgroundColor: c.accent, borderColor: c.accent }]}>
                    {on ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.teamName} numberOfLines={1}>{t.equipo}</Text>
                    <Text style={styles.teamMeta} numberOfLines={1}>
                      {t.gender === 'femenino' ? 'Femenino' : 'Masculino'}
                      {t.category ? ` · ${t.category}` : ''}
                      {t.grupo ? ` · ${t.grupo}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <View style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Busca tu club (p. ej. Central Padel)"
              placeholderTextColor={c.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          {loading ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>
              {allGroups.length === 0
                ? 'Aún no hay datos de la Federación cargados. Se sincronizan aparte; inténtalo más tarde o crea el club a mano.'
                : 'Sin resultados. Prueba otro nombre o crea el club a mano.'}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 360, marginTop: 10 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {filtered.map((g) => (
                  <Pressable
                    key={g.club}
                    onPress={() => {
                      setActiveClub(g);
                      setSelected(new Set(g.teams.map((t) => t.id_equipo)));
                    }}
                    style={({ pressed }) => [styles.clubRow, pressed && { opacity: 0.85 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.clubName} numberOfLines={1}>{g.club}</Text>
                      <Text style={styles.teamMeta}>
                        {g.teams.length} {g.teams.length === 1 ? 'equipo' : 'equipos'}
                      </Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </>
      )}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
    sub: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
    back: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
    searchBox: {
      marginTop: 14,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    searchInput: { color: c.text, fontSize: 15, paddingVertical: 13 },
    empty: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 18 },
    clubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    clubName: { color: c.text, fontSize: 15, fontWeight: '700' },
    chev: { color: c.textFaint, fontSize: 20, fontWeight: '700' },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    teamName: { color: c.text, fontSize: 15, fontWeight: '700' },
    teamMeta: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkMark: { color: c.textInverse, fontSize: 14, fontWeight: '900' },
    importBtn: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    importBtnText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
  });
