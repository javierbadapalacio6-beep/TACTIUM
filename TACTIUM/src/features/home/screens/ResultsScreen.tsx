import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconCheck, IconChevron } from '@components/ui';
import * as MatchdaysApi from '@core/services/matchdays';
import * as MatchResultsApi from '@core/services/matchResults';
import * as LineupsApi from '@core/services/lineups';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import { useMatchdayRealtime } from '@core/hooks/useMatchdayRealtime';
import { getCourtsForCompetition } from '@core/data/federations';
import { isMatchStarted, formatSetScore } from '@core/utils/matchday';
import { useTeamStore, selectIsCaptain, selectIsPlayer } from '@store/teamStore';

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
  // presentó el rival (victoria, punto para nosotros). Solo si forfeit=true.
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

export const ResultsScreen = ({
  navigation,
  route,
}: HomeStackScreenProps<'Results'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  // Capitán Y jugadores del equipo pueden cargar el resultado (feedback Smash
  // 2026-07-21: quitar trabajo al capitán). CERRAR el acta sigue siendo del
  // capitán (botón en JornadaScreen + el RPC close_matchday exige team_admin).
  // La RLS `match_results_member_*` permite escribir a cualquier team_member.
  const isCaptain = useTeamStore(selectIsCaptain);
  const isPlayer = useTeamStore(selectIsPlayer);
  const courts = getCourtsForCompetition(team?.federation, team?.league, team?.gender);
  const matchdayId = route.params.matchdayId;
  const focus = route.params.focus ?? 0;

  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  const [matches, setMatches] = useState<Match[]>(() => buildEmptyMatches(courts));
  const [pairs, setPairs] = useState<LineupsApi.LineupPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(Math.min(focus, courts - 1));
  // savingCells = SET de strings `${court}-${setIdx}` — varias celdas
  // pueden estar guardando a la vez en pistas distintas. Antes era un
  // string único y el spinner se "robaba" entre celdas.
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  // savedCells = checkmark verde efímero tras guardar bien. Da feedback
  // positivo cuando la red estuvo lenta y el spinner duró varios segundos.
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());
  const [savingForfeit, setSavingForfeit] = useState<number | null>(null);
  // Debounce timers + requestId por celda. Map<key, { timer, seq }> donde
  // `seq` se incrementa con cada llamada y permite descartar respuestas
  // antiguas si llegan después de una nueva (race con red lenta).
  const persistTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const persistSeqRef = useRef<Map<string, number>>(new Map());
  // Espejo síncrono de `matches`. Necesario porque `doPersistCell` se ejecuta
  // dentro de un `setTimeout` programado en `persistCellDebounced` — el
  // closure capturado al programar el timer vería `matches` del render
  // PREVIO al keystroke, no del posterior. Leyendo de `matchesRef.current`
  // siempre obtenemos los valores tipeados más recientes. Era el bug por
  // el que sets 2/3 se perdían al salir antes del blur.
  const matchesRef = useRef<Match[]>(matches);
  matchesRef.current = matches;

  useEffect(() => {
    setExpanded((e) => Math.min(e, courts - 1));
  }, [courts]);

  // Refetch reusable: lo llama el mount inicial y también el realtime
  // cuando llega un cambio externo (otro device metiendo sets, captain
  // cerrando acta, lineup cambiando para repintar las parejas del header).
  const reload = useCallback(async () => {
    try {
      const activeVariant =
        await LineupVariantsApi.fetchActiveVariant(matchdayId);
      const [md, results, lineup] = await Promise.all([
        MatchdaysApi.fetchMatchday(matchdayId),
        MatchResultsApi.fetchResults(matchdayId),
        activeVariant
          ? LineupsApi.fetchLineup(activeVariant.id)
          : Promise.resolve([]),
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
      matchesRef.current = next;
      setMatches(next);
    } catch (e) {
      console.warn('Results fetch', e);
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
  const canEdit = started && !closed && (isCaptain || isPlayer);

  // ── Score agregado ──
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

  const anyFilled = teamScore.played > 0;

  const updateSet = (
    court: number,
    setIdx: number,
    side: 'us' | 'them',
    value: string,
  ) => {
    if (!canEdit) return;
    if (value !== '' && !/^\d+$/.test(value)) return;
    const sanitized = value.slice(0, 2);
    // Actualizamos matchesRef PRIMERO de forma síncrona — así, si el user
    // teclea y pulsa Back antes de que React aplique el re-render, el
    // flush en cleanup todavía leerá el valor fresco desde el ref.
    const next = matchesRef.current.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            sets: m.sets.map((s, j) =>
              j !== setIdx ? s : { ...s, [side]: sanitized },
            ),
          },
    );
    matchesRef.current = next;
    setMatches(next);
  };

  // El cierre del acta NO es automático tras introducir el último resultado.
  // El capitán debe poder revisar y corregir antes de cerrar. La acción de
  // cerrar vive como botón explícito en `JornadaScreen`.

  // Guardado real al servidor (run inmediato — no chequear debounce aquí).
  // Lee la celda DESDE `matchesRef.current` (no `matches` directo) para
  // tener siempre los valores tipeados más recientes — `matches` capturado
  // en closure puede estar stale cuando el timer dispara o el unmount
  // flushea pendientes.
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
      // Si en el camino otra request más reciente arrancó (seq mayor),
      // descartamos esta respuesta — no marcamos como guardada con
      // valores potencialmente obsoletos.
      if (persistSeqRef.current.get(key) !== seq) return;
      setSavedCells((s) => new Set(s).add(key));
      // El check verde desaparece tras 1.2 s.
      setTimeout(() => {
        setSavedCells((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }, 1200);
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

  // Versión debounced — la que llama el TextInput onChange. Programa el
  // guardado 600 ms tras el último tecleo en esa misma celda. Si el user
  // sigue tecleando, se cancela y reprograma.
  const persistCellDebounced = (court: number, setIdx: number) => {
    if (!canEdit) return;
    const key = `${court}-${setIdx}`;
    const existing = persistTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      persistTimersRef.current.delete(key);
      doPersistCell(court, setIdx);
    }, 600);
    persistTimersRef.current.set(key, t);
  };

  // Flush inmediato: usado en onBlur y en unmount para forzar el guardado
  // de cualquier debounce pendiente. Si ya no hay timer, no hace nada.
  const flushCell = (court: number, setIdx: number) => {
    const key = `${court}-${setIdx}`;
    const timer = persistTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      persistTimersRef.current.delete(key);
      doPersistCell(court, setIdx);
    }
  };

  // Al desmontar: flushea cualquier timer pendiente (dispara guardado
  // inmediato con últimos valores). Sin esto, si el user sale a <600ms
  // del último tecleo, esa edición se pierde porque el timer se cancela.
  // Captura las keys en closure para no leer state stale.
  const flushAllRef = useRef<() => void>(() => {});
  flushAllRef.current = () => {
    const timers = persistTimersRef.current;
    timers.forEach((t, key) => {
      clearTimeout(t);
      const [c, s] = key.split('-').map(Number);
      doPersistCell(c, s);
    });
    timers.clear();
  };
  useEffect(() => {
    return () => {
      flushAllRef.current();
    };
  }, []);

  const toggleForfeit = async (court: number) => {
    if (!canEdit) return;
    const cur = matchesRef.current[court];
    const next = !cur.forfeit;
    // Al activar, por defecto W.O. a NUESTRO favor (el rival no se presentó),
    // que es el caso normal en el acta propia. Se conserva la dirección previa.
    const forfeitUs = next ? cur.forfeitUs : false;
    const nextMatches: Match[] = matchesRef.current.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            forfeit: next,
            forfeitUs,
            sets: next ? m.sets.map(() => ({ us: '', them: '' })) : m.sets,
          },
    );
    matchesRef.current = nextMatches;
    setMatches(nextMatches);
    setSavingForfeit(court);
    try {
      await MatchResultsApi.setCourtForfeit(
        matchdayId,
        court + 1,
        next,
        forfeitUs,
        SETS,
      );
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? '');
      const rollback = matchesRef.current.map((m, i) =>
        i !== court ? m : { ...m, forfeit: !next },
      );
      matchesRef.current = rollback;
      setMatches(rollback);
    } finally {
      setSavingForfeit(null);
    }
  };

  // Cambia la dirección del W.O. (ganado/perdido) sin desactivarlo.
  const setForfeitDirection = async (court: number, forfeitUs: boolean) => {
    if (!canEdit) return;
    const cur = matchesRef.current[court];
    if (!cur.forfeit || cur.forfeitUs === forfeitUs) return;
    const nextMatches = matchesRef.current.map((m, i) =>
      i !== court ? m : { ...m, forfeitUs },
    );
    matchesRef.current = nextMatches;
    setMatches(nextMatches);
    setSavingForfeit(court);
    try {
      await MatchResultsApi.setCourtForfeit(
        matchdayId,
        court + 1,
        true,
        forfeitUs,
        SETS,
      );
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? '');
      const rollback = matchesRef.current.map((m, i) =>
        i !== court ? m : { ...m, forfeitUs: cur.forfeitUs },
      );
      matchesRef.current = rollback;
      setMatches(rollback);
    } finally {
      setSavingForfeit(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const playedLabel = `${String(teamScore.played).padStart(2, '0')} / ${String(courts).padStart(2, '0')}`;
  const opponentName = matchday?.opponent ?? 'Rival';
  const isHome = matchday?.is_home ?? true;
  const ourName = team?.name ?? 'Equipo';
  const homeName = isHome ? ourName : opponentName;
  const awayName = isHome ? opponentName : ourName;

  return (
    <View style={styles.root}>
      {/* === NAV === */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('HomeRoot');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Jornada</Text>
        </Pressable>
        <Text style={styles.headerCount}>{playedLabel}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* === HERO === */}
        <View style={styles.heroBlock}>
          <Text style={styles.eyebrow}>
            JORNADA {String(matchday?.jornada_number ?? 0).padStart(2, '0')}
            {' · RESULTADO'}
          </Text>
          <Text style={styles.title}>
            {closed
              ? 'Acta cerrada'
              : !started
                ? 'Aún no disponible'
                : 'Añade los marcadores'}
          </Text>
          <Text style={styles.lede}>
            {closed
              ? 'No se pueden modificar resultados.'
              : !started
                ? `Podrás introducir resultados a partir de ${
                    matchday?.match_date
                      ? `${matchday.match_date}${
                          matchday.match_time
                            ? ` · ${matchday.match_time.slice(0, 5)}`
                            : ''
                        }`
                      : 'la fecha del partido'
                  }.`
              : 'Toca cada pareja para introducir sets. Se guarda automáticamente.'}
          </Text>
        </View>

        {/* === SCORE AGREGADO === */}
        <View style={styles.aggregateCard}>
          <LinearGradient
            colors={[c.bgCard, c.bgCard2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.aggregateSide}>
            <Text style={styles.aggregateSideLabel} numberOfLines={1}>
              {team?.name ?? 'Equipo'}
            </Text>
            <Text style={styles.aggregateSideSub}>
              {matchday?.is_home ? 'Local' : 'Visitante'}
            </Text>
          </View>
          <View style={styles.aggregateScoreRow}>
            <Text
              style={[
                styles.aggregateScore,
                { color: anyFilled ? c.accent : c.textFaint },
              ]}
            >
              {anyFilled ? teamScore.us : '—'}
            </Text>
            <View style={styles.aggregateDivider} />
            <Text
              style={[
                styles.aggregateScore,
                { color: anyFilled ? c.text : c.textFaint },
              ]}
            >
              {anyFilled ? teamScore.them : '—'}
            </Text>
          </View>
          <View style={[styles.aggregateSide, { alignItems: 'flex-end' }]}>
            <Text style={styles.aggregateSideLabel} numberOfLines={1}>
              {opponentName}
            </Text>
            <Text style={styles.aggregateSideSub}>
              {matchday?.is_home ? 'Visitante' : 'Local'}
            </Text>
          </View>
        </View>

        {/* === LISTA === */}
        <View style={{ gap: 8, marginTop: 14 }}>
          {matches.map((m, ci) => {
            const pair = pairs.find((p) => p.court_number === ci + 1);
            const label = pair
              ? `${pair.player_a_name ?? '—'} / ${pair.player_b_name ?? '—'}`
              : 'Sin alineación';
            return (
              <ResultRow
                key={ci}
                court={ci}
                match={m}
                label={label}
                expanded={expanded === ci}
                disabled={!canEdit}
                outcome={matchOutcome(m)}
                savingCells={savingCells}
                savedCells={savedCells}
                savingForfeit={savingForfeit === ci}
                isHome={isHome}
                homeName={homeName}
                awayName={awayName}
                onToggleExpand={() =>
                  setExpanded((e) => (e === ci ? -1 : ci))
                }
                onUpdateCell={(setIdx, side, value) => {
                  updateSet(ci, setIdx, side, value);
                  // Tras cada cambio, reprogramamos el debounce de esa
                  // celda. Cuando el user deje de teclear 600 ms, se
                  // dispara el guardado real con valores finales.
                  persistCellDebounced(ci, setIdx);
                }}
                onPersistCell={(setIdx) => flushCell(ci, setIdx)}
                onToggleForfeit={() => toggleForfeit(ci)}
                onSetForfeitDirection={(fu) => setForfeitDirection(ci, fu)}
              />
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('HomeRoot');
          }}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <IconCheck size={18} color={c.textInverse} />
          <Text style={styles.ctaLabel}>{canEdit ? 'Listo' : 'Volver'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

// ─── ResultRow ──────────────────────────────────────────────────────────────
const ResultRow: React.FC<{
  court: number;
  match: Match;
  label: string;
  expanded: boolean;
  disabled: boolean;
  outcome: 'won' | 'lost' | null;
  // Sets de keys `${court}-${setIdx}` para indicadores por celda.
  // Pasar Sets en vez de un único string permite múltiples spinners
  // simultáneos sin "robarse" entre celdas distintas.
  savingCells: Set<string>;
  savedCells: Set<string>;
  savingForfeit: boolean;
  isHome: boolean;
  homeName: string;
  awayName: string;
  onToggleExpand: () => void;
  onUpdateCell: (setIdx: number, side: 'us' | 'them', value: string) => void;
  onPersistCell: (setIdx: number) => void;
  onToggleForfeit: () => void;
  onSetForfeitDirection: (forfeitUs: boolean) => void;
}> = ({
  court,
  match,
  label,
  expanded,
  disabled,
  outcome,
  savingCells,
  savedCells,
  savingForfeit,
  isHome,
  homeName,
  awayName,
  onToggleExpand,
  onUpdateCell,
  onPersistCell,
  onToggleForfeit,
  onSetForfeitDirection,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tint =
    outcome === 'won'
      ? c.accent
      : outcome === 'lost'
        ? c.error
        : c.textFaint;

  // Marcador resumen: orden Local-Visitante, no Nos.-Riv.
  const setSummary = match.sets
    .filter((s) => s.us !== '' || s.them !== '')
    .map((s) =>
      formatSetScore(
        s.us !== '' ? Number(s.us) : null,
        s.them !== '' ? Number(s.them) : null,
        isHome,
      ),
    )
    .join('  ');

  const summaryText = match.forfeit
    ? match.forfeitUs
      ? 'W.O. en contra'
      : 'W.O. a favor'
    : setSummary || 'Sin resultado';

  return (
    <View
      style={[
        styles.row,
        { borderColor: expanded ? c.hairStrong : c.hair },
      ]}
    >
      <Pressable
        onPress={onToggleExpand}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${summaryText}`}
        accessibilityState={{ expanded }}
        hitSlop={4}
        style={({ pressed }) => [styles.rowHeader, pressed && { opacity: 0.85 }]}
      >
        <View
          style={[
            styles.courtBadge,
            court === 0 && {
              backgroundColor: c.accent10,
            },
          ]}
        >
          <Text
            style={[
              styles.courtBadgeText,
              { color: court === 0 ? c.accent : c.text },
            ]}
          >
            P{court + 1}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.rowSummary} numberOfLines={1}>
            {summaryText}
          </Text>
        </View>

        {outcome ? (
          <View
            accessible
            accessibilityLabel={outcome === 'won' ? 'Victoria' : 'Derrota'}
            style={[
              styles.outcomePill,
              { backgroundColor: `${tint}15`, borderColor: `${tint}40` },
            ]}
          >
            <Text style={[styles.outcomePillText, { color: tint }]}>
              {outcome === 'won' ? 'V' : 'D'}
            </Text>
          </View>
        ) : (
          <View
            accessible
            accessibilityLabel="Sin resultado"
            style={styles.outcomePill}
          >
            <Text style={styles.outcomePillTextMuted}>—</Text>
          </View>
        )}

        <View
          style={[
            styles.chevWrap,
            expanded && { transform: [{ rotate: '90deg' }] },
          ]}
        >
          <IconChevron size={14} color={c.textFaint} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.rowBody}>
          {/* Forfeit toggle */}
          <Pressable
            onPress={() => !disabled && !savingForfeit && onToggleForfeit()}
            style={({ pressed }) => [
              styles.forfeitRow,
              pressed && !disabled && { opacity: 0.85 },
              disabled && { opacity: 0.4 },
            ]}
          >
            <View
              style={[
                styles.forfeitTrack,
                {
                  backgroundColor: match.forfeit
                    ? c.accent
                    : 'rgba(232,245,239,0.12)',
                },
              ]}
            >
              <View
                style={[
                  styles.forfeitThumb,
                  { left: match.forfeit ? 17 : 3 },
                ]}
              />
            </View>
            <Text
              style={[
                styles.forfeitLabel,
                {
                  color: match.forfeit ? c.accent : c.textMuted,
                },
              ]}
            >
              W.O. (no presentado)
            </Text>
            {savingForfeit ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : null}
          </Pressable>

          {/* Dirección del W.O.: ¿quién no se presentó? Define el punto. */}
          {match.forfeit ? (
            <View style={styles.foDirRow}>
              <Pressable
                disabled={disabled}
                onPress={() =>
                  !disabled && !savingForfeit && onSetForfeitDirection(false)
                }
                style={[
                  styles.foDirBtn,
                  !match.forfeitUs && styles.foDirBtnWon,
                  disabled && { opacity: 0.4 },
                ]}
              >
                <Text
                  style={[
                    styles.foDirText,
                    !match.forfeitUs && { color: c.accent },
                  ]}
                >
                  Ganado · no vino el rival
                </Text>
              </Pressable>
              <Pressable
                disabled={disabled}
                onPress={() =>
                  !disabled && !savingForfeit && onSetForfeitDirection(true)
                }
                style={[
                  styles.foDirBtn,
                  match.forfeitUs && styles.foDirBtnLost,
                  disabled && { opacity: 0.4 },
                ]}
              >
                <Text
                  style={[
                    styles.foDirText,
                    match.forfeitUs && { color: c.error },
                  ]}
                >
                  Perdido · no vinimos
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!match.forfeit ? (
            <>
              {/* Cabecera equipos: Local · {nombre} | Visit. · {nombre} */}
              <View style={styles.teamsHeader}>
                <View style={styles.teamsHeaderSlot}>
                  <Text style={styles.teamsHeaderTag}>LOCAL</Text>
                  <Text
                    style={[
                      styles.teamsHeaderName,
                      isHome && { color: c.accent },
                    ]}
                    numberOfLines={1}
                  >
                    {homeName}
                  </Text>
                </View>
                <View style={styles.teamsHeaderSlot}>
                  <Text style={styles.teamsHeaderTag}>VISITANTE</Text>
                  <Text
                    style={[
                      styles.teamsHeaderName,
                      !isHome && { color: c.accent },
                    ]}
                    numberOfLines={1}
                  >
                    {awayName}
                  </Text>
                </View>
              </View>

              {/* Una fila por SET con marcador Local-Visitante */}
              {match.sets.map((cell, i) => (
                <SetLine
                  key={i}
                  setIdx={i}
                  cell={cell}
                  isHome={isHome}
                  disabled={disabled}
                  saving={savingCells.has(`${court}-${i}`)}
                  saved={savedCells.has(`${court}-${i}`)}
                  onChange={(side, value) =>
                    onUpdateCell(i, side, value)
                  }
                  onBlurCell={() => onPersistCell(i)}
                />
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

// ─── SetLine ────────────────────────────────────────────────────────────────
// Una fila por SET con marcador físico Local-Visitante.
// La columna que mapea a "us" se pinta en accent para identificar fácilmente
// nuestro equipo, sin importar de qué lado del marcador esté.
const SetLine: React.FC<{
  setIdx: number;
  cell: SetCell;
  isHome: boolean;
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onChange: (side: 'us' | 'them', value: string) => void;
  onBlurCell: () => void;
}> = ({ setIdx, cell, isHome, disabled, saving, saved, onChange, onBlurCell }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const leftSide: 'us' | 'them' = isHome ? 'us' : 'them';
  const rightSide: 'us' | 'them' = isHome ? 'them' : 'us';
  const leftValue = cell[leftSide];
  const rightValue = cell[rightSide];

  // Ganador del set = el número MÁS ALTO, y solo cuando AMBOS están puestos
  // (un 6-7 lo gana el 7; con un único valor todavía no hay ganador). El
  // verde debe marcar al ganador del set, no "nuestro" lado.
  const lNum = leftValue === '' ? null : Number(leftValue);
  const rNum = rightValue === '' ? null : Number(rightValue);
  const bothFilled = lNum !== null && rNum !== null;
  const leftWins = bothFilled && (lNum as number) > (rNum as number);
  const rightWins = bothFilled && (rNum as number) > (lNum as number);

  // Validación de marcador padel:
  //   - Sets 1 y 2: 0..7 (7 sólo con tiebreak desde 6-6).
  //   - Set 3 ("OPC."): super-tiebreak, hasta 15 (cubre 10-X con diferencia
  //     de 2; 15 es margen amplio).
  // Cualquier entrada mayor se clampa al máximo del set en cuestión.
  const maxForSet = setIdx === 2 ? 15 : 7;
  const sanitize = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const n = Math.min(parseInt(digits, 10), maxForSet);
    return String(n);
  };

  return (
    <View style={styles.setLine}>
      <Text style={styles.setLineLabel}>
        SET {setIdx + 1}
        {setIdx === 2 ? ' · OPC.' : ''}
      </Text>
      <View style={styles.setLineInputs}>
        <ScoreCell
          value={leftValue}
          win={leftWins}
          mine={leftSide === 'us'}
          disabled={disabled}
          saving={saving}
          saved={saved}
          onChange={(v) => onChange(leftSide, sanitize(v))}
          onBlurCell={onBlurCell}
        />
        <Text style={styles.setLineSep}>·</Text>
        <ScoreCell
          value={rightValue}
          win={rightWins}
          mine={rightSide === 'us'}
          disabled={disabled}
          saving={saving}
          saved={saved}
          onChange={(v) => onChange(rightSide, sanitize(v))}
          onBlurCell={onBlurCell}
        />
      </View>
    </View>
  );
};

// ─── ScoreCell ──────────────────────────────────────────────────────────────
const ScoreCell: React.FC<{
  value: string;
  /** true = este lado GANÓ el set (número más alto, ambos puestos). */
  win: boolean;
  /** true = es el marcador de nuestro equipo (solo para accesibilidad). */
  mine: boolean;
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onChange: (value: string) => void;
  onBlurCell: () => void;
}> = ({ value, win, mine, disabled, saving, saved, onChange, onBlurCell }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.scoreCellWrap}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlurCell}
        keyboardType="number-pad"
        maxLength={2}
        editable={!disabled}
        placeholder="·"
        placeholderTextColor={c.textFaint}
        accessibilityLabel={mine ? 'Juegos a favor' : 'Juegos del rival'}
        style={[
          styles.scoreCell,
          // Verde = GANADOR del set (el número más alto), no nuestro lado. A
          // nuestro equipo lo identifica la cabecera Local/Visitante.
          win
            ? { color: c.accent, fontWeight: '800' }
            : { color: c.text },
          disabled && { opacity: 0.5 },
        ]}
      />
      {saving ? (
        <View style={styles.scoreCellSaving}>
          <ActivityIndicator size="small" color={c.accent} />
        </View>
      ) : saved ? (
        // Check verde efímero (~1.2s) tras guardado exitoso — feedback
        // positivo cuando la red fue lenta y el spinner duró un rato.
        <View style={styles.scoreCellSaving}>
          <IconCheck size={12} color={c.accent} />
        </View>
      ) : null}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Nav
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  headerCount: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1.5,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 18 },

  // Hero
  heroBlock: { paddingHorizontal: 4, marginBottom: 6 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: c.accent,
    fontWeight: '500',
    marginBottom: 6,
  },
  title: {
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 30,
  },
  lede: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  // Aggregate
  aggregateCard: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  aggregateSide: { flex: 1, minWidth: 0 },
  aggregateSideLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  aggregateSideSub: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  aggregateScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  aggregateScore: {
    fontFamily: Fonts.mono,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  aggregateDivider: {
    width: 1,
    height: 28,
    backgroundColor: c.hairStrong,
  },

  // Row card
  row: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  courtBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rowLabel: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowSummary: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  outcomePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: c.hair,
    minWidth: 32,
    alignItems: 'center',
  },
  outcomePillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  outcomePillTextMuted: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    letterSpacing: 0.5,
  },
  chevWrap: { width: 14, alignItems: 'center' },
  rowBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: c.hair,
  },

  // Forfeit
  forfeitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  forfeitTrack: {
    width: 32,
    height: 18,
    borderRadius: 9,
    position: 'relative',
  },
  forfeitThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 3,
  },
  forfeitLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  foDirRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  foDirBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  foDirBtnWon: {
    borderColor: c.accent,
    backgroundColor: c.accent10,
  },
  foDirBtnLost: {
    borderColor: c.error,
    backgroundColor: c.error + '14',
  },
  foDirText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Cabecera con nombres de equipos (LOCAL · ... | VISIT. · ...)
  teamsHeader: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  teamsHeaderSlot: {
    flex: 1,
    minWidth: 0,
  },
  teamsHeaderTag: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: c.textFaint,
    letterSpacing: 1.6,
    fontWeight: '500',
  },
  teamsHeaderName: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginTop: 2,
  },

  // Fila de un set: [SET N]   [input local]  ·  [input visit]
  setLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  setLineLabel: {
    width: 64,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '500',
    color: c.textMuted,
  },
  setLineInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setLineSep: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    color: c.textFaint,
  },
  scoreCellWrap: {
    flex: 1,
    position: 'relative',
  },
  scoreCell: {
    height: 44,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
    fontFamily: Fonts.mono,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 0,
  },
  scoreCellSaving: {
    position: 'absolute',
    right: 4,
    top: 4,
  },

  // CTA
  cta: {
    marginTop: 20,
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: c.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
