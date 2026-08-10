import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconChevron } from '@components/ui';
import { toast } from '@store/toastStore';
import {
  getFcpIdEquipo,
  fetchFcpGroupStandings,
  fetchFcpGroupSchedule,
  fetchFcpRivalRoster,
  fetchFcpActa,
  importFcpSeason,
  type FcpStandingRow,
  type FcpScheduleRow,
  type FcpRivalPlayer,
  type FcpActaPartido,
} from '@core/services/fcpSeason';

type Tab = 'clasif' | 'jornadas';

/**
 * "Mi grupo" (Federación): vuelca la temporada (calendario + resultados) y
 * muestra en dos pestañas la CLASIFICACIÓN del grupo (con ficha read-only de
 * cada rival) y las JORNADAS del grupo. Ver Nivel 1 del plan. El detalle de
 * parejas + parciales por set (acta) llegará en la Entrega 2.
 */
export const FcpGroupSheet: React.FC<{
  open: boolean;
  teamId: string;
  teamName?: string | null;
  onClose: () => void;
  onImported?: () => void;
}> = ({ open, teamId, onClose, onImported }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [tab, setTab] = useState<Tab>('clasif');
  const [loading, setLoading] = useState(false);
  const [fcpId, setFcpId] = useState<number | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [rows, setRows] = useState<FcpStandingRow[]>([]);
  const [schedule, setSchedule] = useState<FcpScheduleRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rosters, setRosters] = useState<Record<number, FcpRivalPlayer[]>>({});
  const [loadingRoster, setLoadingRoster] = useState<number | null>(null);
  const [openActa, setOpenActa] = useState<string | null>(null);
  const [actas, setActas] = useState<Record<string, FcpActaPartido[]>>({});
  const [loadingActa, setLoadingActa] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const id = await getFcpIdEquipo(teamId);
      setFcpId(id);
      if (id == null) {
        setRows([]);
        setSchedule([]);
        setGrupo(null);
        return;
      }
      const [stand, sched] = await Promise.all([
        fetchFcpGroupStandings(id),
        fetchFcpGroupSchedule(id),
      ]);
      setGrupo(stand.grupo ?? sched.grupo);
      setRows(stand.rows);
      setSchedule(sched.rows);
    } catch (e: any) {
      toast.error('No se pudo cargar el grupo', e?.message ?? '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab('clasif');
    setExpanded(null);
    setRosters({});
    setOpenActa(null);
    setActas({});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teamId]);

  const toggleRival = async (idEquipo: number | null) => {
    if (idEquipo == null) return;
    if (expanded === idEquipo) {
      setExpanded(null);
      return;
    }
    setExpanded(idEquipo);
    if (!rosters[idEquipo]) {
      setLoadingRoster(idEquipo);
      try {
        const roster = await fetchFcpRivalRoster(idEquipo);
        setRosters((prev) => ({ ...prev, [idEquipo]: roster }));
      } catch (e: any) {
        toast.error('No se pudo cargar la plantilla', e?.message ?? '');
      } finally {
        setLoadingRoster(null);
      }
    }
  };

  const toggleActa = async (idPartido: string) => {
    if (openActa === idPartido) {
      setOpenActa(null);
      return;
    }
    setOpenActa(idPartido);
    if (!actas[idPartido]) {
      setLoadingActa(idPartido);
      try {
        const rows = await fetchFcpActa(idPartido);
        setActas((prev) => ({ ...prev, [idPartido]: rows }));
      } catch {
        setActas((prev) => ({ ...prev, [idPartido]: [] }));
      } finally {
        setLoadingActa(null);
      }
    }
  };

  const doImport = async () => {
    if (fcpId == null) return;
    setImporting(true);
    try {
      const res = await importFcpSeason(teamId, fcpId, 'Liga Cántabra');
      toast.success(
        'Temporada volcada',
        `${res.created} jornadas creadas${res.updated ? ` · ${res.updated} actualizadas` : ''}.`,
      );
      onImported?.();
    } catch (e: any) {
      toast.error('No se pudo volcar la temporada', e?.message ?? '');
    } finally {
      setImporting(false);
    }
  };

  // Jornadas agrupadas por número de jornada.
  const jornadas = useMemo(() => {
    const byJ = new Map<number, FcpScheduleRow[]>();
    for (const r of schedule) {
      const j = r.jornada ?? 0;
      if (!byJ.has(j)) byJ.set(j, []);
      byJ.get(j)!.push(r);
    }
    return Array.from(byJ.entries()).sort((a, b) => a[0] - b[0]);
  }, [schedule]);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>FEDERACIÓN · MI GRUPO</Text>
      <Text style={styles.title} numberOfLines={2}>{grupo ?? 'Mi grupo'}</Text>

      {loading ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : fcpId == null ? (
        <Text style={styles.empty}>
          Este equipo no está vinculado a la Federación. Impórtalo primero desde la
          Federación Cántabra.
        </Text>
      ) : (
        <>
          <Pressable
            onPress={doImport}
            disabled={importing}
            style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.9 }]}
          >
            {importing ? (
              <ActivityIndicator size="small" color={c.textInverse} />
            ) : (
              <>
                <Text style={styles.importBtnText}>Volcar temporada (calendario + resultados)</Text>
                <Text style={styles.importBtnSub}>
                  Crea las jornadas con su rival, local/visitante, marcador y fecha.
                </Text>
              </>
            )}
          </Pressable>

          {/* Pestañas */}
          <View style={styles.tabs}>
            {(
              [
                ['clasif', 'Clasificación'],
                ['jornadas', 'Jornadas'],
              ] as [Tab, string][]
            ).map(([key, label]) => {
              const on = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'clasif' ? (
            <>
              <Text style={styles.hint}>Toca un rival para ver su plantilla</Text>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 6 }}>
                  {rows.map((t) => {
                    const sd = (t.sets_favor ?? 0) - (t.sets_contra ?? 0);
                    const isOpen = expanded === t.id_equipo;
                    return (
                      <View key={`${t.id_equipo}-${t.equipo}`}>
                        <Pressable
                          onPress={() => (t.isMe ? undefined : toggleRival(t.id_equipo))}
                          style={[styles.row, t.isMe && { borderColor: c.accent, backgroundColor: c.accent10 }]}
                        >
                          <Text style={[styles.pos, t.isMe && { color: c.accent }]}>{t.posicion ?? '–'}</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.rowName, t.isMe && { color: c.accent }]} numberOfLines={1}>
                              {t.equipo}
                            </Text>
                            <Text style={styles.rowMeta}>
                              {t.puntos ?? 0} pts · {t.pj} PJ · {t.pg} PG · sets {sd >= 0 ? `+${sd}` : sd}
                            </Text>
                          </View>
                          {!t.isMe ? <IconChevron size={14} color={c.textFaint} /> : null}
                        </Pressable>
                        {isOpen ? (
                          <View style={styles.rosterBox}>
                            {loadingRoster === t.id_equipo ? (
                              <ActivityIndicator color={c.accent} />
                            ) : (rosters[t.id_equipo ?? -1] ?? []).length === 0 ? (
                              <Text style={styles.rowMeta}>Sin plantilla registrada.</Text>
                            ) : (
                              (rosters[t.id_equipo ?? -1] ?? []).map((p, i) => (
                                <View key={i} style={styles.rosterRow}>
                                  <Text style={styles.rosterName} numberOfLines={1}>{p.name}</Text>
                                  <Text style={styles.rosterPts}>{p.puntos} pts</Text>
                                </View>
                              ))
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={styles.hint}>Calendario del grupo · tus partidos resaltados</Text>
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 14 }}>
                  {jornadas.length === 0 ? (
                    <Text style={styles.empty}>Aún no hay jornadas registradas para este grupo.</Text>
                  ) : (
                    jornadas.map(([j, partidos]) => (
                      <View key={j} style={{ gap: 6 }}>
                        <Text style={styles.jTitle}>JORNADA {j || '—'}</Text>
                        {partidos.map((p) => {
                          const mine = p.isMeLocal || p.isMeVisit;
                          const localWon = p.ganador === 'local';
                          const visitWon = p.ganador === 'visitante';
                          const played = !!p.resultado;
                          const isOpen = openActa === p.id_partido;
                          const acta = actas[p.id_partido] ?? [];
                          return (
                            <View key={p.id_partido}>
                              <Pressable
                                onPress={() => (played ? toggleActa(p.id_partido) : undefined)}
                                style={[styles.match, mine && { borderColor: c.accent, backgroundColor: c.accent10 }]}
                              >
                                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                  <Text
                                    style={[
                                      styles.team,
                                      p.isMeLocal && { color: c.accent, fontWeight: '800' },
                                      localWon && styles.teamWon,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {p.equipo_local || '—'}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.team,
                                      p.isMeVisit && { color: c.accent, fontWeight: '800' },
                                      visitWon && styles.teamWon,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {p.equipo_visit || '—'}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                  <Text style={styles.score}>
                                    {p.resultado ? p.resultado.replace('/', ' - ') : '· vs ·'}
                                  </Text>
                                  {p.fecha || p.hora ? (
                                    <Text style={styles.matchMeta}>
                                      {[fmtDate(p.fecha), p.hora].filter(Boolean).join(' · ')}
                                    </Text>
                                  ) : null}
                                </View>
                                {played ? (
                                  <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}>
                                    <IconChevron size={13} color={c.textFaint} />
                                  </View>
                                ) : null}
                              </Pressable>

                              {isOpen ? (
                                <View style={styles.actaBox}>
                                  {loadingActa === p.id_partido ? (
                                    <ActivityIndicator color={c.accent} />
                                  ) : acta.length === 0 ? (
                                    <Text style={styles.rowMeta}>
                                      Acta aún no disponible (se sincroniza con la Federación).
                                    </Text>
                                  ) : (
                                    acta.map((g) => {
                                      const lWon = g.ganador === 'local';
                                      const vWon = g.ganador === 'visitante';
                                      return (
                                        <View key={g.partido_num} style={styles.actaRow}>
                                          <Text style={styles.actaNum}>{g.partido_num}</Text>
                                          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                                            <Text
                                              style={[
                                                styles.actaPair,
                                                p.isMeLocal && styles.actaMine,
                                                lWon && { fontWeight: '800' },
                                              ]}
                                              numberOfLines={1}
                                            >
                                              {[g.local_j1, g.local_j2].filter(Boolean).join(' / ') || '—'}
                                            </Text>
                                            <Text
                                              style={[
                                                styles.actaPair,
                                                p.isMeVisit && styles.actaMine,
                                                vWon && { fontWeight: '800' },
                                              ]}
                                              numberOfLines={1}
                                            >
                                              {[g.visit_j1, g.visit_j2].filter(Boolean).join(' / ') || '—'}
                                            </Text>
                                          </View>
                                          <Text style={styles.actaScore}>
                                            {g.parciales || `${g.sets_local ?? 0}-${g.sets_visit ?? 0}`}
                                          </Text>
                                        </View>
                                      );
                                    })
                                  )}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
};

function fmtDate(d: string | null): string {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : d;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
    empty: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 18 },
    importBtn: {
      marginTop: 14,
      backgroundColor: c.accent,
      borderRadius: Radius.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    importBtnText: { color: c.textInverse, fontSize: 14.5, fontWeight: '800', textAlign: 'center' },
    importBtnSub: { color: c.textInverse, fontSize: 11.5, opacity: 0.85, marginTop: 3, textAlign: 'center' },
    tabs: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    tab: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center' },
    tabOn: { backgroundColor: c.accent },
    tabText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    tabTextOn: { color: c.textInverse },
    hint: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.6,
      color: c.textFaint,
      fontWeight: '500',
      marginTop: 16,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pos: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '800',
      width: 22,
      textAlign: 'center',
    },
    rowName: { color: c.text, fontSize: 14, fontWeight: '700' },
    rowMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2 },
    rosterBox: {
      marginTop: 4,
      marginLeft: 12,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: c.hairStrong,
      gap: 4,
      paddingVertical: 6,
    },
    rosterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rosterName: { flex: 1, color: c.text, fontSize: 13 },
    rosterPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 12, fontWeight: '700' },
    jTitle: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.4,
      color: c.textMuted,
      fontWeight: '700',
    },
    match: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    team: { color: c.text, fontSize: 13.5, fontWeight: '600' },
    teamWon: { fontWeight: '800' },
    score: { fontFamily: Fonts.mono, color: c.text, fontSize: 14, fontWeight: '800' },
    matchMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10.5 },
    actaBox: {
      marginTop: 4,
      marginLeft: 10,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: c.accent,
      gap: 8,
      paddingVertical: 8,
    },
    actaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    actaNum: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '800',
      width: 16,
      textAlign: 'center',
    },
    actaPair: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    actaMine: { color: c.text },
    actaScore: { fontFamily: Fonts.mono, color: c.text, fontSize: 12, fontWeight: '700' },
  });
