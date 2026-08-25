import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconStar, IconStarFilled } from '@components/ui';
import { StatCell, ListHeader } from '../components/fcpUi';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';
import {
  fetchFcpPlayerProfile,
  fetchFcpPlayerYears,
  fetchFcpPlayerYearMatches,
  fetchFcpPlayerHistory,
  fetchFcpPlayerTeamRank,
  type FcpPlayerProfile,
  type FcpPlayerYearTeam,
  type FcpPlayerYearMatches,
  type FcpPlayerHistory,
  type FcpPlayerMatch,
} from '@core/services/fcpProfiles';
import type { SeasonsStackScreenProps } from '@navigation/types';

const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const MON = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const shortDate = (d: string | null): string => {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]} ${MON[Number(m[2]) - 1] ?? ''}` : '';
};

const initials = (name: string): string => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '?';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
};

type Filtro = 'todos' | 'victorias' | 'derrotas';
const FILTRO_LABEL: Record<Filtro, string> = { todos: 'TODOS ▾', victorias: 'VICTORIAS ▾', derrotas: 'DERROTAS ▾' };

export const FcpPlayerScreen = ({ navigation, route }: SeasonsStackScreenProps<'FcpPlayer'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { idJugador, name } = route.params;
  const isFav = useFavoritesStore((s) =>
    s.items.some((f) => f.kind === 'player' && f.refId === idJugador),
  );

  const [profile, setProfile] = useState<FcpPlayerProfile | null>(null);
  const [years, setYears] = useState<FcpPlayerYearTeam[]>([]);
  const [history, setHistory] = useState<FcpPlayerHistory | null>(null);
  const [selLiga, setSelLiga] = useState<number | null>(null);
  const [yearData, setYearData] = useState<FcpPlayerYearMatches | null>(null);
  const [teamRank, setTeamRank] = useState<{ rank: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingYear, setLoadingYear] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Carga base: perfil + años + histórico (para la variación de puntos).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchFcpPlayerProfile(idJugador),
      fetchFcpPlayerYears(idJugador),
      fetchFcpPlayerHistory(idJugador).catch(() => null),
    ])
      .then(([p, ys, h]) => {
        if (!alive) return;
        setProfile(p);
        setYears(ys);
        setHistory(h);
        setSelLiga(ys[0]?.idLiga ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idJugador]);

  const selYear = years.find((y) => y.idLiga === selLiga) ?? null;

  // Al cambiar de año → partidos/stats + puesto en la plantilla.
  useEffect(() => {
    if (selLiga == null) return;
    let alive = true;
    setLoadingYear(true);
    setTeamRank(null);
    fetchFcpPlayerYearMatches(idJugador, selLiga)
      .then((d) => alive && setYearData(d))
      .catch(() => alive && setYearData(null))
      .finally(() => alive && setLoadingYear(false));
    return () => {
      alive = false;
    };
  }, [idJugador, selLiga]);

  useEffect(() => {
    if (!selYear?.idEquipo) {
      setTeamRank(null);
      return;
    }
    let alive = true;
    fetchFcpPlayerTeamRank(selYear.idEquipo, idJugador)
      .then((r) => alive && setTeamRank(r))
      .catch(() => alive && setTeamRank(null));
    return () => {
      alive = false;
    };
  }, [selYear?.idEquipo, idJugador]);

  const wr = yearData && yearData.pj > 0 ? Math.round((yearData.pg / yearData.pj) * 100) : null;
  const sd = yearData ? yearData.setsFor - yearData.setsAgainst : 0;

  // Variación de puntos de la temporada seleccionada (histórico FCP).
  const variacion = useMemo(() => {
    if (!history || !selYear) return null;
    const y = history.years.find((yr) => String(yr.anio) === selYear.anio);
    return y && y.variacion !== 0 ? y.variacion : null;
  }, [history, selYear]);

  // Partidos filtrados y agrupados por jornada.
  const dayGroups = useMemo(() => {
    if (!yearData) return [] as { key: string; label: string; games: FcpPlayerMatch[] }[];
    const filtered = yearData.matches.filter((m) =>
      filtro === 'todos' ? true : filtro === 'victorias' ? m.won : !m.won,
    );
    const map = new Map<string, { key: string; label: string; order: number; games: FcpPlayerMatch[] }>();
    for (const m of filtered) {
      const isPlayoff = m.jornada == null;
      const key = isPlayoff ? 'PLAYOFF' : `J${m.jornada}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: isPlayoff
            ? 'PLAYOFF'
            : `JORNADA ${m.jornada}${m.fecha ? ` · ${shortDate(m.fecha)}` : ''}`,
          order: isPlayoff ? 9999 : m.jornada ?? 0,
          games: [],
        });
      }
      map.get(key)!.games.push(m);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [yearData, filtro]);

  const rankingPts = selYear?.puntos ?? profile?.puntos ?? 0;
  const backLabel = selYear?.equipo || profile?.equipo || 'Atrás';

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.textMuted} />
          <Text style={styles.navBtnLabel} numberOfLines={1}>{backLabel}</Text>
        </Pressable>

        <Pressable
          onPress={() => toggleFavorite({ kind: 'player', refId: idJugador, label: profile?.name ?? name ?? 'Jugador' })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          style={({ pressed }) => [styles.favBtn, isFav && styles.favBtnOn, pressed && { opacity: 0.7 }]}
        >
          {isFav ? <IconStarFilled size={16} color={c.accent} /> : <IconStar size={16} color={c.textFaint} />}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(profile?.name || name || '?')}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={styles.heroName} numberOfLines={2}>{profile?.name || name || 'Jugador'}</Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                {[selYear?.equipo || profile?.equipo, selYear?.categoria || profile?.categoria]
                  .filter(Boolean)
                  .join(' · ')
                  .toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Ranking · puntos de la Federación Cántabra (no es el ranking FEP nacional) */}
          <View style={styles.rankCard}>
            <View style={{ gap: 4 }}>
              <Text style={styles.rankLabel}>RANKING FCP</Text>
              <Text style={styles.rankBig}>{fmtN(rankingPts)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {teamRank && teamRank.rank > 0 ? (
                <Text style={styles.rankRight}>Nº {teamRank.rank} EN EL EQUIPO</Text>
              ) : null}
              {variacion != null ? (
                <Text style={[styles.rankDelta, { color: variacion >= 0 ? c.accent : c.error }]}>
                  {variacion >= 0 ? '▲' : '▼'} {variacion >= 0 ? '+' : ''}{fmtN(variacion)} esta temporada
                </Text>
              ) : null}
            </View>
          </View>

          {/* Selector de temporada */}
          {years.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
              style={{ marginTop: 16 }}
            >
              {years.map((y) => {
                const on = y.idLiga === selLiga;
                return (
                  <Pressable key={y.idLiga} onPress={() => setSelLiga(y.idLiga)} style={[styles.yChip, on && styles.yChipOn]}>
                    <Text style={[styles.yChipText, on && styles.yChipTextOn]}>{y.anio}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Stats del año */}
          <View style={styles.statGrid}>
            {([
              { k: 'PJ', v: String(yearData?.pj ?? 0) },
              { k: 'PG', v: String(yearData?.pg ?? 0), color: c.accent },
              { k: 'PP', v: String(yearData?.pp ?? 0), color: c.error },
              { k: '% VIC', v: wr != null ? String(wr) : '—' },
              { k: 'SETS', v: sd >= 0 ? `+${sd}` : String(sd) },
            ] as { k: string; v: string; color?: string }[]).map((s) => (
              <View key={s.k} style={{ flex: 1 }}>
                <StatCell label={s.k} value={s.v} color={s.color} valueSize={17} />
              </View>
            ))}
          </View>

          {/* Partidos */}
          <View style={{ marginTop: 26 }}>
            <ListHeader
              title={`PARTIDOS · ${yearData?.matches.length ?? 0}`}
              action={FILTRO_LABEL[filtro]}
              onAction={() =>
                setFiltro((f) => (f === 'todos' ? 'victorias' : f === 'victorias' ? 'derrotas' : 'todos'))
              }
            />
          </View>

          {loadingYear ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} />
          ) : !yearData || (yearData.matches.length === 0 && !yearData.hasData) ? (
            <Text style={styles.note}>
              Las actas de {selYear?.anio ?? 'esta temporada'} aún se están sincronizando con la Federación.
            </Text>
          ) : yearData.matches.length === 0 ? (
            <Text style={styles.note}>Sin partidos disputados esta temporada.</Text>
          ) : dayGroups.length === 0 ? (
            <Text style={styles.note}>Sin partidos con ese filtro.</Text>
          ) : (
            dayGroups.map((d) => (
              <View key={d.key}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayHeadLabel}>{d.label}</Text>
                  <View style={styles.dayRule} />
                </View>
                <View style={{ gap: 6 }}>
                  {d.games.map((m, i) => (
                    <View key={i} style={styles.matchRow}>
                      <View style={[styles.wl, { backgroundColor: m.won ? c.accent15 : withAlpha(c.error, 0.14) }]}>
                        <Text style={[styles.wlText, { color: m.won ? c.accent : c.error }]}>{m.won ? 'V' : 'D'}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.matchRival} numberOfLines={1}>vs {m.rivalPair}</Text>
                        {m.partner ? (
                          <Text style={styles.matchPartner} numberOfLines={1}>CON {m.partner.toUpperCase()}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.matchSets}>{m.parciales || m.sets}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
    navBtnLabel: { color: c.textMuted, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    favBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favBtnOn: { borderColor: c.accent40, backgroundColor: c.accent10 },

    // Hero
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 999,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.accent, fontSize: 22, fontWeight: '800' },
    heroName: { color: c.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 },
    heroMeta: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: c.textFaint },

    // Ranking card
    rankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    rankLabel: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.8, color: c.textFaint },
    rankBig: { fontFamily: Fonts.mono, fontSize: 26, fontWeight: '700', color: c.accent, lineHeight: 28 },
    rankRight: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.6, color: c.textFaint },
    rankDelta: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '600' },

    // Season chips
    yChip: {
      minWidth: 58,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      paddingHorizontal: 15,
      paddingVertical: 8,
      alignItems: 'center',
    },
    yChipOn: { backgroundColor: c.accent, borderColor: c.accent },
    yChipText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '500', color: c.textMuted },
    yChipTextOn: { color: c.textInverse, fontWeight: '700' },

    // Stat grid
    statGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },

    // Partidos
    note: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
    dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 8 },
    dayHeadLabel: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.8, color: c.textMuted, fontWeight: '600' },
    dayRule: { flex: 1, height: 1, backgroundColor: c.hair },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    wl: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    wlText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
    matchRival: { color: c.text, fontSize: 13.5, fontWeight: '600' },
    matchPartner: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 0.6, marginTop: 2 },
    matchSets: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11 },
  });
