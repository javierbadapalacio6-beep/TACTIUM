import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconStar, IconStarFilled, useLayout } from '@components/ui';
import { CardGrid, ContentColumn, SplitView } from '@components/layout';
import { StatCell, ListHeader } from '../components/fcpUi';
import { PointsCurve, type CurvePoint } from '../components/PointsCurve';
import { seasonLabel, seasonShort } from '@core/services/fcpBrowse';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';
import {
  fetchFcpPlayerProfile,
  fetchFcpPlayerYears,
  fetchFcpPlayerYearMatches,
  fetchFcpPlayerHistory,
  fetchFcpPlayerTeamRank,
  fetchFcpTeamProfile,
  type FcpTeamProfile,
  type FcpPlayerProfile,
  type FcpPlayerYearTeam,
  type FcpPlayerYearMatches,
  type FcpPlayerHistory,
  type FcpPlayerMatch,
  type FcpHistMatch,
} from '@core/services/fcpProfiles';
import type { CompetirStackScreenProps } from '@navigation/types';

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

/** Tablet: parejas y partidos de dos en dos (en móvil, uno). */
const TWO_COLS = { phone: 1, tabletPortrait: 2, tabletLandscape: 2 } as const;
const FILTRO_LABEL: Record<Filtro, string> = { todos: 'TODOS ▾', victorias: 'VICTORIAS ▾', derrotas: 'DERROTAS ▾' };

/**
 * Ficha de jugador.
 * TABLET · vertical: columna de 720 con la curva de puntos a todo el ancho,
 * parejas en 2 columnas y los partidos de cada jornada de dos en dos.
 * TABLET · horizontal: lista + detalle, con la plantilla de su equipo a la
 * izquierda y esta ficha a la derecha (`inSplit` evita partir otra vez
 * cuando ya va dentro del detalle de Federación).
 */
export const FcpPlayerScreen = (
  props: CompetirStackScreenProps<'FcpPlayer'> & { inSplit?: boolean },
) => {
  const { mode } = useLayout();
  if (mode === 'tabletLandscape' && !props.inSplit) {
    return <FcpPlayerSplit navigation={props.navigation} route={props.route} />;
  }
  return <FcpPlayerBody navigation={props.navigation} route={props.route} />;
};

/** Horizontal: la plantilla del equipo (por puntos) + la ficha elegida. */
const FcpPlayerSplit = ({ navigation, route }: CompetirStackScreenProps<'FcpPlayer'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [cur, setCur] = useState<{ id: string; name?: string }>({
    id: route.params.idJugador,
    name: route.params.name,
  });
  const [team, setTeam] = useState<FcpTeamProfile | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // El equipo de su última temporada con equipo, y su plantilla.
  useEffect(() => {
    let alive = true;
    setLoadingTeam(true);
    fetchFcpPlayerYears(route.params.idJugador)
      .then((ys) => {
        const idEquipo = ys.find((y) => y.idEquipo != null)?.idEquipo ?? null;
        return idEquipo != null ? fetchFcpTeamProfile(idEquipo) : null;
      })
      .then((t) => {
        if (alive) setTeam(t ?? null);
      })
      .catch(() => {
        if (alive) setTeam(null);
      })
      .finally(() => {
        if (alive) setLoadingTeam(false);
      });
    return () => {
      alive = false;
    };
  }, [route.params.idJugador]);

  const roster = useMemo(
    () => (team ? [...team.roster].sort((a, b) => b.puntos - a.puntos) : []),
    [team],
  );

  return (
    <SplitView
      list={
        <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <Text style={styles.heroMeta}>PLANTILLA</Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {team?.equipo ?? ''}
            </Text>
          </View>
          {loadingTeam ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />
          ) : roster.length === 0 ? (
            <Text style={[styles.note, { paddingHorizontal: 20 }]}>Sin plantilla publicada.</Text>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 32,
                gap: 6,
              }}
              showsVerticalScrollIndicator={false}
            >
              {roster.map((p) => {
                const on = p.idJugador === cur.id;
                return (
                  <Pressable
                    key={p.idJugador}
                    onPress={() => setCur({ id: p.idJugador, name: p.name })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.partnerRow,
                      on && styles.rosterSel,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={styles.partnerAvatar}>
                      <Text style={styles.partnerAvatarText}>{initials(p.name)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.partnerName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {p.categoria ? (
                        <Text style={styles.partnerMeta} numberOfLines={1}>
                          {p.categoria.toUpperCase()}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.partnerWl, on && { color: c.accent }]}>
                      {fmtN(p.puntos)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      }
      detail={
        <FcpPlayerBody
          key={cur.id}
          navigation={navigation}
          route={{ ...route, params: { idJugador: cur.id, name: cur.name } }}
        />
      }
    />
  );
};

const FcpPlayerBody = ({ navigation, route }: CompetirStackScreenProps<'FcpPlayer'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { isTablet } = useLayout();
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
  const [allPartners, setAllPartners] = useState(false);

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

  // Histórico (puntosVar) de la temporada elegida, en orden cronológico.
  const yearHist = useMemo(() => {
    if (!history || !selYear) return [] as FcpHistMatch[];
    return history.matches.filter((m) => String(m.anio) === selYear.anio).slice().reverse();
  }, [history, selYear]);

  // Curva: puntos tras cada partido, reconstruidos hacia atrás desde los
  // actuales. Con menos de 3 partidos no se dibuja.
  const curve = useMemo(() => {
    const vars = yearHist.filter((m) => m.puntosVar != null);
    if (vars.length < 3) return null;
    const end = selYear?.puntos ?? profile?.puntos ?? 0;
    const vals: number[] = new Array(vars.length);
    let acc = end;
    for (let i = vars.length - 1; i >= 0; i--) {
      vals[i] = acc;
      acc -= vars[i].puntosVar ?? 0;
    }
    // El histórico trae «17/01/2026 16:00»; algunas filas, ISO.
    const parts = (f: string | null): [number, number] | null => {
      const dmy = (f ?? '').match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/);
      if (dmy) return [Number(dmy[1]), Number(dmy[2])];
      const iso = (f ?? '').match(/^\d{4}-(\d{2})-(\d{2})/);
      return iso ? [Number(iso[2]), Number(iso[1])] : null;
    };
    const month = (f: string | null) => {
      const p = parts(f);
      return p ? MON[p[1] - 1] ?? '' : '';
    };
    const day = (f: string | null) => {
      const p = parts(f);
      return p ? `${p[0]} ${(MON[p[1] - 1] ?? '').toLowerCase()}` : '';
    };
    const points: CurvePoint[] = vars.map((m) => {
      const j = (m.jornada ?? '').match(/\d+/)?.[0];
      const head = m.esPlayoff ? 'Playoff' : j && Number(j) > 0 ? `J${j}` : 'Partido';
      return {
        delta: m.puntosVar ?? 0,
        won: m.gana,
        label: m.equipoRival ? `${head} · ${m.equipoRival}` : head,
        date: day(m.fecha),
      };
    });
    return {
      values: [acc, ...vals],
      points,
      start: month(vars[0].fecha),
      end: month(vars[vars.length - 1].fecha),
    };
  }, [yearHist, selYear, profile]);

  // Puntos y rival de cada jornada, cruzando el histórico por número de
  // jornada. Si en una jornada hay más de un partido, no se pinta (no cuadra).
  const histByJornada = useMemo(() => {
    const map = new Map<number, FcpHistMatch[]>();
    for (const h of yearHist) {
      const n = Number((h.jornada ?? '').match(/\d+/)?.[0]);
      if (!Number.isFinite(n) || h.esPlayoff) continue;
      const arr = map.get(n) ?? [];
      arr.push(h);
      map.set(n, arr);
    }
    return map;
  }, [yearHist]);
  const histFor = (jornada: number | null, won?: boolean): FcpHistMatch | null => {
    if (jornada == null) return null;
    const arr = histByJornada.get(jornada);
    if (!arr || arr.length !== 1) return null;
    if (won != null && arr[0].gana !== won) return null;
    return arr[0];
  };

  // Parejas de la temporada: TODOS los compañeros, con partidos, balance,
  // sets y los puntos de la federación que sumaron juntos (del histórico).
  const partners = useMemo(() => {
    const norm = (x: string) =>
      x
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const ptsBy = new Map<string, number>();
    for (const h of yearHist) {
      if (!h.pareja || h.puntosVar == null) continue;
      const k = norm(h.pareja);
      ptsBy.set(k, (ptsBy.get(k) ?? 0) + h.puntosVar);
    }
    const map = new Map<string, { name: string; n: number; w: number; sf: number; sa: number; pts: number | null }>();
    for (const m of yearData?.matches ?? []) {
      if (!m.partner) continue;
      const e = map.get(m.partner) ?? { name: m.partner, n: 0, w: 0, sf: 0, sa: 0, pts: null };
      e.n += 1;
      if (m.won) e.w += 1;
      const [a, b] = (m.sets ?? '').split('-').map((x) => Number(x));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        e.sf += a;
        e.sa += b;
      }
      map.set(m.partner, e);
    }
    // Las actas dan el nombre corto («ADRIAN RUIZ») y el histórico el completo
    // («ADRIAN RUIZ CAÑARTE»): casan si uno empieza por el otro.
    const same = (x: string, y: string) => x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
    for (const e of map.values()) {
      const k = norm(e.name);
      let total: number | null = null;
      for (const [hk, v] of ptsBy) if (same(hk, k)) total = (total ?? 0) + v;
      e.pts = total;
    }
    return [...map.values()].sort((a, b) => b.n - a.n || b.w - a.w);
  }, [yearData, yearHist]);

  const noActas = !!yearData && yearData.matches.length === 0 && !yearData.hasData;
  const prevYear = years.find((y) => selLiga != null && y.idLiga < selLiga) ?? null;

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
            : `JORNADA ${m.jornada}${m.fecha ? ` · ${shortDate(m.fecha)}` : ''}${
                histFor(m.jornada)?.equipoRival
                  ? ` · VS ${histFor(m.jornada)!.equipoRival!.toUpperCase()}`
                  : ''
              }`,
          order: isPlayoff ? 9999 : m.jornada ?? 0,
          games: [],
        });
      }
      map.get(key)!.games.push(m);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [yearData, filtro, histByJornada]); // eslint-disable-line react-hooks/exhaustive-deps

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
          onPress={() => toggleFavorite({ kind: 'player', refId: idJugador, label: profile?.name ?? name ?? 'Jugador', meta: selYear?.equipo ?? profile?.equipo ?? null })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Dejar de seguir' : 'Seguir jugador'}
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
          <ContentColumn>
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
              <Text style={styles.rankLabel}>PUNTOS DE LA FEDERACIÓN</Text>
              <Text style={styles.rankBig}>{fmtN(rankingPts)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {teamRank && teamRank.rank > 0 ? (
                <Text style={styles.rankRight}>Nº {teamRank.rank} en el equipo</Text>
              ) : null}
              {variacion != null ? (
                <Text style={[styles.rankDelta, { color: variacion >= 0 ? c.accent : c.error }]}>
                  {variacion >= 0 ? '▲' : '▼'} {variacion >= 0 ? '+' : ''}{fmtN(variacion)} esta temporada
                </Text>
              ) : null}
            </View>
          </View>

          {/* Curva de la temporada (≥ 3 partidos con histórico) */}
          {curve && !noActas ? (
            <View style={styles.curveCard}>
              <PointsCurve
                values={curve.values}
                points={curve.points}
                startLabel={curve.start}
                endLabel={curve.end}
                height={isTablet ? 180 : undefined}
              />
            </View>
          ) : null}

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
                    <Text style={[styles.yChipText, on && styles.yChipTextOn]}>{seasonShort(y.anio)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Stats del año */}
          {noActas ? null : (
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
          )}

          {/* Parejas de la temporada */}
          {partners.length > 0 ? (
            <View style={{ marginTop: 22 }}>
              <ListHeader
                title={`PAREJAS · ${partners.length}`}
                action={partners.length > 3 ? (allPartners ? 'MENOS' : 'TODAS ›') : undefined}
                onAction={partners.length > 3 ? () => setAllPartners((v) => !v) : undefined}
              />
              <CardGrid columns={TWO_COLS} gap={6} style={{ marginTop: 10 }}>
                {(allPartners ? partners : partners.slice(0, isTablet ? 4 : 3)).map((p) => {
                  const pct = Math.round((p.w / p.n) * 100);
                  return (
                    <View key={p.name} style={styles.partnerRow}>
                      <View style={styles.partnerAvatar}>
                        <Text style={styles.partnerAvatarText}>{initials(p.name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <Text style={styles.partnerName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.partnerMeta} numberOfLines={1}>
                          {p.n} {p.n === 1 ? 'PARTIDO' : 'PARTIDOS'} · SETS {p.sf}-{p.sa}
                          {p.pts != null ? ` · ${p.pts > 0 ? '+' : p.pts < 0 ? '−' : ''}${Math.abs(p.pts)} PTS` : ''}
                        </Text>
                        {/* Barra de victorias juntos */}
                        <View style={styles.partnerBar}>
                          <View style={[styles.partnerBarFill, { width: `${pct}%` }]} />
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={styles.partnerWl}>
                          {p.w}-{p.n - p.w}
                        </Text>
                        <Text style={[styles.partnerMeta, { marginTop: 0, color: pct >= 50 ? c.accent : c.textFaint }]}>
                          {pct}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </CardGrid>
            </View>
          ) : null}

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
          ) : !yearData || noActas ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                Aún no hay actas de la {selYear ? seasonShort(selYear.anio) : 'temporada'}
              </Text>
              <Text style={styles.note}>
                La federación las publica después de cada jornada.
                {prevYear ? ' Mientras, mira la temporada pasada.' : ''}
              </Text>
              {prevYear ? (
                <Pressable
                  onPress={() => setSelLiga(prevYear.idLiga)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.emptyBtnText}>Ver {seasonShort(prevYear.anio)}</Text>
                </Pressable>
              ) : null}
            </View>
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
                <CardGrid columns={TWO_COLS} gap={6}>
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
                      {(() => {
                        const pv = d.games.length === 1 ? histFor(m.jornada, m.won)?.puntosVar : null;
                        if (pv == null) return null;
                        return (
                          <Text style={[styles.matchPts, { color: pv >= 0 ? c.accent : c.error }]}>
                            {pv >= 0 ? '+' : '−'}
                            {Math.abs(pv)}
                          </Text>
                        );
                      })()}
                    </View>
                  ))}
                </CardGrid>
              </View>
            ))
          )}
          </ContentColumn>
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
    matchPts: { fontFamily: Fonts.mono, fontSize: 12.5, fontWeight: '800', minWidth: 34, textAlign: 'right' },
    curveCard: {
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    rosterSel: { borderColor: c.accent, borderWidth: 1.5 },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    partnerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: c.bgCard2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    partnerAvatarText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11.5, fontWeight: '700' },
    partnerName: { color: c.text, fontSize: 14, fontWeight: '600' },
    partnerMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 1, marginTop: 2 },
    partnerWl: { fontFamily: Fonts.mono, color: c.text, fontSize: 14, fontWeight: '800' },
    partnerBar: { height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
    partnerBarFill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
    emptyCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    emptyBtn: {
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingHorizontal: 14,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      justifyContent: 'center',
    },
    emptyBtnText: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
  });
