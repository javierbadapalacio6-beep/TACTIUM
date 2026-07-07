import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconBack,
  IconChevron,
  IconCheck,
  IconCalendar,
  IconCourt,
  IconAlert,
  IconShare,
  IconPin,
  IconPencil,
  BottomSheet,
  DateField,
  TimeField,
  dateToIsoDate,
  dateToIsoTime,
  isoDateToDate,
  isoTimeToDate,
} from '@components/ui';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import * as LineupsApi from '@core/services/lineups';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import * as MatchResultsApi from '@core/services/matchResults';
import { getCourtsForCompetition, getPointsScheme } from '@core/data/federations';
import { captureRef } from 'react-native-view-shot';
import { LineupShareCard } from '../components/LineupShareCard';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { useMatchdayRealtime } from '@core/hooks/useMatchdayRealtime';
import { useTeamStore, selectIsCaptain } from '@store/teamStore';
import {
  formatLongDay,
  formatShortDay,
  initialsOf,
} from '@core/utils/format';
import { isMatchStarted, formatSetScore } from '@core/utils/matchday';

import type { HomeStackScreenProps } from '@navigation/types';

type Status =
  | 'pending'
  | 'scheduled'
  | 'in-progress'
  | 'won'
  | 'lost'
  | 'tied'
  | 'closed-win'
  | 'closed-loss'
  | 'closed-draw';

const STATUS_CONFIG: Record<
  Status,
  { label: string; sub: (n: number, courts: number) => string; tint: string; dim?: boolean }
> = {
  pending: {
    label: 'Sin alineación',
    sub: () => 'Crea la alineación primero',
    tint: Colors.textFaint,
    dim: true,
  },
  scheduled: {
    label: 'Pendiente',
    sub: () => 'Aún sin resultados',
    tint: Colors.textMuted,
  },
  'in-progress': {
    label: 'En curso',
    sub: (n, courts) => `${n}/${courts} partidos resueltos`,
    tint: Colors.warning,
  },
  won: {
    label: 'Victoria',
    sub: () => 'Jornada ganada',
    tint: Colors.accent,
  },
  lost: {
    label: 'Derrota',
    sub: () => 'Jornada perdida',
    tint: Colors.error,
  },
  tied: {
    label: 'Empate',
    sub: () => 'Resultado igualado',
    tint: Colors.warning,
  },
  'closed-win': {
    label: 'Victoria',
    sub: () => 'Acta cerrada · ganada',
    tint: Colors.accent,
  },
  'closed-loss': {
    label: 'Derrota',
    sub: () => 'Acta cerrada · perdida',
    tint: Colors.error,
  },
  'closed-draw': {
    label: 'Empate',
    sub: () => 'Acta cerrada · empate',
    tint: Colors.warning,
  },
};

const setWinner = (us: number | null, them: number | null) => {
  if (us == null || them == null) return null;
  if (us > them) return 'us';
  if (us < them) return 'them';
  return 'tie';
};

interface MatchOutcome {
  state: 'pending' | 'won' | 'lost' | 'partial';
  summary: string;
}

const matchOutcome = (
  results: MatchResultsApi.MatchResult[],
  court: number,
  isHome: boolean,
): MatchOutcome => {
  const sets = results
    .filter((r) => r.court_number === court)
    .sort((a, b) => a.set_number - b.set_number);
  if (sets.length === 0) return { state: 'pending', summary: '' };
  const foRow = sets.find((s) => s.forfeit);
  if (foRow) {
    // W.O.: si no nos presentamos (forfeit_us) lo perdemos; si no vino el
    // rival, lo ganamos (punto para nosotros).
    return foRow.forfeit_us
      ? { state: 'lost', summary: 'W.O.' }
      : { state: 'won', summary: 'W.O.' };
  }
  let usWon = 0;
  let themWon = 0;
  const setStrings: string[] = [];
  sets.forEach((s) => {
    if (s.us == null || s.them == null) return;
    const w = setWinner(s.us, s.them);
    if (w === 'us') usWon++;
    else if (w === 'them') themWon++;
    // Resumen mostrado siempre en orden Local-Visitante.
    setStrings.push(formatSetScore(s.us, s.them, isHome));
  });
  if (usWon >= 2) return { state: 'won', summary: setStrings.join(' · ') };
  if (themWon >= 2) return { state: 'lost', summary: setStrings.join(' · ') };
  if (setStrings.length) return { state: 'partial', summary: setStrings.join(' · ') };
  return { state: 'pending', summary: '' };
};

export const JornadaScreen = ({
  navigation,
  route,
}: HomeStackScreenProps<'Jornada'>) => {
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  // Solo captain/club_admin pueden editar/cerrar/eliminar la jornada.
  // Players ven la pantalla en read-only.
  const isCaptain = useTeamStore(selectIsCaptain);
  const gate = usePremiumGate();

  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [pairs, setPairs] = useState<LineupsApi.LineupPair[]>([]);
  const [results, setResults] = useState<MatchResultsApi.MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [manualCloseOpen, setManualCloseOpen] = useState(false);
  const [manualScoreFor, setManualScoreFor] = useState('');
  const [manualScoreAgainst, setManualScoreAgainst] = useState('');

  const targetMatchdayId = route.params?.matchdayId;

  const load = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      let md: MatchdaysApi.Matchday | null = null;
      if (targetMatchdayId) {
        md = await MatchdaysApi.fetchMatchday(targetMatchdayId);
      } else {
        const s = await SeasonsApi.fetchActiveSeason(team.id);
        if (s) md = await MatchdaysApi.fetchUpcomingMatchday(s.id);
      }
      setMatchday(md);
      if (md) {
        // JornadaScreen siempre lee de la variante activa (la "oficial").
        const activeVariant = await LineupVariantsApi.fetchActiveVariant(md.id);
        const [lineup, res, s] = await Promise.all([
          activeVariant
            ? LineupsApi.fetchLineup(activeVariant.id)
            : Promise.resolve([]),
          MatchResultsApi.fetchResults(md.id),
          SeasonsApi.fetchSeasonById(md.season_id),
        ]);
        setPairs(lineup);
        setResults(res);
        setSeason(s);
      } else {
        setPairs([]);
        setResults([]);
        setSeason(null);
      }
    } catch (e) {
      console.warn('Jornada fetch', e);
    } finally {
      setLoading(false);
    }
  }, [team, targetMatchdayId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: cualquier cambio en lineups/results/matchday del matchday
  // actual dispara un refetch. Cubre subir alineación, meter sets o cerrar
  // acta desde otro dispositivo.
  useMatchdayRealtime({ matchdayId: matchday?.id, onChange: load });

  const courts = getCourtsForCompetition(team?.federation, team?.league, team?.gender);
  // Marcador ponderado (SNP/Seniors): puntos por partido según la pista.
  const pointsScheme = getPointsScheme(team?.federation, team?.league);
  const closed = matchday?.status === 'finished';
  const lineupReady = useMemo(() => {
    if (!matchday) return false;
    const filled = pairs.filter((p) => p.player_a_id && p.player_b_id).length;
    return filled === courts;
  }, [pairs, courts, matchday]);

  const isHome = matchday?.is_home ?? true;

  const score = useMemo(() => {
    // Si la jornada tiene marcador agregado (cierre manual sin todos los
    // sets cargados), ese valor manda sobre el conteo de match_results.
    if (
      matchday?.score_for != null &&
      matchday?.score_against != null
    ) {
      return {
        won: matchday.score_for,
        lost: matchday.score_against,
        played: matchday.score_for + matchday.score_against,
      };
    }
    // Si no, calculamos desde los resultados set a set.
    let won = 0;
    let lost = 0;
    let played = 0;
    for (let c = 1; c <= courts; c++) {
      const out = matchOutcome(results, c, isHome);
      if (out.state === 'won') {
        won++;
        played++;
      } else if (out.state === 'lost') {
        lost++;
        played++;
      }
    }
    return { won, lost, played };
  }, [matchday, results, courts, isHome]);

  // Marcador en PUNTOS para ligas ponderadas (SNP: 3/3/2/2/2 · Seniors:
  // 3/3/2). Solo presentación: los standings oficiales los lleva la liga.
  const weighted = useMemo(() => {
    if (!pointsScheme) return null;
    let us = 0;
    let them = 0;
    for (let c = 1; c <= courts; c++) {
      const out = matchOutcome(results, c, isHome);
      const pts = pointsScheme[c - 1] ?? 2;
      if (out.state === 'won') us += pts;
      else if (out.state === 'lost') them += pts;
    }
    return { us, them };
  }, [pointsScheme, results, courts, isHome]);

  const matchStarted = useMemo(
    () => (matchday ? isMatchStarted(matchday) : false),
    [matchday],
  );

  // Eje rol × estado para el CTA inferior. canEditLineup gobierna si el
  // tap navega a Lineup en modo editable; navigateToLineup decide si tiene
  // sentido siquiera abrir la pantalla (player con alineación ya creada
  // entra en read-only; player sin alineación, no — el botón cambia a
  // "Volver" para no enviarle a una pantalla vacía sin opción de actuar).
  // La season cerrada bloquea edición de alineación pero NO de resultados:
  // un capitán con temporada archivada puede ver la alineación (read-only)
  // pero no editarla; los resultados siguen accesibles por otra vía.
  const seasonClosed = season ? !season.active : false;
  const canEditLineup = !closed && !seasonClosed && isCaptain;
  const navigateToLineup = !closed && (canEditLineup || lineupReady);

  const status: Status = useMemo(() => {
    if (closed) {
      if (matchday?.outcome === 'win') return 'closed-win';
      if (matchday?.outcome === 'loss') return 'closed-loss';
      return 'closed-draw';
    }
    if (!lineupReady) return 'pending';
    // Antes de la hora del partido siempre es 'scheduled' aunque
    // existieran resultados (defensa: no deberían poder grabarse).
    if (!matchStarted) return 'scheduled';
    if (score.played === 0) return 'scheduled';
    if (score.played < courts) return 'in-progress';
    if (score.won > score.lost) return 'won';
    if (score.lost > score.won) return 'lost';
    return 'tied';
  }, [closed, matchday, lineupReady, matchStarted, score, courts]);

  const closeMatch = () => {
    if (!matchday) return;
    // Si todos los partidos están resueltos, la RPC backend calcula el outcome.
    if (lineupReady && score.played === courts) {
      Alert.alert(
        'Cerrar acta',
        'Una vez cerrada no podrás editar la alineación ni los resultados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar acta',
            style: 'destructive',
            onPress: async () => {
              setClosing(true);
              try {
                const updated = await MatchdaysApi.closeMatchday(matchday.id);
                setMatchday(updated);
              } catch (e: any) {
                Alert.alert('No se pudo cerrar', e?.message ?? '');
              } finally {
                setClosing(false);
              }
            },
          },
        ],
      );
      return;
    }
    // Caso retroactivo: faltan resultados → preguntar el outcome manualmente.
    setManualCloseOpen(true);
  };

  // Marcador obligatorio para cerrar el acta manualmente. Reglas:
  //   - Ambos campos rellenos con número >= 0.
  //   - Ambos <= courts (no tiene sentido marcar 10-0 en una federación de 3).
  //   - Suma === courts (todas las pistas tienen un resultado al cerrar).
  // El clamp por court se hace también al teclear (onChangeText).
  const scoreForNum = manualScoreFor.trim() === '' ? null : Number(manualScoreFor);
  const scoreAgainstNum =
    manualScoreAgainst.trim() === '' ? null : Number(manualScoreAgainst);
  const manualScoreFilled = scoreForNum !== null && scoreAgainstNum !== null;
  const manualScoreSum = manualScoreFilled
    ? (scoreForNum as number) + (scoreAgainstNum as number)
    : null;
  const manualScoreSumOk = manualScoreSum === courts;
  const manualScoreInRange =
    manualScoreFilled &&
    (scoreForNum as number) >= 0 &&
    (scoreForNum as number) <= courts &&
    (scoreAgainstNum as number) >= 0 &&
    (scoreAgainstNum as number) <= courts;
  const manualScoreReady =
    manualScoreFilled && manualScoreInRange && manualScoreSumOk;

  // Clamp helper: digits únicamente y máximo `courts` (1 dígito basta para
  // federaciones hasta 9 pistas; 2 dígitos por si crecen).
  const clampScore = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 2);
    if (digits === '') return '';
    const n = Math.min(Number(digits), courts);
    return String(n);
  };

  const handleManualClose = async (outcome: 'win' | 'draw' | 'loss') => {
    if (!matchday || !manualScoreReady) return;
    const scoreFor = Number(manualScoreFor);
    const scoreAgainst = Number(manualScoreAgainst);
    setManualCloseOpen(false);
    setClosing(true);
    try {
      const updated = await MatchdaysApi.forceCloseMatchday(
        matchday.id,
        outcome,
        scoreFor,
        scoreAgainst,
      );
      setMatchday(updated);
      setManualScoreFor('');
      setManualScoreAgainst('');
    } catch (e: any) {
      Alert.alert('No se pudo cerrar', e?.message ?? '');
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!matchday) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('HomeRoot');
            }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <IconBack size={16} color={Colors.text} />
            <Text style={styles.backLabel}>Inicio</Text>
          </Pressable>
        </View>
        <View style={[styles.center, { flex: 1, padding: 24 }]}>
          <Text style={styles.emptyTitle}>Sin jornada activa</Text>
          <Text style={styles.emptyText}>
            Crea una jornada en Temporadas para empezar a planificar.
          </Text>
        </View>
      </View>
    );
  }

  // El botón "Cerrar acta" solo está disponible si:
  //  - la jornada no está cerrada todavía, Y
  //  - el partido ya ha empezado (no tiene sentido marcar V/E/D antes de la
  //    hora oficial — al igual que la introducción de resultados).
  // Si faltan resultados pero el partido ya empezó, se cierra manualmente
  // con un sheet que pide el marcador final.
  const canClose = isCaptain && !closed && matchStarted;
  const closeIsManual =
    !closed && (!lineupReady || score.played < courts);
  const dateObj = isoDateToDate(matchday.match_date);
  const longDate = dateObj ? formatLongDay(dateObj) : 'Fecha por confirmar';
  const time = matchday.match_time?.slice(0, 5) ?? '';
  const venueLabel =
    matchday.location?.trim() ||
    (matchday.is_home ? 'Pista local · Sin especificar' : 'Pista visitante · Sin especificar');

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
          <IconBack size={16} color={Colors.text} />
          <Text style={styles.backLabel}>Inicio</Text>
        </Pressable>
        <View style={styles.navRight}>
          {!closed && isCaptain ? (
            <Pressable
              onPress={() => setEditing(true)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconPencil size={14} color={Colors.text} />
            </Pressable>
          ) : null}
          {isCaptain && lineupReady ? (
            // Compartir la alineación es una acción "de capitán" — solo
            // el cap decide cuándo notificar al equipo. Players ya la
            // reciben/ven via realtime; no necesitan re-compartirla y
            // mostrarles el botón sugería ambigüedad sobre quién manda.
            <Pressable
              onPress={() => setShowShare(true)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconShare size={14} color={Colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* === EYEBROW + TITULAR === */}
        <Text style={styles.eyebrow}>
          JORNADA {String(matchday.jornada_number).padStart(2, '0')}
          {season ? ` · ${season.name}` : ''}
        </Text>
        <Text style={styles.title}>vs. {matchday.opponent}</Text>

        {/* === INFO CARD === */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoHeaderLeft}>
              <View style={styles.rivalAvatar}>
                <Text style={styles.rivalAvatarText}>
                  {initialsOf(matchday.opponent)}
                </Text>
              </View>
              <View>
                <Text style={styles.infoEyebrow}>RIVAL</Text>
                <Text style={styles.rivalName} numberOfLines={1}>
                  {matchday.opponent}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.venuePill,
                matchday.is_home
                  ? styles.venuePillHome
                  : styles.venuePillAway,
              ]}
            >
              <Text
                style={[
                  styles.venuePillText,
                  {
                    color: matchday.is_home
                      ? Colors.accent
                      : Colors.textMuted,
                  },
                ]}
              >
                {matchday.is_home ? '● LOCAL' : '○ VISITANTE'}
              </Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaIcon}>
              <IconCalendar size={14} color={Colors.textMuted} />
            </View>
            <View style={styles.metaContent}>
              <Text style={styles.metaPrimary}>{longDate}</Text>
              {time ? <Text style={styles.metaSecondary}>{time}</Text> : null}
            </View>

            <View style={styles.metaIcon}>
              <IconPin size={14} color={Colors.textMuted} />
            </View>
            <View style={styles.metaContent}>
              <Text style={styles.metaMuted}>{venueLabel}</Text>
            </View>

            {/* Tandas (distribución de las parejas en turnos). Solo se
                muestra si el capitán fijó la tanda en la jornada — para
                muchas ligas amateur no aplica y mostrar 'Sin tanda' sería
                ruido visual. */}
            {matchday.tandas ? (
              <>
                <View style={styles.metaIcon}>
                  <IconCourt size={14} color={Colors.textMuted} />
                </View>
                <View style={styles.metaContent}>
                  <Text style={styles.metaPrimary}>
                    Tandas {matchday.tandas}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* === RESULT CARD === */}
        <ResultCard
          status={status}
          us={score.won}
          them={score.lost}
          played={score.played}
          courts={courts}
          isHome={isHome}
          onPress={() => {
            if (!lineupReady) return;
            if (!matchStarted) {
              const niceDate = dateObj
                ? `${formatLongDay(dateObj)}${time ? ` a las ${time}` : ''}`
                : 'la fecha del partido';
              Alert.alert(
                'Aún no se pueden cargar resultados',
                `Podrás introducirlos a partir de ${niceDate}.`,
              );
              return;
            }
            gate(
              () =>
                navigation.navigate('Results', {
                  matchdayId: matchday.id,
                  focus: 0,
                }),
              'results_edit',
            )();
          }}
        />

        {weighted && score.played > 0 ? (
          <Text style={styles.weightedText}>
            Marcador en puntos: {weighted.us} – {weighted.them}
            {weighted.us === weighted.them && score.played === courts
              ? '  (empate)'
              : ''}
          </Text>
        ) : null}

        {/* === ALINEACIÓN HEADER === */}
        <View style={styles.lineupHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Alineación</Text>
            <Text style={styles.sectionTitle}>{courts} parejas</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: lineupReady
                  ? Colors.accent15
                  : 'rgba(242,201,76,0.15)',
                borderColor: lineupReady
                  ? Colors.accent40
                  : 'rgba(242,201,76,0.40)',
              },
            ]}
          >
            <View
              style={[
                styles.statusPillDot,
                {
                  backgroundColor: lineupReady ? Colors.accent : Colors.warning,
                },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                { color: lineupReady ? Colors.accent : Colors.warning },
              ]}
            >
              {lineupReady ? 'VALIDADA' : 'PENDIENTE'}
            </Text>
          </View>
        </View>

        {/* === PAIR + RESULT INLINE LIST === */}
        <View style={{ gap: 8 }}>
          {Array.from({ length: courts }).map((_, i) => {
            const court = i + 1;
            const pair = pairs.find((p) => p.court_number === court);
            const out = matchOutcome(results, court, isHome);
            return (
              <PairResultRow
                key={court}
                court={court}
                isTop={court === 1}
                ready={lineupReady}
                playerA={pair?.player_a_name ?? null}
                playerB={pair?.player_b_name ?? null}
                pts={pair?.pair_points ?? null}
                outcome={out}
                disabled={!lineupReady || closed || !matchStarted}
                onPress={gate(
                  () =>
                    navigation.navigate('Results', {
                      matchdayId: matchday.id,
                      focus: i,
                    }),
                  'results_edit',
                )}
              />
            );
          })}
        </View>

        {/* Court order rule */}
        {lineupReady ? (
          <View style={styles.ruleBox}>
            <IconAlert size={14} color={Colors.textFaint} />
            <Text style={styles.ruleText}>
              {pointsScheme ? (
                <>
                  Orden automático por{' '}
                  <Text style={{ color: Colors.text, fontWeight: '500' }}>
                    suma de puntos
                  </Text>
                  . P1 y P2 valen 3 puntos; el resto, 2.
                </>
              ) : (
                <>
                  Pareja con{' '}
                  <Text style={{ color: Colors.text, fontWeight: '500' }}>
                    más puntos
                  </Text>{' '}
                  en P1. Orden descendente.
                </>
              )}
            </Text>
          </View>
        ) : null}

        {/* Cerrar acta — solo captain. Players no ven el botón. */}
        {!closed && isCaptain ? (
          <>
            <Pressable
              onPress={gate(closeMatch, 'matchday_close')}
              disabled={!canClose || closing}
              style={({ pressed }) => [
                styles.closeCta,
                (!canClose || closing) && { opacity: 0.4 },
                pressed && canClose && !closing && { opacity: 0.85 },
              ]}
            >
              {closing ? (
                <ActivityIndicator color={Colors.error} />
              ) : (
                <>
                  <IconCheck size={16} color={Colors.error} />
                  <Text style={styles.closeCtaLabel}>Cerrar acta</Text>
                </>
              )}
            </Pressable>
            {!matchStarted ? (
              <Text style={styles.closeHint}>
                El acta podrá cerrarse cuando empiece el partido.
              </Text>
            ) : closeIsManual ? (
              <Text style={styles.closeHint}>
                Faltan resultados. Al cerrar tendrás que indicar el resultado
                final manualmente (V/E/D).
              </Text>
            ) : null}
          </>
        ) : null}

        {/* === ELIMINAR JORNADA · solo captain === */}
        {/* Discreto al final. Confirma 2 veces (Alert) y borra en cascada
            todas las dependencias (lineups, resultados). Players nunca ven
            este botón — RLS de Supabase de todas formas rechazaría. */}
        {isCaptain ? (
          <Pressable
            onPress={() => {
              Alert.alert(
                'Eliminar jornada',
                `Vas a borrar la jornada J·${String(matchday.jornada_number).padStart(2, '0')} vs ${matchday.opponent}. Se eliminarán también las alineaciones y resultados asociados. Esta acción no se puede deshacer.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await MatchdaysApi.deleteMatchday(matchday.id);
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('HomeRoot');
                      } catch (e: any) {
                        Alert.alert(
                          'No se pudo eliminar',
                          e?.message ?? 'Inténtalo de nuevo.',
                        );
                      }
                    },
                  },
                ],
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Eliminar jornada"
            style={({ pressed }) => [
              styles.deleteJornada,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.deleteJornadaLabel}>Eliminar jornada</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* === CTA ===
          Depende de DOS ejes: estado de la jornada (cerrada vs abierta) y
          rol del usuario (capitán vs resto). Combinaciones:
           · Cerrada                  → "Volver" (el resultado ya se ve arriba).
           · Abierta · capitán        → "Editar/Crear alineación" (puede editar).
           · Abierta · player/admin   → "Ver alineación" si existe, "Volver"
             si no — entrar a una pantalla read-only vacía no aporta nada y
             confunde (el bug que motivó este cambio: un player veía "Crear
             alineación" y entraba a una pantalla que internamente bloqueaba
             edición). */}
      <View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom, 18) },
        ]}
      >
        <Pressable
          onPress={
            navigateToLineup
              ? () =>
                  navigation.navigate('Lineup', { matchdayId: matchday.id })
              : () => {
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.navigate('HomeRoot');
                }
          }
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          {navigateToLineup ? (
            <IconCourt size={20} color="#000" />
          ) : (
            <IconCheck size={18} color="#000" />
          )}
          <Text style={styles.ctaLabel}>
            {closed
              ? 'Volver'
              : canEditLineup
              ? lineupReady
                ? 'Editar alineación'
                : 'Crear alineación'
              : lineupReady
              ? 'Ver alineación'
              : 'Volver'}
          </Text>
        </Pressable>
      </View>

      <EditMatchdaySheet
        open={editing}
        onClose={() => setEditing(false)}
        matchday={matchday}
        onSaved={(updated) => {
          setMatchday(updated);
          setEditing(false);
        }}
      />

      <ShareLineupSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        matchday={matchday}
        season={season}
        pairs={pairs}
        teamName={team?.name ?? '—'}
      />

      <BottomSheet
        open={manualCloseOpen}
        onClose={() => !closing && setManualCloseOpen(false)}
        scrollable={false}
      >
        <Text style={styles.manualCloseEyebrow}>CERRAR ACTA · MANUAL</Text>
        <Text style={styles.manualCloseTitle}>Sin todos los resultados</Text>
        <Text style={styles.manualCloseLede}>
          Vas a cerrar la jornada sin todos los partidos cargados. Indica
          el marcador final y cómo terminó.
        </Text>

        <View style={styles.manualScoreBlock}>
          <Text style={styles.manualScoreLabel}>MARCADOR · OBLIGATORIO</Text>
          <View style={styles.manualScoreRow}>
            <View style={styles.manualScoreSlot}>
              <Text style={styles.manualScoreSlotLabel}>NOSOTROS</Text>
              <TextInput
                value={manualScoreFor}
                onChangeText={(v) => setManualScoreFor(clampScore(v))}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={Colors.textFaint}
                style={[styles.manualScoreInput, { color: Colors.accent }]}
                editable={!closing}
              />
            </View>
            <Text style={styles.manualScoreSep}>·</Text>
            <View style={styles.manualScoreSlot}>
              <Text style={styles.manualScoreSlotLabel}>RIVAL</Text>
              <TextInput
                value={manualScoreAgainst}
                onChangeText={(v) => setManualScoreAgainst(clampScore(v))}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={Colors.textFaint}
                style={styles.manualScoreInput}
                editable={!closing}
              />
            </View>
          </View>
        </View>

        <View style={styles.manualCloseRow}>
          {(
            [
              { label: 'Victoria', short: 'V', outcome: 'win', tint: Colors.accent },
              { label: 'Empate',   short: 'E', outcome: 'draw', tint: Colors.warning },
              { label: 'Derrota',  short: 'D', outcome: 'loss', tint: Colors.error },
            ] as const
          ).map((opt) => {
            const disabled = closing || !manualScoreReady;
            return (
              <Pressable
                key={opt.outcome}
                onPress={() => handleManualClose(opt.outcome)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.manualCloseBtn,
                  {
                    borderColor: `${opt.tint}66`,
                    backgroundColor: `${opt.tint}1A`,
                  },
                  disabled && { opacity: 0.35 },
                  pressed && !disabled && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.manualCloseBtnShort, { color: opt.tint }]}>
                  {opt.short}
                </Text>
                <Text style={[styles.manualCloseBtnLabel, { color: opt.tint }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!manualScoreFilled ? (
          <Text style={styles.manualCloseHint}>
            Introduce el marcador (Nosotros · Rival) para poder cerrar el acta.
          </Text>
        ) : !manualScoreSumOk ? (
          <Text style={styles.manualCloseHint}>
            El marcador debe sumar {courts} (total de pistas). Llevas{' '}
            {manualScoreSum}.
          </Text>
        ) : null}

        <Pressable
          onPress={() => setManualCloseOpen(false)}
          disabled={closing}
          style={({ pressed }) => [
            styles.manualCloseCancel,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.manualCloseCancelLabel}>Cancelar</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
};

// ============= RESULT CARD =============

const ResultCard: React.FC<{
  status: Status;
  us: number;
  them: number;
  played: number;
  courts: number;
  isHome: boolean;
  onPress: () => void;
}> = ({ status, us, them, played, courts, isHome, onPress }) => {
  const cfg = STATUS_CONFIG[status];
  const showScore =
    status !== 'pending' && status !== 'scheduled';
  const interactive = status !== 'pending';

  // Marcador físico Local-Visitante: el lado izquierdo siempre es local,
  // el derecho visitante. El tinte (accent/error/warning) se aplica al
  // número de "nosotros" para identificarlo a primera vista.
  const leftValue = isHome ? us : them;
  const rightValue = isHome ? them : us;
  const leftIsUs = isHome;

  return (
    <Pressable
      onPress={interactive ? onPress : undefined}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.resultCard,
        showScore && { borderColor: cfg.tint + '66' },
        cfg.dim && { opacity: 0.55 },
        pressed && interactive && { opacity: 0.9 },
      ]}
    >
      {showScore ? (
        <View
          style={[styles.resultEdge, { backgroundColor: cfg.tint }]}
        />
      ) : null}

      <View style={{ paddingLeft: showScore ? 6 : 0, flex: 1 }}>
        <View
          style={[
            styles.resultBadge,
            { backgroundColor: cfg.tint + '26' },
          ]}
        >
          <View
            style={[styles.resultBadgeDot, { backgroundColor: cfg.tint }]}
          />
          <Text style={[styles.resultBadgeText, { color: cfg.tint }]}>
            {cfg.label}
          </Text>
        </View>
        <Text style={styles.resultSub}>{cfg.sub(played, courts)}</Text>
      </View>

      <View style={styles.resultScore}>
        <Text
          style={[
            styles.resultScoreNum,
            {
              color: !showScore
                ? Colors.textFaint
                : leftIsUs
                  ? cfg.tint
                  : Colors.text,
            },
          ]}
        >
          {showScore ? leftValue : '—'}
        </Text>
        <View style={styles.resultScoreSep} />
        <Text
          style={[
            styles.resultScoreNum,
            {
              color: !showScore
                ? Colors.textFaint
                : leftIsUs
                  ? Colors.text
                  : cfg.tint,
            },
          ]}
        >
          {showScore ? rightValue : '—'}
        </Text>
      </View>
    </Pressable>
  );
};

// ============= PAIR + RESULT ROW =============

const PairResultRow: React.FC<{
  court: number;
  isTop: boolean;
  ready: boolean;
  playerA: string | null;
  playerB: string | null;
  pts: number | null;
  outcome: MatchOutcome;
  disabled: boolean;
  onPress: () => void;
}> = ({
  court,
  isTop,
  ready,
  playerA,
  playerB,
  pts,
  outcome,
  disabled,
  onPress,
}) => {
  const tint =
    outcome.state === 'won'
      ? Colors.accent
      : outcome.state === 'lost'
      ? Colors.error
      : outcome.state === 'partial'
      ? Colors.warning
      : null;

  const badge =
    outcome.state === 'won'
      ? { label: 'V', tint: Colors.accent, a11y: 'Victoria' }
      : outcome.state === 'lost'
      ? { label: 'D', tint: Colors.error, a11y: 'Derrota' }
      : outcome.state === 'partial'
      ? { label: '·', tint: Colors.warning, a11y: 'En juego' }
      : null;

  const borderColor = tint
    ? tint + '4D'
    : isTop && ready
    ? Colors.accent25
    : Colors.hair;

  const label = ready
    ? playerA && playerB
      ? `${playerA} / ${playerB}`
      : 'Sin asignar'
    : 'Sin asignar';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pairRow,
        { borderColor },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <View style={styles.pairTopRow}>
        <View
          style={[
            styles.pairBadge,
            isTop && ready && {
              backgroundColor: Colors.accent15,
              borderColor: Colors.accent40,
            },
          ]}
        >
          <Text style={styles.pairBadgeP}>P</Text>
          <Text
            style={[
              styles.pairBadgeNum,
              isTop && ready && { color: Colors.accent },
            ]}
          >
            {court}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.pairLabel,
              !ready && { color: Colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View style={styles.pairMetaRow}>
            {isTop && ready ? (
              <View style={styles.topTag}>
                <Text style={styles.topTagText}>TOP</Text>
              </View>
            ) : null}
            {ready ? (
              pts != null ? (
                <Text style={styles.pairPts}>{pts} pts</Text>
              ) : null
            ) : (
              <Text style={styles.pairMetaFaint}>Pendiente</Text>
            )}
          </View>
        </View>

        {badge ? (
          <View
            accessible
            accessibilityLabel={badge.a11y}
            style={[
              styles.outcomeBadge,
              {
                backgroundColor: badge.tint + '26',
                borderColor: badge.tint + '4D',
              },
            ]}
          >
            <Text style={[styles.outcomeBadgeText, { color: badge.tint }]}>
              {badge.label}
            </Text>
          </View>
        ) : ready && !disabled ? (
          <View style={styles.addResultChip}>
            <Text style={styles.addResultChipText}>+ RESULTADO</Text>
          </View>
        ) : null}
      </View>

      {ready && outcome.summary ? (
        <View style={styles.setsRow}>
          <Text style={styles.setsLabel}>SETS</Text>
          <Text
            style={[
              styles.setsValue,
              { color: tint ?? Colors.text },
            ]}
          >
            {outcome.summary}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

// ============= EDIT MATCHDAY SHEET =============

const EditMatchdaySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  matchday: MatchdaysApi.Matchday;
  onSaved: (m: MatchdaysApi.Matchday) => void;
}> = ({ open, onClose, matchday, onSaved }) => {
  const [opponent, setOpponent] = useState(matchday.opponent);
  const [matchDate, setMatchDate] = useState<Date | null>(
    isoDateToDate(matchday.match_date),
  );
  const [matchTime, setMatchTime] = useState<Date | null>(
    isoTimeToDate(matchday.match_time),
  );
  const [isHome, setIsHome] = useState(matchday.is_home);
  const [location, setLocation] = useState(matchday.location ?? '');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setOpponent(matchday.opponent);
      setMatchDate(isoDateToDate(matchday.match_date));
      setMatchTime(isoTimeToDate(matchday.match_time));
      setIsHome(matchday.is_home);
      setLocation(matchday.location ?? '');
    }
  }, [open, matchday]);

  const submit = async () => {
    if (!opponent.trim() || submitting) return;
    setSubmitting(true);
    try {
      const updated = await MatchdaysApi.updateMatchday(matchday.id, {
        opponent: opponent.trim(),
        match_date: matchDate ? dateToIsoDate(matchDate) : null,
        match_time: matchTime ? dateToIsoTime(matchTime) : null,
        is_home: isHome,
        location: location.trim() || null,
      });
      onSaved(updated);
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? '');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          disabled={submitting || !opponent.trim()}
          onPress={submit}
          style={({ pressed }) => [
            styles.sheetCta,
            (submitting || !opponent.trim()) && { opacity: 0.4 },
            pressed && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#001810" />
          ) : (
            <Text style={styles.sheetCtaLabel}>Guardar cambios</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>
        EDITAR · J·{String(matchday.jornada_number).padStart(2, '0')}
      </Text>
      <Text style={styles.sheetTitle}>Detalles de la jornada</Text>

      <Text style={styles.sheetLabel}>RIVAL</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={opponent}
          onChangeText={setOpponent}
          placeholder="Club Visitante"
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
        />
      </View>

      <Text style={styles.sheetLabel}>DÓNDE SE JUEGA</Text>
      <View style={styles.venueRow}>
        <Pressable
          onPress={() => setIsHome(true)}
          style={[styles.venueCell, isHome && styles.venueCellActive]}
        >
          <Text
            style={[
              styles.venueCellLabel,
              { color: isHome ? '#001810' : Colors.text },
            ]}
          >
            Local
          </Text>
          <Text
            style={[
              styles.venueCellSub,
              { color: isHome ? 'rgba(0,24,16,0.6)' : Colors.textFaint },
            ]}
          >
            En nuestras pistas
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsHome(false)}
          style={[styles.venueCell, !isHome && styles.venueCellActive]}
        >
          <Text
            style={[
              styles.venueCellLabel,
              { color: !isHome ? '#001810' : Colors.text },
            ]}
          >
            Visitante
          </Text>
          <Text
            style={[
              styles.venueCellSub,
              { color: !isHome ? 'rgba(0,24,16,0.6)' : Colors.textFaint },
            ]}
          >
            Fuera de casa
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sheetLabel}>FECHA</Text>
      <DateField
        value={matchDate}
        onChange={setMatchDate}
        placeholder="Seleccionar fecha"
        label="FECHA DEL PARTIDO"
        allowClear
      />

      <Text style={styles.sheetLabel}>HORA</Text>
      <TimeField
        value={matchTime}
        onChange={setMatchTime}
        placeholder="Seleccionar hora"
        label="HORA DEL PARTIDO"
        allowClear
      />

      <Text style={styles.sheetLabel}>LUGAR</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Pádel Club Norte"
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
        />
      </View>
    </BottomSheet>
  );
};

// ============= SHARE LINEUP SHEET =============

const ShareLineupSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  matchday: MatchdaysApi.Matchday;
  season: SeasonsApi.Season | null;
  pairs: LineupsApi.LineupPair[];
  teamName: string;
}> = ({ open, onClose, matchday, season, pairs, teamName }) => {
  const dateObj = isoDateToDate(matchday.match_date);
  const shortDate = dateObj ? formatShortDay(dateObj) : 'Fecha pendiente';
  const time = matchday.match_time?.slice(0, 5) ?? '';

  const text = [
    `🎾 *TACTIUM · ${teamName} · J·${String(matchday.jornada_number).padStart(2, '0')}*`,
    `${matchday.is_home ? 'Local' : 'Visitante'} · vs. ${matchday.opponent}`,
    `${shortDate}${time ? ` · ${time}` : ''}${
      season ? ` · ${season.name}` : ''
    }`,
    ``,
    `*Alineación*`,
    ...pairs
      .sort((a, b) => (a.court_number ?? 0) - (b.court_number ?? 0))
      .map(
        (p) =>
          `P${p.court_number} — ${p.player_a_name ?? '—'} / ${
            p.player_b_name ?? '—'
          }${p.pair_points != null ? `  (${p.pair_points} pts)` : ''}`,
      ),
    ``,
    `Recuerda confirmar disponibilidad 🟢`,
  ].join('\n');

  const cardRef = React.useRef<View>(null);

  // Comparte la tarjeta de marca como IMAGEN (view-shot). Si el binario
  // actual no incluye el módulo nativo, degradamos a texto con aviso.
  const shareImage = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri }
          : ({ message: text, url: uri } as never),
      );
      onClose();
    } catch {
      Alert.alert(
        'Imagen disponible en el próximo build',
        'Este binario aún no incluye la captura de imagen. Te comparto el texto mientras tanto.',
      );
      await shareNative();
    }
  };

  const shareWhatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
    onClose();
  };

  const shareNative = async () => {
    try {
      await Share.share({ message: text });
    } catch (e) {
      // user cancelled
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>COMPARTIR ALINEACIÓN</Text>
      <Text style={styles.sheetTitle}>Avisa al equipo</Text>

      <View style={styles.shareCardWrap}>
        <View ref={cardRef} collapsable={false}>
          <LineupShareCard
            teamName={teamName}
            matchday={matchday}
            season={season}
            pairs={pairs}
            shortDate={shortDate}
            time={time}
          />
        </View>
      </View>

      <View style={styles.shareGrid}>
        <Pressable
          onPress={shareImage}
          style={({ pressed }) => [
            styles.shareCell,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View
            style={[styles.shareCellIcon, { backgroundColor: Colors.accent15 }]}
          >
            <Text style={{ fontSize: 22 }}>🖼️</Text>
          </View>
          <Text style={[styles.shareCellLabel, { color: Colors.accent }]}>
            Imagen
          </Text>
        </Pressable>

        <Pressable
          onPress={shareWhatsapp}
          style={({ pressed }) => [
            styles.shareCell,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.shareCellIcon, { backgroundColor: '#25D36622' }]}>
            <Text style={{ fontSize: 22 }}>💬</Text>
          </View>
          <Text style={[styles.shareCellLabel, { color: '#25D366' }]}>
            WhatsApp
          </Text>
        </Pressable>

        <Pressable
          onPress={shareNative}
          style={({ pressed }) => [
            styles.shareCell,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View
            style={[
              styles.shareCellIcon,
              { backgroundColor: Colors.accent15 },
            ]}
          >
            <IconShare size={20} color={Colors.accent} />
          </View>
          <Text style={[styles.shareCellLabel, { color: Colors.accent }]}>
            Compartir
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onClose}
        style={({ pressed }) => [
          styles.shareCloseBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.shareCloseLabel}>Cerrar</Text>
      </Pressable>
    </BottomSheet>
  );
};

// ============= STYLES =============

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
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
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.9,
    lineHeight: 32,
  },
  // Info card
  infoCard: {
    marginTop: 18,
    padding: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    position: 'relative',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hair,
  },
  infoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  rivalAvatar: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: 'rgba(0,223,130,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rivalAvatarText: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  infoEyebrow: {
    fontSize: 9,
    color: Colors.textFaint,
    letterSpacing: 1.5,
    fontFamily: Fonts.mono,
    fontWeight: '500',
    marginBottom: 1,
  },
  rivalName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    maxWidth: 180,
  },
  venuePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  venuePillHome: {
    backgroundColor: Colors.accent15,
    borderColor: 'rgba(0,223,130,0.35)',
  },
  venuePillAway: {
    backgroundColor: 'transparent',
    borderColor: Colors.hairStrong,
  },
  venuePillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 12,
    alignItems: 'center',
  },
  metaIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  metaPrimary: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  metaSecondary: {
    color: Colors.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  metaMuted: {
    color: Colors.textMuted,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  // Result card
  resultCard: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  resultEdge: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    marginBottom: 6,
  },
  resultBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  resultBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  resultSub: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  resultScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultScoreNum: {
    fontFamily: Fonts.mono,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1,
    lineHeight: 32,
  },
  resultScoreSep: {
    width: 1,
    height: 24,
    backgroundColor: Colors.hairStrong,
  },
  // Lineup header
  lineupHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 2.4,
    fontWeight: '500',
    marginBottom: 2,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusPillDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Pair rows
  pairRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pairTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pairBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairBadgeP: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.textFaint,
    letterSpacing: 0.6,
    fontWeight: '500',
    lineHeight: 9,
  },
  pairBadgeNum: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: Colors.text,
    lineHeight: 18,
  },
  pairLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.15,
    marginBottom: 3,
  },
  pairMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.accent15,
  },
  topTagText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  pairPts: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  pairMetaFaint: {
    fontSize: 11,
    color: Colors.textFaint,
  },
  outcomeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  addResultChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairStrong,
  },
  addResultChipText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textFaint,
    fontWeight: '600',
    letterSpacing: 1,
  },
  setsRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setsLabel: {
    fontSize: 9,
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    letterSpacing: 1.4,
    fontWeight: '500',
  },
  setsValue: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  // Rule box
  weightedText: {
    marginTop: 10,
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  ruleBox: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    flex: 1,
  },
  // Cerrar acta
  closeCta: {
    marginTop: 22,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    backgroundColor: 'rgba(255,107,107,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  closeCtaLabel: { color: Colors.error, fontSize: 14, fontWeight: '600' },
  closeHint: {
    color: Colors.textFaint,
    fontSize: 11,
    fontFamily: Fonts.mono,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  // CTA bottom
  ctaWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#000',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // Sheet shared
  sheetEyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 8,
  },
  sheetLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  sheetInputWrap: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetInput: {
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  sheetCta: {
    height: 52,
    marginTop: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetCtaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
  },
  venueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  venueCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'flex-start',
  },
  venueCellActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  venueCellLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  venueCellSub: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    marginTop: 3,
  },
  // Share sheet
  shareCardWrap: {
    alignItems: 'center',
    marginBottom: 6,
  },
  sharePreview: {
    marginTop: 12,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hair,
    maxHeight: 220,
  },
  sharePreviewText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  shareGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  shareCell: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
    gap: 8,
  },
  shareCellIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCellLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  shareCloseBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCloseLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },

  // Cierre manual de acta
  // (BottomSheet ya aplica gap:14 entre hijos directos — sin marginBottom aquí)
  manualCloseEyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.warning,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  manualCloseTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  manualCloseLede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  manualScoreBlock: {
    alignSelf: 'stretch',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  manualScoreLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 1.6,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  manualScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  manualScoreSlot: {
    flex: 1,
    alignItems: 'center',
  },
  manualScoreSlotLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textFaint,
    letterSpacing: 1.4,
    fontWeight: '500',
    marginBottom: 4,
  },
  manualScoreInput: {
    width: 64,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
  },
  manualScoreSep: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    color: Colors.textFaint,
    fontWeight: '600',
  },
  manualCloseRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 4,
  },
  manualCloseBtn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 18,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualCloseBtnShort: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 2,
  },
  manualCloseBtnLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  manualCloseHint: {
    fontFamily: Fonts.mono,
    color: Colors.warning,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: -4,
  },
  deleteJornada: {
    alignSelf: 'center',
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  deleteJornadaLabel: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  manualCloseCancel: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  manualCloseCancelLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
