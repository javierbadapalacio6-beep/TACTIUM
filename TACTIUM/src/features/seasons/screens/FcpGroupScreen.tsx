import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { Segmented, MetaChip, FormChips } from '../components/fcpUi';
import {
  fetchGroupStandings,
  fetchGroupSchedule,
  type FcpBrowseStanding,
  type FcpBrowseMatch,
} from '@core/services/fcpBrowse';
import { fetchFcpActa, type FcpActaPartido } from '@core/services/fcpSeason';
import { FcpBracketView } from '../components/FcpBracketView';
import type { SeasonsStackScreenProps } from '@navigation/types';

type Tab = 'clasif' | 'jornadas' | 'cuadro';
const DAY = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MON = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// "2025-05-02" → "SÁBADO 02 MAY" (submeta) o "02 MAY" (corto).
function fmtLongDate(d: string | null, long = false): string {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dd = m[3];
  const mon = MON[Number(m[2]) - 1] ?? '';
  if (!long) return `${dd} ${mon}`;
  const dayFull = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][date.getDay()] ?? '';
  return `${dayFull} ${dd} ${mon}`;
}

// Marcador por equipo desde "4/0".
function splitScore(resultado: string | null): [string, string] | null {
  if (!resultado) return null;
  const m = resultado.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return null;
  return [m[1], m[2]];
}

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
  const [actas, setActas] = useState<Record<string, FcpActaPartido[]>>({});
  const stripRef = useRef<ScrollView>(null);

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

  // Auto-scroll: la jornada activa siempre visible en la tira.
  useEffect(() => {
    if (selIdx < 0 || tab !== 'jornadas') return;
    const STEP = 34 + 7; // chip + gap
    const x = Math.max(0, 26 + selIdx * STEP - 120);
    const t = setTimeout(() => stripRef.current?.scrollTo({ x, animated: true }), 60);
    return () => clearTimeout(t);
  }, [selIdx, tab]);

  // Actas de la jornada seleccionada (para las parejas inline), por lote.
  useEffect(() => {
    if (tab !== 'jornadas') return;
    const pending = selMatches.filter((m) => m.resultado && !actas[m.idPartido]);
    if (pending.length === 0) return;
    let alive = true;
    Promise.all(
      pending.map((m) =>
        fetchFcpActa(m.idPartido)
          .then((a) => [m.idPartido, a] as const)
          .catch(() => [m.idPartido, [] as FcpActaPartido[]] as const),
      ),
    ).then((entries) => {
      if (!alive) return;
      setActas((prev) => {
        const n = { ...prev };
        for (const [id, a] of entries) n[id] = a;
        return n;
      });
    });
    return () => {
      alive = false;
    };
  }, [selJ, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Meta chips de cabecera.
  const jugadasCount = useMemo(() => schedule.filter((m) => m.resultado).map((m) => m.jornada ?? 0), [schedule]);
  const jornadaTotal = jNums.length ? Math.max(...jNums) : 0;
  const jornadaActual = jugadasCount.length ? Math.max(...jugadasCount) : 0;
  const finalizada = jornadaTotal > 0 && jornadaActual >= jornadaTotal;

  const eyebrow = (grupo ?? 'Grupo').toUpperCase();
  const h1 = tab === 'clasif' ? 'Clasificación' : tab === 'jornadas' ? 'Jornadas' : 'Cuadro';

  const tabItems: [Tab, string][] = esPlayoff
    ? [['cuadro', 'Cuadro'], ['clasif', 'Clasificación'], ['jornadas', 'Jornadas']]
    : [['clasif', 'Clasificación'], ['jornadas', 'Jornadas']];

  // Zona de ascenso/descenso: la FCP no publica los cupos, así que no se pinta
  // (evitamos etiquetar mal). El hook queda listo para cuando exista el dato.
  const zoneOf = (_pos: number | null): 'up' | 'down' | null => null;

  const selDate = selMatches.find((m) => m.fecha)?.fecha ?? null;
  const selPlayed = selMatches.length > 0 && selMatches.every((m) => m.resultado);

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.textMuted} />
          <Text style={styles.navBtnLabel}>Federación</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        <Text style={styles.title}>{h1}</Text>

        {/* Meta chips (solo fuera del cuadro) */}
        {tab !== 'cuadro' && !loading ? (
          <View style={styles.metaRow}>
            {rows.length > 0 ? <MetaChip label={`${rows.length} EQUIPOS`} /> : null}
            {jornadaTotal > 0 ? <MetaChip label={`J·${jornadaActual}/${jornadaTotal}`} /> : null}
            <MetaChip label={finalizada ? 'FINALIZADA' : 'EN CURSO'} tone={finalizada ? 'mint' : 'neutral'} />
          </View>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <Segmented items={tabItems} value={tab} onChange={setTab} />
        </View>

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : tab === 'cuadro' ? (
          <View style={{ marginTop: 18 }}>
            <FcpBracketView idGrupo={idGrupo} />
          </View>
        ) : tab === 'clasif' ? (
          rows.length === 0 ? (
            <Text style={styles.empty}>Sin clasificación disponible.</Text>
          ) : (
            <View style={{ marginTop: 22 }}>
              {/* Cabecera de tabla */}
              <View style={styles.thead}>
                <Text style={[styles.th, { width: 22 }]}>#</Text>
                <Text style={[styles.th, { flex: 1 }]}>EQUIPO</Text>
                <Text style={[styles.th, styles.thNum, { width: 26 }]}>PJ</Text>
                <Text style={[styles.th, styles.thNum, { width: 26 }]}>PG</Text>
                <Text style={[styles.th, { width: 40, textAlign: 'right' }]}>DIF</Text>
                <Text style={[styles.th, { width: 34, textAlign: 'right', color: c.textMuted }]}>PTS</Text>
              </View>

              <View style={{ gap: 6, marginTop: 10 }}>
                {rows.map((t) => {
                  const dif = (t.setsFavor ?? 0) - (t.setsContra ?? 0);
                  const zone = zoneOf(t.posicion);
                  return (
                    <Pressable
                      key={`${t.idEquipo}-${t.equipo}`}
                      onPress={() =>
                        t.idEquipo != null
                          ? navigation.navigate('FcpTeam', { idEquipo: t.idEquipo, name: t.equipo })
                          : undefined
                      }
                      style={({ pressed }) => [styles.stRow, pressed && { opacity: 0.85 }]}
                    >
                      {zone ? (
                        <View style={[styles.zoneBar, { backgroundColor: zone === 'up' ? c.accent : c.error }]} />
                      ) : null}
                      <View style={styles.stTop}>
                        <Text style={[styles.stPos, { width: 22 }]}>{t.posicion ?? '–'}</Text>
                        <Text style={[styles.stTeam, { flex: 1 }]} numberOfLines={1}>{t.equipo}</Text>
                        <Text style={[styles.stNum, { width: 26, color: c.textMuted }]}>{t.pj}</Text>
                        <Text style={[styles.stNum, { width: 26, color: c.text }]}>{t.pg}</Text>
                        <Text style={[styles.stNum, { width: 40, textAlign: 'right', color: c.textFaint }]}>
                          {dif >= 0 ? `+${dif}` : dif}
                        </Text>
                        <Text style={[styles.stPts, { width: 34 }]}>{t.puntos ?? 0}</Text>
                      </View>
                      {t.form.length > 0 ? (
                        <View style={styles.stFormRow}>
                          <Text style={styles.stFormLabel}>RACHA</Text>
                          <FormChips form={t.form} />
                          <View style={{ flex: 1 }} />
                          <Text style={styles.stSets}>
                            {t.setsFavor ?? 0} / {t.setsContra ?? 0}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )
        ) : jNums.length === 0 ? (
          <Text style={styles.empty}>Sin jornadas registradas.</Text>
        ) : (
          <View style={{ marginTop: 20 }}>
            {/* Tira de jornadas */}
            <View style={styles.stripWrap}>
              <Text style={styles.stripArrow}>‹</Text>
              <ScrollView
                ref={stripRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7, paddingVertical: 2, paddingRight: 20 }}
                style={{ flex: 1 }}
              >
                {jNums.map((j) => {
                  const on = j === selJ;
                  return (
                    <Pressable key={j} onPress={() => setSelJ(j)} style={[styles.jChip, on && styles.jChipOn]}>
                      <Text style={[styles.jChipText, on && styles.jChipTextOn]}>{j || '—'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Cabecera de jornada */}
            <View style={styles.jHead}>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <Text style={styles.jHeadTitle}>Jornada {selJ ?? '—'}</Text>
                <Text style={styles.jHeadMeta} numberOfLines={1}>
                  {[fmtLongDate(selDate, true), selJ === jornadaTotal ? 'ÚLTIMA JORNADA' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={[styles.jBadge, selPlayed ? styles.jBadgeOn : null]}>
                <Text style={[styles.jBadgeText, selPlayed ? { color: c.accent } : null]}>
                  {selPlayed ? 'JUGADA' : 'PENDIENTE'}
                </Text>
              </View>
            </View>

            {/* Enfrentamientos */}
            <View style={{ gap: 10, marginTop: 16 }}>
              {selMatches.map((p, i) => {
                const localWon = p.ganador === 'local';
                const visitWon = p.ganador === 'visitante';
                const score = splitScore(p.resultado);
                const acta = (actas[p.idPartido] ?? []).slice().sort((a, b) => a.partido_num - b.partido_num).slice(0, 3);
                return (
                  <View key={p.idPartido || i} style={styles.match}>
                    <View style={styles.matchTop}>
                      <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
                        <View style={styles.teamLine}>
                          <View style={[styles.tDot, { backgroundColor: localWon ? c.accent : c.hairStrong }]} />
                          <Text style={[styles.teamName, localWon ? styles.teamWin : styles.teamLose]} numberOfLines={1}>
                            {p.local || '—'}
                          </Text>
                        </View>
                        <View style={styles.teamLine}>
                          <View style={[styles.tDot, { backgroundColor: visitWon ? c.accent : c.hairStrong }]} />
                          <Text style={[styles.teamName, visitWon ? styles.teamWin : styles.teamLose]} numberOfLines={1}>
                            {p.visit || '—'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'center', gap: 9 }}>
                        <Text style={[styles.mScore, !localWon && { color: c.textMuted }]}>{score ? score[0] : '·'}</Text>
                        <Text style={[styles.mScore, !visitWon && { color: c.textMuted }]}>{score ? score[1] : '·'}</Text>
                      </View>
                    </View>
                    {acta.length > 0 ? (
                      <View style={styles.matchBottom}>
                        {acta.map((g) => (
                          <View key={g.partido_num} style={styles.pairChunk}>
                            <View style={styles.pairCode}>
                              <Text style={styles.pairCodeText}>P{g.partido_num}</Text>
                            </View>
                            <Text style={styles.pairScore} numberOfLines={1}>
                              {g.parciales || `${g.sets_local ?? 0}-${g.sets_visit ?? 0}`}
                            </Text>
                          </View>
                        ))}
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 29, fontWeight: '800', letterSpacing: -0.6, marginTop: 7 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
    empty: { color: c.textMuted, fontSize: 13.5, marginTop: 30, textAlign: 'center' },

    // Tabla clasificación
    thead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    th: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, color: c.textFaint, fontWeight: '600' },
    thNum: { textAlign: 'center' },
    stRow: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
      overflow: 'hidden',
    },
    zoneBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
    stTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stPos: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: '700', color: c.textMuted },
    stTeam: { color: c.text, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.1, minWidth: 0 },
    stNum: { fontFamily: Fonts.mono, fontSize: 12.5, textAlign: 'center' },
    stPts: { fontFamily: Fonts.mono, fontSize: 17, fontWeight: '800', color: c.text, textAlign: 'right' },
    stFormRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 32 },
    stFormLabel: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.2, color: c.textFaint, marginRight: 2 },
    stSets: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 0.6, color: c.textFaint },

    // Tira de jornadas
    stripWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stripArrow: { fontFamily: Fonts.sans, fontSize: 20, fontWeight: '700', color: c.textFaint, width: 22, textAlign: 'center' },
    jChip: {
      minWidth: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    jChipOn: { backgroundColor: c.accent, borderColor: c.accent },
    jChipText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '600', color: c.textMuted },
    jChipTextOn: { color: c.textInverse, fontWeight: '700' },

    // Cabecera de jornada
    jHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 24 },
    jHeadTitle: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    jHeadMeta: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, color: c.textFaint },
    jBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: c.hairStrong, backgroundColor: c.bgCard },
    jBadgeOn: { backgroundColor: c.accent10, borderColor: c.accent40 },
    jBadgeText: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.2, fontWeight: '600', color: c.textFaint },

    // Enfrentamiento
    match: { borderRadius: Radius.md, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.hair, overflow: 'hidden' },
    matchTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
    teamLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tDot: { width: 5, height: 5, borderRadius: 999 },
    teamName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700' },
    teamWin: { color: c.text },
    teamLose: { color: c.textMuted },
    mScore: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '700', color: c.text },
    matchBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      backgroundColor: c.bgRaised,
    },
    pairChunk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pairCode: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: c.bgCard2 },
    pairCodeText: { fontFamily: Fonts.mono, fontSize: 9.5, fontWeight: '700', color: c.textMuted },
    pairScore: { fontFamily: Fonts.mono, fontSize: 10.5, color: c.textFaint },
  });
