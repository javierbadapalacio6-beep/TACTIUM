import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconBack, IconCheck, useCompactRail, useLayout } from '@components/ui';
import { CardGrid } from '@components/layout';
import * as MatchdaysApi from '@core/services/matchdays';
import * as MatchResultsApi from '@core/services/matchResults';
import * as LineupsApi from '@core/services/lineups';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import { useMatchdayRealtime } from '@core/hooks/useMatchdayRealtime';
import { getCourtsForCompetition } from '@core/data/federations';
import { isMatchStarted, formatSetScore } from '@core/utils/matchday';
import { formatShortDay } from '@core/utils/format';
import { useTeamStore, selectIsCaptain, selectIsPlayer } from '@store/teamStore';

import { JornadaScoreHeader } from '../components/jornada/JornadaScoreHeader';
import { SetsEditor, SetsTable } from '../components/match/GamesPicker';
import { MatchRow } from '../components/match/MatchScoreboard';
import { notifySuccess } from '../components/match/haptics';
import type { SetScore } from '../components/match/setsLogic';

import type { HomeStackScreenProps } from '@navigation/types';

const SETS = 3;

interface SetCell {
  us: string;
  them: string;
}

interface Match {
  sets: SetCell[];
  forfeit: boolean;
  // Dirección del W.O.: true = no nos presentamos (derrota); false = no se
  // presentó el rival (victoria). Solo si forfeit=true.
  forfeitUs: boolean;
}

const buildEmptyMatches = (courts: number): Match[] =>
  Array.from({ length: courts }, () => ({
    sets: Array.from({ length: SETS }, () => ({ us: '', them: '' })),
    forfeit: false,
    forfeitUs: false,
  }));

const matchOutcome = (m: Match): 'won' | 'lost' | null => {
  if (m.forfeit) return m.forfeitUs ? 'lost' : 'won';
  let usWon = 0;
  let themWon = 0;
  m.sets.forEach((s) => {
    if (s.us === '' || s.them === '') return;
    const a = Number(s.us);
    const b = Number(s.them);
    if (a > b) usWon++;
    else if (b > a) themWon++;
  });
  if (usWon >= 2) return 'won';
  if (themWon >= 2) return 'lost';
  return null;
};

const toScores = (m: Match): SetScore[] =>
  m.sets.map((s) => ({
    us: s.us === '' ? null : Number(s.us),
    them: s.them === '' ? null : Number(s.them),
  }));

type WoChoice = 'favor' | 'contra' | 'played';

/**
 * Resultados de la jornada (rediseño bloque «Partido», 2026-10).
 *
 * Mismo marcador que la Jornada arriba; debajo, primero TU partido (jugador)
 * y luego el resto, una línea por pista. Cada pista se apunta en una hoja con
 * la botonera de juegos 0-7: se guarda sola por set («Guardado ✓»). El W.O.
 * sale del camino normal: «Otro resultado».
 *
 * Apuntan el capitán y los jugadores con ficha vinculada (la RLS
 * `match_results_member_*`). Cerrar el acta sigue siendo del capitán, en la
 * Jornada.
 */
export const ResultsScreen = ({ navigation, route }: HomeStackScreenProps<'Results'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  const isCaptain = useTeamStore(selectIsCaptain);
  const isPlayer = useTeamStore(selectIsPlayer);
  // Un jugador SIN ficha vinculada no puede escribir (la RLS lo rechaza).
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const courts = getCourtsForCompetition(team?.federation, team?.league, team?.gender);
  const matchdayId = route.params.matchdayId;
  const focus = route.params.focus;

  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  const [matches, setMatches] = useState<Match[]>(() => buildEmptyMatches(courts));
  const [pairs, setPairs] = useState<LineupsApi.LineupPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Pista abierta en la hoja (índice 0-based) y si se ve «Otro resultado».
  const [openCourt, setOpenCourt] = useState<number | null>(null);
  const [woMode, setWoMode] = useState(false);
  const [woChoice, setWoChoice] = useState<WoChoice>('favor');
  // Celdas guardando / guardadas (`${court}-${setIdx}`).
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());
  const [savingForfeit, setSavingForfeit] = useState<number | null>(null);
  // Debounce + secuencia por celda (descarta respuestas viejas con red lenta).
  const persistTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const persistSeqRef = useRef<Map<string, number>>(new Map());
  // Espejo síncrono de `matches`: el guardado diferido lee siempre lo último.
  const matchesRef = useRef<Match[]>(matches);
  matchesRef.current = matches;
  const focusedRef = useRef(false);
  // Tablet: las pistas en rejilla (3×2 en horizontal, 2 columnas en
  // vertical), cada una con su botonera a la vista; sin hojas salvo el W.O.
  useCompactRail();
  const { isTablet } = useLayout();
  // Pista que se está apuntando (borde verde en la rejilla).
  const [activeCourt, setActiveCourt] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const activeVariant = await LineupVariantsApi.fetchActiveVariant(matchdayId);
      const [md, results, lineup] = await Promise.all([
        MatchdaysApi.fetchMatchday(matchdayId),
        MatchResultsApi.fetchResults(matchdayId),
        activeVariant ? LineupsApi.fetchLineup(activeVariant.id) : Promise.resolve([]),
      ]);
      setMatchday(md);
      setPairs(lineup);
      const next = buildEmptyMatches(courts);
      results.forEach((r) => {
        const ci = r.court_number - 1;
        const si = r.set_number - 1;
        if (ci < 0 || ci >= courts || si < 0 || si >= SETS) return;
        if (r.forfeit) {
          next[ci].forfeit = true;
          next[ci].forfeitUs = r.forfeit_us;
        }
        next[ci].sets[si] = {
          us: r.us !== null ? String(r.us) : '',
          them: r.them !== null ? String(r.them) : '',
        };
      });
      // Con un guardado pendiente en la pista abierta, no pisamos lo tecleado.
      const pending = new Set([...persistTimersRef.current.keys()].map((k) => Number(k.split('-')[0])));
      const merged = next.map((m, i) => (pending.has(i) ? matchesRef.current[i] ?? m : m));
      matchesRef.current = merged;
      setMatches(merged);
      setLoadError(false);
    } catch (e) {
      console.warn('Results fetch', e);
      setLoadError(true);
    }
  }, [matchdayId, courts]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useMatchdayRealtime({ matchdayId, onChange: reload });

  const closed = matchday?.status === 'finished';
  const started = matchday ? isMatchStarted(matchday) : false;
  const playerWithoutFicha = isPlayer && !myPlayerId;
  const canEdit = started && !closed && (isCaptain || (isPlayer && !!myPlayerId));

  // Desde la Jornada se puede llegar con una pista concreta (`focus`). La
  // tarjeta general del resultado también manda `focus: 0`, así que la P1 no
  // se abre sola: se ve la lista y se toca.
  useEffect(() => {
    if (loading || focusedRef.current || focus == null) return;
    focusedRef.current = true;
    if (focus > 0 && focus < courts && canEdit) {
      // Tablet: no hay hoja; se marca la pista en la rejilla.
      if (isTablet) setActiveCourt(focus);
      else setOpenCourt(focus);
    }
  }, [loading, focus, courts, canEdit, isTablet]);

  const teamScore = useMemo(() => {
    let us = 0;
    let them = 0;
    let played = 0;
    matches.forEach((m) => {
      const o = matchOutcome(m);
      if (o === 'won') {
        us++;
        played++;
      } else if (o === 'lost') {
        them++;
        played++;
      }
    });
    return { us, them, played };
  }, [matches]);

  const updateSet = (court: number, setIdx: number, side: 'us' | 'them', value: string) => {
    if (!canEdit) return;
    const next = matchesRef.current.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            sets: m.sets.map((s, j) => (j !== setIdx ? s : { ...s, [side]: value })),
          },
    );
    matchesRef.current = next;
    setMatches(next);
  };

  // Guardado real de una celda (set). Lee de `matchesRef` para no usar
  // valores viejos cuando dispara el debounce o el flush al salir.
  const doPersistCell = async (court: number, setIdx: number) => {
    if (!canEdit) return;
    const key = `${court}-${setIdx}`;
    const seq = (persistSeqRef.current.get(key) ?? 0) + 1;
    persistSeqRef.current.set(key, seq);

    const cell = matchesRef.current[court].sets[setIdx];
    const us = cell.us !== '' ? Number(cell.us) : null;
    const them = cell.them !== '' ? Number(cell.them) : null;

    setSavingCells((s) => new Set(s).add(key));
    try {
      await MatchResultsApi.upsertSet(matchdayId, court + 1, setIdx + 1, us, them);
      if (persistSeqRef.current.get(key) !== seq) return;
      setSavedCells((s) => new Set(s).add(key));
      setTimeout(() => {
        setSavedCells((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }, 1600);
    } catch (e: any) {
      if (persistSeqRef.current.get(key) === seq) {
        Alert.alert('No se pudo guardar', e?.message ?? '');
      }
    } finally {
      if (persistSeqRef.current.get(key) === seq) {
        setSavingCells((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    }
  };

  // La botonera guarda sola: un toque reprograma el guardado de ese set.
  const persistCellDebounced = (court: number, setIdx: number) => {
    if (!canEdit) return;
    const key = `${court}-${setIdx}`;
    const existing = persistTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      persistTimersRef.current.delete(key);
      doPersistCell(court, setIdx);
    }, 450);
    persistTimersRef.current.set(key, t);
  };

  // Al desmontar: guardar lo pendiente con los últimos valores.
  const flushAllRef = useRef<() => void>(() => {});
  flushAllRef.current = () => {
    const timers = persistTimersRef.current;
    timers.forEach((t, key) => {
      clearTimeout(t);
      const [ci, s] = key.split('-').map(Number);
      doPersistCell(ci, s);
    });
    timers.clear();
  };
  useEffect(() => {
    return () => {
      flushAllRef.current();
    };
  }, []);

  /** Marca/quita el W.O. de una pista con su dirección. */
  const applyForfeit = async (court: number, forfeit: boolean, forfeitUs: boolean) => {
    if (!canEdit) return;
    const prev = matchesRef.current[court];
    const nextMatches: Match[] = matchesRef.current.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            forfeit,
            forfeitUs: forfeit ? forfeitUs : false,
            sets: forfeit || prev.forfeit ? m.sets.map(() => ({ us: '', them: '' })) : m.sets,
          },
    );
    matchesRef.current = nextMatches;
    setMatches(nextMatches);
    setSavingForfeit(court);
    try {
      await MatchResultsApi.setCourtForfeit(matchdayId, court + 1, forfeit, forfeitUs, SETS);
      notifySuccess();
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? '');
      const rollback = matchesRef.current.map((m, i) => (i !== court ? m : prev));
      matchesRef.current = rollback;
      setMatches(rollback);
    } finally {
      setSavingForfeit(null);
    }
  };

  const saveWo = (court: number) => {
    const cur = matchesRef.current[court];
    const hasSets = cur.sets.some((s) => s.us !== '' || s.them !== '');
    const done = () => {
      setWoMode(false);
      // Tablet: la hoja solo sirve para el W.O.; la botonera está en la rejilla.
      if (isTablet) setOpenCourt(null);
    };
    if (woChoice === 'played') {
      if (cur.forfeit) void applyForfeit(court, false, false);
      done();
      return;
    }
    const forfeitUs = woChoice === 'contra';
    const go = () => {
      void applyForfeit(court, true, forfeitUs);
      done();
    };
    // Marcar W.O. con marcador ya metido lo borra → confirmar antes.
    if (!cur.forfeit && hasSets) {
      Alert.alert('Marcar W.O.', 'Esta pista tiene juegos apuntados. Al marcar W.O. se borran. ¿Seguir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Marcar W.O.', style: 'destructive', onPress: go },
      ]);
      return;
    }
    go();
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('HomeRoot');
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const opponentName = matchday?.opponent ?? 'Rival';
  const isHome = matchday?.is_home ?? true;
  const ourName = team?.name ?? 'Equipo';
  const mdDate = matchday?.match_date ? new Date(`${matchday.match_date}T12:00:00`) : null;
  const mdTime = matchday?.match_time ? matchday.match_time.slice(0, 5) : '';
  const anyFilled = teamScore.played > 0;
  const statusLabel = closed
    ? teamScore.us > teamScore.them
      ? 'Victoria'
      : teamScore.us < teamScore.them
        ? 'Derrota'
        : 'Empate'
    : `${teamScore.played} de ${courts}`;
  const tint = closed
    ? teamScore.us > teamScore.them
      ? c.accent
      : teamScore.us < teamScore.them
        ? c.error
        : c.warning
    : c.text;

  const pairOf = (ci: number) => pairs.find((p) => p.court_number === ci + 1) ?? null;
  const labelOf = (ci: number) => {
    const p = pairOf(ci);
    if (!p) return 'Sin alineación';
    const mine = (id: string | null) => !!myPlayerId && id === myPlayerId;
    const a = mine(p.player_a_id) ? 'Tú' : p.player_a_name ?? '—';
    const b = mine(p.player_b_id) ? 'Tú' : p.player_b_name ?? '—';
    return `${a} / ${b}`;
  };
  const myCourt = myPlayerId
    ? pairs.find((p) => p.player_a_id === myPlayerId || p.player_b_id === myPlayerId)?.court_number ?? null
    : null;
  const myIdx = myCourt != null ? myCourt - 1 : null;

  const rowFor = (ci: number, me: boolean) => {
    const m = matches[ci];
    if (!m) return null;
    const o = matchOutcome(m);
    const setsTxt = m.sets
      .filter((s) => s.us !== '' || s.them !== '')
      .map((s) =>
        formatSetScore(s.us !== '' ? Number(s.us) : null, s.them !== '' ? Number(s.them) : null, isHome),
      )
      .join(' ');
    const started = setsTxt !== '';
    const doneSets = m.sets.filter((s) => s.us !== '' && s.them !== '' && s.us !== s.them).length;
    const sub = m.forfeit
      ? m.forfeitUs
        ? 'W.O. en contra'
        : 'W.O. a favor'
      : o
        ? setsTxt
        : started
          ? `Set ${Math.min(doneSets + 1, 3)} en juego · ${setsTxt}`
          : 'Sin empezar';
    const right = o
      ? o === 'won'
        ? 'Ganado'
        : 'Perdido'
      : canEdit
        ? started
          ? 'Seguir ›'
          : 'Apuntar ›'
        : '—';
    return (
      <MatchRow
        key={ci}
        badge={`P${ci + 1}`}
        title={labelOf(ci)}
        sub={sub}
        right={right}
        rightTone={o === 'won' ? 'win' : o === 'lost' ? 'loss' : canEdit ? 'todo' : 'muted'}
        me={me}
        accessibilityLabel={`Pista ${ci + 1}. ${labelOf(ci)}. ${sub}`}
        onPress={() => {
          setWoMode(false);
          setOpenCourt(ci);
        }}
      />
    );
  };

  const order = Array.from({ length: courts }, (_, i) => i);
  const rest = myIdx != null && !isCaptain ? order.filter((i) => i !== myIdx) : order;

  // ── Hoja de una pista ────────────────────────────────────────────
  const sheetCourt = openCourt;
  const sheetMatch = sheetCourt != null ? matches[sheetCourt] : null;
  const sheetSaving =
    sheetCourt != null &&
    ([...savingCells].some((k) => k.startsWith(`${sheetCourt}-`)) || savingForfeit === sheetCourt);
  const sheetSaved =
    sheetCourt != null && [...savedCells].some((k) => k.startsWith(`${sheetCourt}-`));

  const courtSheet = (
    <>
      <BottomSheet open={sheetCourt != null} onClose={() => setOpenCourt(null)}>
        {sheetCourt != null && sheetMatch ? (
          <View style={{ gap: 10 }}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetEyebrow}>
                  PISTA {sheetCourt + 1}
                  {woMode ? ' · OTRO RESULTADO' : ''}
                </Text>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {woMode ? '¿No se jugó?' : labelOf(sheetCourt)}
                </Text>
              </View>
              {sheetSaving ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : sheetSaved ? (
                <Animated.Text entering={FadeIn.duration(160)} style={styles.saved}>
                  Guardado ✓
                </Animated.Text>
              ) : null}
            </View>

            {woMode ? (
              <>
                <Text style={styles.sheetBody}>El W.O. da la pista entera a quien sí se presentó.</Text>
                {(
                  [
                    { k: 'favor', t: 'W.O. a favor', s: `${opponentName} no se presentó · la pista es nuestra` },
                    { k: 'contra', t: 'W.O. en contra', s: 'No nos presentamos · la pista es suya' },
                    { k: 'played', t: 'Se jugó', s: 'Volver a apuntar los juegos' },
                  ] as { k: WoChoice; t: string; s: string }[]
                ).map((o) => (
                  <Pressable
                    key={o.k}
                    onPress={() => setWoChoice(o.k)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: woChoice === o.k }}
                    style={[styles.choice, woChoice === o.k && styles.choiceOn]}
                  >
                    <Text style={styles.choiceTitle}>{o.t}</Text>
                    <Text style={styles.choiceSub}>{o.s}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => saveWo(sheetCourt)}
                  style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.ctaLabel}>
                    {woChoice === 'played'
                      ? 'Volver a los juegos'
                      : woChoice === 'favor'
                        ? 'Guardar W.O. a favor'
                        : 'Guardar W.O. en contra'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setWoMode(false);
                    if (isTablet) setOpenCourt(null);
                  }}
                  style={styles.linkWrap}
                >
                  <Text style={styles.linkMuted}>Cancelar</Text>
                </Pressable>
              </>
            ) : (
              <>
                {sheetMatch.forfeit ? (
                  <View style={[styles.woCard, sheetMatch.forfeitUs && { borderColor: c.error }]}>
                    <Text style={[styles.woText, { color: sheetMatch.forfeitUs ? c.error : c.accent }]}>
                      {sheetMatch.forfeitUs ? 'W.O. en contra · la pista es suya' : 'W.O. a favor · la pista es nuestra'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <SetsTable sets={toScores(sheetMatch)} usLabel={ourName} themLabel={opponentName} />
                    {canEdit ? (
                      <SetsEditor
                        sets={toScores(sheetMatch)}
                        usLabel="Nosotros"
                        themLabel="Rival"
                        allowSuperTiebreak
                        onChange={(si, side, v) => {
                          updateSet(sheetCourt, si, side, v === null ? '' : String(v));
                          persistCellDebounced(sheetCourt, si);
                        }}
                      />
                    ) : null}
                  </>
                )}

                {!canEdit ? (
                  <Text style={styles.sheetBody}>
                    {closed
                      ? 'Acta cerrada: no se puede cambiar.'
                      : !started
                        ? 'Aún no ha empezado el partido.'
                        : playerWithoutFicha
                          ? 'Vincula tu ficha para apuntar.'
                          : 'Solo lectura.'}
                  </Text>
                ) : null}

                <View style={styles.sheetFoot}>
                  {canEdit ? (
                    <Pressable
                      onPress={() => {
                        setWoChoice(sheetMatch.forfeit ? (sheetMatch.forfeitUs ? 'contra' : 'favor') : 'favor');
                        setWoMode(true);
                      }}
                      hitSlop={6}
                    >
                      <Text style={styles.linkMuted}>Otro resultado (W.O.)</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    onPress={() => setOpenCourt(null)}
                    style={({ pressed }) => [styles.ctaSm, pressed && { opacity: 0.85 }]}
                  >
                    <IconCheck size={14} color={c.textInverse} />
                    <Text style={styles.ctaSmLabel}>Listo</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </>
  );

  // ── Tablet: rejilla de pistas ─────────────────────────────────────
  if (isTablet) {
    const courtCard = (ci: number) => {
      const m = matches[ci];
      if (!m) return null;
      const o = matchOutcome(m);
      const saving =
        [...savingCells].some((k) => k.startsWith(`${ci}-`)) || savingForfeit === ci;
      const saved = [...savedCells].some((k) => k.startsWith(`${ci}-`));
      const mine = myIdx === ci && !isCaptain;
      const doneSets = m.sets.filter((x) => x.us !== '' && x.them !== '' && x.us !== x.them).length;
      return (
        <View
          key={ci}
          style={[
            styles.tCard,
            mine && { borderColor: c.accent40 },
            activeCourt === ci && canEdit && styles.tCardOn,
          ]}
        >
          <View style={styles.tHead}>
            <View style={styles.tBadge}>
              <Text style={styles.tBadgeText}>P{ci + 1}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tTitle} numberOfLines={1}>
                {labelOf(ci)}
              </Text>
              <Text style={styles.tSub} numberOfLines={1}>
                {mine ? 'Tu partido · ' : ''}
                {m.forfeit
                  ? m.forfeitUs
                    ? 'W.O. en contra'
                    : 'W.O. a favor'
                  : o
                    ? `${o === 'won' ? 'Ganada' : 'Perdida'} en ${doneSets} sets`
                    : doneSets > 0
                      ? `Set ${Math.min(doneSets + 1, 3)} en juego`
                      : 'Sin empezar'}
              </Text>
            </View>
            {saving ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : saved ? (
              <Animated.Text entering={FadeIn.duration(160)} style={styles.saved}>
                Guardado ✓
              </Animated.Text>
            ) : o ? (
              <Text style={[styles.tOutcome, { color: o === 'won' ? c.accent : c.error }]}>
                {o === 'won' ? '✓' : '✕'}
              </Text>
            ) : null}
          </View>

          {m.forfeit ? (
            <View style={[styles.woCard, m.forfeitUs && { borderColor: c.error }]}>
              <Text style={[styles.woText, { color: m.forfeitUs ? c.error : c.accent }]}>
                {m.forfeitUs ? 'W.O. en contra · la pista es suya' : 'W.O. a favor · la pista es nuestra'}
              </Text>
            </View>
          ) : canEdit ? (
            <SetsEditor
              sets={toScores(m)}
              usLabel="Nosotros"
              themLabel="Rival"
              allowSuperTiebreak
              onChange={(si, side, v) => {
                setActiveCourt(ci);
                updateSet(ci, si, side, v === null ? '' : String(v));
                persistCellDebounced(ci, si);
              }}
            />
          ) : (
            <SetsTable sets={toScores(m)} usLabel={ourName} themLabel={opponentName} />
          )}

          {canEdit ? (
            <Pressable
              onPress={() => {
                setWoChoice(m.forfeit ? (m.forfeitUs ? 'contra' : 'favor') : 'favor');
                setWoMode(true);
                setOpenCourt(ci);
              }}
              hitSlop={6}
              style={{ alignSelf: 'flex-start' }}
            >
              <Text style={styles.linkMuted}>Otro resultado (W.O.)</Text>
            </Pressable>
          ) : null}
        </View>
      );
    };

    const scoreCell = (
      <View key="score" style={styles.tScore}>
        <Text style={styles.sheetEyebrow}>MARCADOR DEL ENCUENTRO</Text>
        <Text style={styles.tScoreBig}>
          {teamScore.us}–{teamScore.them}
        </Text>
        <Text style={[styles.tScoreStatus, { color: tint }]}>{statusLabel}</Text>
        <Text style={styles.tScoreNote}>
          {canEdit
            ? `Cada cambio se guarda solo. El acta se cierra en la Jornada${
                isCaptain ? '' : ' (lo hace el capitán)'
              }.`
            : closed
              ? 'Acta cerrada · solo lectura.'
              : 'Cerrar el acta lo hace el capitán en la Jornada.'}
        </Text>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={({ pressed }) => [styles.tScoreBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.tScoreBtnText}>
            {isCaptain && !closed ? 'Volver a la Jornada para cerrar el acta' : 'Volver a la Jornada'}
          </Text>
        </Pressable>
      </View>
    );

    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.tHeaderLeft}>
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <IconBack size={16} color={c.text} />
              <Text style={styles.backLabel}>Jornada</Text>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tHeaderTitle} numberOfLines={1}>
                J{String(matchday?.jornada_number ?? 0).padStart(2, '0')} · vs {opponentName}
              </Text>
              <Text style={styles.tHeaderSub} numberOfLines={1}>
                {[mdDate ? formatShortDay(mdDate) : null, mdTime || null, isHome ? 'en casa' : 'fuera']
                  .filter(Boolean)
                  .join(' · ')}
                {closed ? ' · acta cerrada' : started ? ' · en directo' : ''}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.tHeaderScore}>
              {teamScore.us}–{teamScore.them}
            </Text>
            <Text style={[styles.headerTag, { color: tint }]}>{statusLabel}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <Pressable
              onPress={() => reload()}
              style={({ pressed }) => [styles.errorBanner, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.errorBannerText}>
                No se pudieron cargar los resultados. Toca para reintentar.
              </Text>
            </Pressable>
          ) : null}

          {!started && !closed ? (
            <Text style={styles.notice}>
              Podrás apuntar a partir del{' '}
              {mdDate ? formatShortDay(mdDate).toLowerCase() : 'día del partido'}
              {mdTime ? ` · ${mdTime}` : ''}.
            </Text>
          ) : playerWithoutFicha && !closed ? (
            <Text style={styles.notice}>
              Vincula tu ficha para apuntar: pídele al capitán tu código de jugador.
            </Text>
          ) : null}

          <CardGrid columns={{ tabletPortrait: 2, tabletLandscape: 3 }} gap={12}>
            {order.map((ci) => courtCard(ci))}
            {scoreCell}
          </CardGrid>
        </ScrollView>

        {courtSheet}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Jornada</Text>
        </Pressable>
        {closed ? (
          <Text style={styles.headerTag}>Acta cerrada</Text>
        ) : started ? (
          <Text style={[styles.headerTag, { color: c.accent }]}>● En directo</Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <Pressable
            onPress={() => reload()}
            style={({ pressed }) => [styles.errorBanner, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.errorBannerText}>
              No se pudieron cargar los resultados. Toca para reintentar.
            </Text>
          </Pressable>
        ) : null}

        <JornadaScoreHeader
          jornadaNumber={matchday?.jornada_number ?? 0}
          date={mdDate}
          time={mdTime}
          isHome={isHome}
          teamName={ourName}
          opponent={opponentName}
          me={null}
          rival={null}
          hasResult={anyFilled || closed}
          matchStarted={started}
          us={teamScore.us}
          them={teamScore.them}
          tint={tint}
          statusLabel={statusLabel}
        />

        {!started && !closed ? (
          <Text style={styles.notice}>
            Podrás apuntar a partir del{' '}
            {mdDate ? formatShortDay(mdDate).toLowerCase() : 'día del partido'}
            {mdTime ? ` · ${mdTime}` : ''}.
          </Text>
        ) : playerWithoutFicha && !closed ? (
          <Text style={styles.notice}>
            Vincula tu ficha para apuntar: pídele al capitán tu código de jugador.
          </Text>
        ) : null}

        {myIdx != null && !isCaptain ? (
          <>
            <Text style={styles.eyebrow}>TU PARTIDO</Text>
            {rowFor(myIdx, true)}
            <Text style={styles.eyebrow}>RESTO</Text>
          </>
        ) : null}
        <View style={{ gap: 8 }}>{rest.map((ci) => rowFor(ci, false))}</View>

        <Text style={styles.footNote}>
          {canEdit
            ? 'Se guarda solo · cerrar el acta lo hace el capitán en la Jornada'
            : closed
              ? 'Acta cerrada · solo lectura'
              : 'Cerrar el acta lo hace el capitán en la Jornada'}
        </Text>
      </ScrollView>

      {courtSheet}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    // ── Tablet ──
    tHeaderLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
    tHeaderTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    tHeaderSub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    tHeaderScore: {
      fontFamily: Fonts.mono,
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
      letterSpacing: -0.5,
    },
    tCard: {
      gap: 10,
      padding: 12,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard,
    },
    tCardOn: { borderColor: c.accent, borderWidth: 1.5 },
    tHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tBadgeText: { fontFamily: Fonts.mono, fontSize: 12.5, fontWeight: '700', color: c.accent },
    tTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    tSub: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
    tOutcome: { fontSize: 16, fontWeight: '800' },
    tScore: {
      gap: 10,
      padding: 16,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgRaised,
      alignItems: 'center',
    },
    tScoreBig: {
      fontFamily: Fonts.mono,
      fontSize: 40,
      fontWeight: '700',
      letterSpacing: -1,
      color: c.text,
    },
    tScoreStatus: { fontSize: 13, fontWeight: '700' },
    tScoreNote: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
    tScoreBtn: {
      alignSelf: 'stretch',
      height: 42,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    tScoreBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    backBtn: {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    headerTag: { fontFamily: Fonts.mono, fontSize: 11.5, color: c.textFaint, letterSpacing: 0.6 },
    scroll: { paddingHorizontal: 16, gap: 10 },
    errorBanner: {
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: 'rgba(255,107,107,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,107,107,0.4)',
    },
    errorBannerText: { color: c.error, fontSize: 13, fontWeight: '600' },
    notice: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 8 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.textFaint,
      fontWeight: '500',
      marginTop: 4,
    },
    footNote: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 6 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '500',
    },
    sheetTitle: { color: c.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginTop: 2 },
    sheetBody: { color: c.textMuted, fontSize: 13 },
    saved: { fontFamily: Fonts.mono, fontSize: 11.5, color: c.accent },
    sheetFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    linkWrap: { alignSelf: 'center', paddingVertical: 6 },
    linkMuted: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
    choice: {
      padding: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    choiceOn: { borderColor: c.accent, backgroundColor: c.accent10 },
    choiceTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    choiceSub: { color: c.textFaint, fontSize: 12, marginTop: 2 },
    woCard: {
      padding: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.bgCard,
    },
    woText: { fontSize: 14, fontWeight: '700' },
    cta: {
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    ctaLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    ctaSm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: c.accent,
    },
    ctaSmLabel: { color: c.textInverse, fontSize: 14, fontWeight: '700' },
  });
