import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import { useTeamStore } from '@store/teamStore';
import {
  searchFcpClubs,
  importFcpTeams,
  fetchUnlinkedClubTeams,
  type FcpClubGroup,
  type FcpTeamOption,
  type UnlinkedTeam,
  type FcpImportMode,
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
  // Cada equipo marcado lleva SU papel: del club o invitado. Antes el modo era
  // global y excluyente, así que no se podían dar de alta los dos de una vez.
  const [selected, setSelected] = useState<Map<number, FcpImportMode>>(new Map());
  const [importing, setImporting] = useState(false);
  // Sin club (capitán independiente) = gestiona UN solo equipo → selección
  // única (radio). Con club, multi-selección para volcar todos sus equipos.
  const single = clubId === null;
  // Equipos DEL club vs equipos INVITADOS (juegan en sus pistas con otro
  // nombre): de estos solo se gestiona el horario, no consumen cuota del plan y
  // no se les vuelca la plantilla.
  const guestCount = useMemo(
    () => [...selected.values()].filter((m) => m === 'venue').length,
    [selected],
  );

  // Carga todo el catálogo una vez al abrir; el filtro es local.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveClub(null);
    setSelected(new Map());
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
      if (single) {
        // Selección única: tocar un equipo deja SOLO ese; re-tocarlo lo quita.
        return prev.has(id) ? new Map() : new Map([[id, 'owned' as FcpImportMode]]);
      }
      const n = new Map(prev);
      if (n.has(id)) n.delete(id);
      else n.set(id, 'owned');
      return n;
    });

  /** Cambia el papel de un equipo ya marcado (del club ↔ invitado). */
  const setTeamMode = (id: number, m: FcpImportMode) =>
    setSelected((prev) => {
      const n = new Map(prev);
      n.set(id, m);
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
      // Anti-duplicados: si el usuario ya creó equipos a mano, para cada equipo
      // federado con un candidato SIN vincular (mismo género + categoría) le
      // preguntamos si es el mismo → sustituir (vincular + volcar) o crear nuevo.
      const reuse: Record<number, string> = {};
      let candidates: UnlinkedTeam[] = [];
      try {
        candidates = await fetchUnlinkedClubTeams(clubId);
      } catch {
        candidates = [];
      }
      const used = new Set<string>();
      for (const opt of selectedOptions) {
        // Candidatos por género + categoría (sin vincular y no usados ya).
        const pool = candidates.filter(
          (t) =>
            !used.has(t.id) &&
            (t.gender ?? '') === opt.gender &&
            (t.category ?? '') === (opt.category ?? ''),
        );
        if (!pool.length) continue;
        // Si varios coinciden, prefiere aquel cuyo grupo (letra) aparezca en el
        // nombre del grupo federativo — desambigua "A" vs "B" del mismo nivel.
        const fedGroup = (opt.grupo ?? '').toUpperCase();
        const match =
          pool.find((t) => t.group && fedGroup.includes(t.group.toUpperCase())) ??
          pool[0];
        const yourGroup = match.group ? ` · Grupo ${match.group}` : '';
        const fedInfo = [opt.category, opt.grupo].filter(Boolean).join(' · ');
        const decision = await new Promise<'reuse' | 'new'>((resolve) => {
          Alert.alert(
            'Ya tienes un equipo parecido',
            `Tu equipo (a mano):\n"${match.name}"${yourGroup}\n\nEquipo federado:\n"${opt.equipo}"${fedInfo ? `\n${fedInfo}` : ''}\n\n¿Es el mismo?\n· Sustituir: le vuelco la plantilla y los resultados oficiales (no se duplica).\n· Crear nuevo: lo dejo como está y creo otro equipo.`,
            [
              { text: 'Crear nuevo', style: 'cancel', onPress: () => resolve('new') },
              { text: 'Sustituir', onPress: () => resolve('reuse') },
            ],
            { cancelable: false },
          );
        });
        if (decision === 'reuse') {
          reuse[opt.id_equipo] = match.id;
          used.add(match.id);
        }
      }

      // Los del club y los invitados van en pasadas distintas: cada uno se da
      // de alta de una forma (plantilla volcada vs solo sede).
      const own = selectedOptions.filter((t) => selected.get(t.id_equipo) !== 'venue');
      const guests = selectedOptions.filter((t) => selected.get(t.id_equipo) === 'venue');
      const res = [
        ...(own.length ? await importFcpTeams(clubId, own, reuse, 'owned') : []),
        ...(guests.length ? await importFcpTeams(clubId, guests, reuse, 'venue') : []),
      ];
      const players = res.reduce((n, r) => n + r.players, 0);
      await loadForUser();
      const parts: string[] = [];
      if (own.length) parts.push(`${own.length} de tu club · ${players} jugadores`);
      if (guests.length) parts.push(`${guests.length} invitado${guests.length === 1 ? '' : 's'} · ya puedes ponerles horario`);
      toast.success('¡Equipos añadidos!', parts.join(' · '));
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
        {activeClub
          ? activeClub.club
          : single
            ? 'Importa tu equipo'
            : 'Importa tu club'}
      </Text>

      {activeClub ? (
        <>
          <Text style={styles.sub}>
            {single
              ? 'Elige tu equipo. Se volcará su plantilla real con los puntos oficiales.'
              : 'Marca los equipos y di de cada uno si es de tu club o solo juega en tus pistas. Puedes mezclar los dos.'}
          </Text>
          <Pressable onPress={() => setActiveClub(null)} hitSlop={6} style={{ marginTop: 8 }}>
            <Text style={styles.back}>‹ Elegir otro club</Text>
          </Pressable>
          <Text style={styles.hint}>
            ¿Falta algún equipo tuyo? La Federación a veces registra el mismo club
            con nombres distintos. Vuelve atrás, elige el otro nombre e impórtalos
            también: se suman a los que ya tienes, no se duplican.
          </Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            {activeClub.teams.map((t) => {
              const teamMode = selected.get(t.id_equipo);
              const on = teamMode !== undefined;
              return (
                <View key={t.id_equipo}>
                  <Pressable
                    onPress={() => toggle(t.id_equipo)}
                    style={[styles.teamRow, on && { borderColor: c.accent, backgroundColor: c.accent10 }]}
                  >
                    <View style={[styles.check, single && styles.checkRadio, on && { backgroundColor: c.accent, borderColor: c.accent }]}>
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
                  {on && !single ? (
                    <View style={styles.roleRow}>
                      {(
                        [
                          { id: 'owned', label: 'De mi club' },
                          { id: 'venue', label: 'Solo juega aquí' },
                        ] as { id: FcpImportMode; label: string }[]
                      ).map((r) => {
                        const sel = teamMode === r.id;
                        return (
                          <Pressable
                            key={r.id}
                            onPress={() => setTeamMode(t.id_equipo, r.id)}
                            style={[
                              styles.roleChip,
                              sel && { backgroundColor: c.accent, borderColor: c.accent },
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleChipText,
                                { color: sel ? c.textInverse : c.textMuted },
                              ]}
                            >
                              {r.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {guestCount > 0 ? (
              <Text style={styles.hint}>
                De los marcados como «solo juega aquí» únicamente gestionarás el
                horario: ni plantilla, ni alineaciones. No gastan plaza de tu plan
                y su capitán puede quedarse con el equipo cuando entre.
              </Text>
            ) : null}
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
                      // Club: pre-marca todos sus equipos. Independiente: ninguno,
                      // el capitán elige el suyo (selección única).
                      setSelected(
                        single
                          ? new Map()
                          : new Map(
                              g.teams.map(
                                (t) => [t.id_equipo, 'owned' as FcpImportMode] as const,
                              ),
                            ),
                      );
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
    hint: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginTop: 10 },
    roleRow: { flexDirection: 'row', gap: 6, marginTop: 6, marginLeft: 34 },
    roleChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hair,
    },
    roleChipText: { fontSize: 11.5, fontWeight: '700' },
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
    checkRadio: { borderRadius: 12 },
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
