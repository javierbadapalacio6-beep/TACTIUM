import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron, IconCheck } from '@components/ui';
import {
  fetchGroupStandings,
  fetchGroupSchedule,
  type FcpBrowseStanding,
  type FcpBrowseMatch,
} from '@core/services/fcpBrowse';
import { fetchFcpActa, type FcpActaPartido } from '@core/services/fcpSeason';
import { FcpBracketView } from '../components/FcpBracketView';
import type { SeasonsStackScreenProps } from '@navigation/types';

const MEDAL: Record<number, string> = { 1: '#E7B93E', 2: '#AEB7C2', 3: '#CD7F45' };
type Tab = 'clasif' | 'jornadas' | 'cuadro';

export const FcpGroupScreen = ({ navigation, route }: SeasonsStackScreenProps<'FcpGroup'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { idGrupo, nombre } = route.params;
  const esPlayoff = /^fase/i.test(idGrupo);

  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<string | null>(nombre ?? null);
  const [rows, setRows] = useState<FcpBrowseStanding[]>([]);
  const [schedule, setSchedule] = useState<FcpBrowseMatch[]>([]);
  const [tab, setTab] = useState<Tab>(esPlayoff ? 'cuadro' : 'clasif');
  const [selJ, setSelJ] = useState<number | null>(null);
  const [openActa, setOpenActa] = useState<string | null>(null);
  const [actas, setActas] = useState<Record<string, FcpActaPartido[]>>({});
  const [loadingActa, setLoadingActa] = useState<string | null>(null);

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

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchGroupStandings(idGrupo), fetchGroupSchedule(idGrupo)])
      .then(([st, sc]) => {
        if (!alive) return;
        setGrupo(st.nombre ?? nombre ?? null);
        setRows(st.rows);
        setSchedule(sc);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idGrupo, nombre]);

  const jornadas = useMemo(() => {
    const byJ = new Map<number, FcpBrowseMatch[]>();
    for (const m of schedule) {
      const j = m.jornada ?? 0;
      if (!byJ.has(j)) byJ.set(j, []);
      byJ.get(j)!.push(m);
    }
    return Array.from(byJ.entries()).sort((a, b) => a[0] - b[0]);
  }, [schedule]);

  const jNums = useMemo(() => jornadas.map(([j]) => j), [jornadas]);
  // Por defecto, la última jornada con resultado (la "actual").
  useEffect(() => {
    if (jNums.length === 0) {
      setSelJ(null);
      return;
    }
    const played = schedule.filter((m) => m.resultado).map((m) => m.jornada ?? 0);
    setSelJ(played.length ? Math.max(...played) : jNums[0]);
  }, [jNums, schedule]);
  const selIdx = selJ != null ? jNums.indexOf(selJ) : -1;
  const selMatches = selIdx >= 0 ? jornadas[selIdx][1] : [];

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.navBtnLabel}>Federación</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} numberOfLines={3}>{grupo ?? 'Grupo'}</Text>

        <View style={styles.tabs}>
          {(
            (esPlayoff
              ? [
                  ['cuadro', 'Cuadro'],
                  ['clasif', 'Clasificación'],
                  ['jornadas', 'Jornadas'],
                ]
              : [
                  ['clasif', 'Clasificación'],
                  ['jornadas', 'Jornadas'],
                ]) as [Tab, string][]
          ).map(([key, label]) => {
            const on = tab === key;
            return (
              <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : tab === 'cuadro' ? (
          <FcpBracketView idGrupo={idGrupo} />
        ) : tab === 'clasif' ? (
          rows.length === 0 ? (
            <Text style={styles.empty}>Sin clasificación disponible.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {rows.map((t) => {
                const sd = (t.setsFavor ?? 0) - (t.setsContra ?? 0);
                const medal = t.posicion ? MEDAL[t.posicion] : undefined;
                return (
                  <Pressable
                    key={`${t.idEquipo}-${t.equipo}`}
                    onPress={() =>
                      t.idEquipo != null
                        ? navigation.navigate('FcpTeam', { idEquipo: t.idEquipo, name: t.equipo })
                        : undefined
                    }
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                  >
                    <View
                      style={[
                        styles.posBadge,
                        medal ? { backgroundColor: medal + '22', borderColor: medal + '66' } : null,
                      ]}
                    >
                      <Text style={[styles.posText, medal ? { color: medal } : null]}>
                        {t.posicion ?? '–'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{t.equipo}</Text>
                      <Text style={styles.rowMeta}>
                        {t.pj} PJ · {t.pg} PG · sets {sd >= 0 ? `+${sd}` : sd}
                      </Text>
                    </View>
                    <View style={styles.ptsCol}>
                      <Text style={styles.ptsNum}>{t.puntos ?? 0}</Text>
                      <Text style={styles.ptsLabel}>PTS</Text>
                    </View>
                    <IconChevron size={14} color={c.textFaint} />
                  </Pressable>
                );
              })}
            </View>
          )
        ) : jNums.length === 0 ? (
          <Text style={styles.empty}>Sin jornadas registradas.</Text>
        ) : (
          <View>
            {/* Navegador de jornada (prev / actual / next) */}
            <View style={styles.jNav}>
              <Pressable
                disabled={selIdx <= 0}
                onPress={() => setSelJ(jNums[selIdx - 1])}
                hitSlop={8}
                style={({ pressed }) => [styles.jArrow, selIdx <= 0 && { opacity: 0.25 }, pressed && { opacity: 0.6 }]}
              >
                <View style={{ transform: [{ rotate: '180deg' }] }}>
                  <IconChevron size={18} color={c.text} />
                </View>
              </Pressable>
              <Text style={styles.jNavTitle}>Jornada {selJ ?? '—'}</Text>
              <Pressable
                disabled={selIdx >= jNums.length - 1}
                onPress={() => setSelJ(jNums[selIdx + 1])}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.jArrow,
                  selIdx >= jNums.length - 1 && { opacity: 0.25 },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <IconChevron size={18} color={c.text} />
              </Pressable>
            </View>

            {/* Tira de jornadas navegable */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 2, paddingHorizontal: 2 }}
              style={{ marginBottom: 16 }}
            >
              {jNums.map((j) => {
                const on = j === selJ;
                return (
                  <Pressable key={j} onPress={() => setSelJ(j)} style={[styles.jPill, on && styles.jPillOn]}>
                    <Text style={[styles.jPillText, on && styles.jPillTextOn]}>{j || '—'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Partidos de la jornada · ganador resaltado · toca para ver el acta */}
            <View style={{ gap: 6 }}>
              {selMatches.map((p, i) => {
                const localWon = p.ganador === 'local';
                const visitWon = p.ganador === 'visitante';
                const played = !!p.resultado;
                const isOpen = openActa === p.idPartido;
                const acta = actas[p.idPartido] ?? [];
                return (
                  <View key={p.idPartido || i}>
                    <Pressable
                      onPress={() => (played ? toggleActa(p.idPartido) : undefined)}
                      style={({ pressed }) => [
                        styles.match,
                        isOpen && { borderColor: c.accent, backgroundColor: c.accent10 },
                        pressed && played && { opacity: 0.85 },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <View style={styles.teamLine}>
                          {localWon ? <IconCheck size={13} color={c.accent} /> : <View style={{ width: 13 }} />}
                          <Text style={[styles.team, localWon && styles.teamWin]} numberOfLines={1}>
                            {p.local || '—'}
                          </Text>
                        </View>
                        <View style={styles.teamLine}>
                          {visitWon ? <IconCheck size={13} color={c.accent} /> : <View style={{ width: 13 }} />}
                          <Text style={[styles.team, visitWon && styles.teamWin]} numberOfLines={1}>
                            {p.visit || '—'}
                          </Text>
                        </View>
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
                        {loadingActa === p.idPartido ? (
                          <ActivityIndicator color={c.accent} />
                        ) : acta.length === 0 ? (
                          <Text style={styles.matchMeta}>Acta no disponible.</Text>
                        ) : (
                          acta.map((g) => {
                            const lWon = g.ganador === 'local';
                            const vWon = g.ganador === 'visitante';
                            return (
                              <View key={g.partido_num} style={styles.actaRow}>
                                <Text style={styles.actaNum}>{g.partido_num}</Text>
                                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                                  <Text style={[styles.actaPair, lWon && styles.actaWin]} numberOfLines={1}>
                                    {[g.local_j1, g.local_j2].filter(Boolean).join(' / ') || '—'}
                                  </Text>
                                  <Text style={[styles.actaPair, vWon && styles.actaWin]} numberOfLines={1}>
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
          </View>
        )}
      </ScrollView>
    </View>
  );
};

function fmtDate(d: string | null): string {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : d;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    title: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 6 },
    empty: { color: c.textMuted, fontSize: 13.5, marginTop: 30, textAlign: 'center' },
    tabs: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 18,
      marginBottom: 18,
      backgroundColor: c.bgCard,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
    tabOn: { backgroundColor: c.accent },
    tabText: { color: c.textMuted, fontSize: 13.5, fontWeight: '700' },
    tabTextOn: { color: c.textInverse },
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
    posBadge: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 13, fontWeight: '800' },
    rowName: { color: c.text, fontSize: 14, fontWeight: '700' },
    rowMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2 },
    ptsCol: { alignItems: 'center', minWidth: 34 },
    ptsNum: { fontFamily: Fonts.mono, color: c.text, fontSize: 16, fontWeight: '800' },
    ptsLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 8, letterSpacing: 1, fontWeight: '500' },
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
    teamLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    team: { flex: 1, minWidth: 0, color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
    teamWon: { fontWeight: '800' },
    teamWin: { color: c.accent, fontWeight: '800' },
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
    actaWin: { color: c.text, fontWeight: '800' },
    actaScore: { fontFamily: Fonts.mono, color: c.text, fontSize: 12, fontWeight: '700' },
    jNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    jArrow: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    jNavTitle: { color: c.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
    jPill: {
      minWidth: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    jPillOn: { backgroundColor: c.accent, borderColor: c.accent },
    jPillText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 14, fontWeight: '800' },
    jPillTextOn: { color: c.textInverse },
  });
