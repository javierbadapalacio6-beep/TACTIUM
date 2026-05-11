import React, { useEffect, useMemo, useState } from 'react';
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

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconCheck, IconChevron } from '@components/ui';
import * as MatchdaysApi from '@core/services/matchdays';
import * as MatchResultsApi from '@core/services/matchResults';
import * as LineupsApi from '@core/services/lineups';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import { getCourtsForCompetition } from '@core/data/federations';
import { isMatchStarted, formatSetScore } from '@core/utils/matchday';
import { useTeamStore } from '@store/teamStore';

import type { HomeStackScreenProps } from '@navigation/types';

const SETS = 3;

interface SetCell {
  us: string;
  them: string;
}

interface Match {
  sets: SetCell[];
  forfeit: boolean;
}

const buildEmptyMatches = (courts: number): Match[] =>
  Array.from({ length: courts }, () => ({
    sets: Array.from({ length: SETS }, () => ({ us: '', them: '' })),
    forfeit: false,
  }));

const matchOutcome = (m: Match): 'won' | 'lost' | null => {
  if (m.forfeit) return 'lost';
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
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  const courts = getCourtsForCompetition(team?.federation, team?.league, team?.gender);
  const matchdayId = route.params.matchdayId;
  const focus = route.params.focus ?? 0;

  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  const [matches, setMatches] = useState<Match[]>(() => buildEmptyMatches(courts));
  const [pairs, setPairs] = useState<LineupsApi.LineupPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(Math.min(focus, courts - 1));
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savingForfeit, setSavingForfeit] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setExpanded((e) => Math.min(e, courts - 1));
  }, [courts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // ResultsScreen también opera sobre la variante activa.
        const activeVariant =
          await LineupVariantsApi.fetchActiveVariant(matchdayId);
        const [md, results, lineup] = await Promise.all([
          MatchdaysApi.fetchMatchday(matchdayId),
          MatchResultsApi.fetchResults(matchdayId),
          activeVariant
            ? LineupsApi.fetchLineup(activeVariant.id)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setMatchday(md);
        setPairs(lineup);
        const next = buildEmptyMatches(courts);
        results.forEach((r) => {
          const ci = r.court_number - 1;
          const si = r.set_number - 1;
          if (ci < 0 || ci >= courts || si < 0 || si >= SETS) return;
          if (r.forfeit) next[ci].forfeit = true;
          next[ci].sets[si] = {
            us: r.us !== null ? String(r.us) : '',
            them: r.them !== null ? String(r.them) : '',
          };
        });
        setMatches(next);
      } catch (e) {
        console.warn('Results fetch', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchdayId, courts]);

  const closed = matchday?.status === 'finished';
  const started = matchday ? isMatchStarted(matchday) : false;
  const canEdit = started && !closed;

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
    setMatches((ms) =>
      ms.map((m, i) =>
        i !== court
          ? m
          : {
              ...m,
              sets: m.sets.map((s, j) =>
                j !== setIdx ? s : { ...s, [side]: sanitized },
              ),
            },
      ),
    );
  };

  /**
   * Si todos los partidos tienen outcome resuelto (V/D vía sets o W.O.),
   * cierra el acta automáticamente. La RPC backend calcula el outcome final
   * y marca status='finished'. Idempotente: si ya está cerrada, no hace nada.
   */
  const maybeAutoClose = async (current: Match[]) => {
    if (closing) return;
    if (matchday?.status === 'finished') return;
    const allResolved = current.every((m) => matchOutcome(m) !== null);
    if (!allResolved) return;
    setClosing(true);
    try {
      const updated = await MatchdaysApi.closeMatchday(matchdayId);
      setMatchday(updated);
      Alert.alert(
        'Acta cerrada',
        'Todos los partidos están registrados. La jornada queda como jugada.',
        [
          {
            text: 'Volver a Jornada',
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('HomeRoot');
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('No se pudo cerrar acta', e?.message ?? '');
    } finally {
      setClosing(false);
    }
  };

  const persistCell = async (court: number, setIdx: number) => {
    if (!canEdit) return;
    const cell = matches[court].sets[setIdx];
    const us = cell.us !== '' ? Number(cell.us) : null;
    const them = cell.them !== '' ? Number(cell.them) : null;
    setSavingCell(`${court}-${setIdx}`);
    try {
      await MatchResultsApi.upsertSet(matchdayId, court + 1, setIdx + 1, us, them);
      await maybeAutoClose(matches);
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? '');
    } finally {
      setSavingCell(null);
    }
  };

  const toggleForfeit = async (court: number) => {
    if (!canEdit) return;
    const next = !matches[court].forfeit;
    // Calculamos el nuevo estado explícitamente para poder pasárselo al
    // auto-cierre sin depender de la actualización async de useState.
    const nextMatches: Match[] = matches.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            forfeit: next,
            sets: next ? m.sets.map(() => ({ us: '', them: '' })) : m.sets,
          },
    );
    setMatches(nextMatches);
    setSavingForfeit(court);
    try {
      await MatchResultsApi.setCourtForfeit(matchdayId, court + 1, next, SETS);
      await maybeAutoClose(nextMatches);
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? '');
      // Rollback
      setMatches((ms) =>
        ms.map((m, i) => (i !== court ? m : { ...m, forfeit: !next })),
      );
    } finally {
      setSavingForfeit(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.accent} />
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
          <IconBack size={16} color={Colors.text} />
          <Text style={styles.backLabel}>Jornada</Text>
        </Pressable>
        <Text style={styles.headerCount}>{playedLabel}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 22 },
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
            colors={[Colors.bgCard, Colors.bgCard2]}
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
                { color: anyFilled ? Colors.accent : Colors.textFaint },
              ]}
            >
              {anyFilled ? teamScore.us : '—'}
            </Text>
            <View style={styles.aggregateDivider} />
            <Text
              style={[
                styles.aggregateScore,
                { color: anyFilled ? Colors.text : Colors.textFaint },
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
                savingCell={savingCell}
                savingForfeit={savingForfeit === ci}
                isHome={isHome}
                homeName={homeName}
                awayName={awayName}
                onToggleExpand={() =>
                  setExpanded((e) => (e === ci ? -1 : ci))
                }
                onUpdateCell={(setIdx, side, value) =>
                  updateSet(ci, setIdx, side, value)
                }
                onPersistCell={(setIdx) => persistCell(ci, setIdx)}
                onToggleForfeit={() => toggleForfeit(ci)}
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
          <IconCheck size={18} color={Colors.textInverse} />
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
  savingCell: string | null;
  savingForfeit: boolean;
  isHome: boolean;
  homeName: string;
  awayName: string;
  onToggleExpand: () => void;
  onUpdateCell: (setIdx: number, side: 'us' | 'them', value: string) => void;
  onPersistCell: (setIdx: number) => void;
  onToggleForfeit: () => void;
}> = ({
  court,
  match,
  label,
  expanded,
  disabled,
  outcome,
  savingCell,
  savingForfeit,
  isHome,
  homeName,
  awayName,
  onToggleExpand,
  onUpdateCell,
  onPersistCell,
  onToggleForfeit,
}) => {
  const tint =
    outcome === 'won'
      ? Colors.accent
      : outcome === 'lost'
        ? Colors.error
        : Colors.textFaint;

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
    ? 'No presentado'
    : setSummary || 'Sin resultado';

  return (
    <View
      style={[
        styles.row,
        { borderColor: expanded ? Colors.hairStrong : Colors.hair },
      ]}
    >
      <Pressable
        onPress={onToggleExpand}
        style={({ pressed }) => [styles.rowHeader, pressed && { opacity: 0.85 }]}
      >
        <View
          style={[
            styles.courtBadge,
            court === 0 && {
              backgroundColor: Colors.accent10,
            },
          ]}
        >
          <Text
            style={[
              styles.courtBadgeText,
              { color: court === 0 ? Colors.accent : Colors.text },
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
          <View style={styles.outcomePill}>
            <Text style={styles.outcomePillTextMuted}>—</Text>
          </View>
        )}

        <View
          style={[
            styles.chevWrap,
            expanded && { transform: [{ rotate: '90deg' }] },
          ]}
        >
          <IconChevron size={14} color={Colors.textFaint} />
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
                    ? Colors.error
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
                  color: match.forfeit ? Colors.error : Colors.textMuted,
                },
              ]}
            >
              No presentado / W.O.
            </Text>
            {savingForfeit ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : null}
          </Pressable>

          {!match.forfeit ? (
            <>
              {/* Cabecera equipos: Local · {nombre} | Visit. · {nombre} */}
              <View style={styles.teamsHeader}>
                <View style={styles.teamsHeaderSlot}>
                  <Text style={styles.teamsHeaderTag}>LOCAL</Text>
                  <Text
                    style={[
                      styles.teamsHeaderName,
                      isHome && { color: Colors.accent },
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
                      !isHome && { color: Colors.accent },
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
                  saving={savingCell === `${court}-${i}`}
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
  onChange: (side: 'us' | 'them', value: string) => void;
  onBlurCell: () => void;
}> = ({ setIdx, cell, isHome, disabled, saving, onChange, onBlurCell }) => {
  const leftSide: 'us' | 'them' = isHome ? 'us' : 'them';
  const rightSide: 'us' | 'them' = isHome ? 'them' : 'us';
  const leftValue = cell[leftSide];
  const rightValue = cell[rightSide];

  return (
    <View style={styles.setLine}>
      <Text style={styles.setLineLabel}>
        SET {setIdx + 1}
        {setIdx === 2 ? ' · OPC.' : ''}
      </Text>
      <View style={styles.setLineInputs}>
        <ScoreCell
          value={leftValue}
          accent={leftSide === 'us'}
          disabled={disabled}
          saving={saving}
          onChange={(v) => onChange(leftSide, v)}
          onBlurCell={onBlurCell}
        />
        <Text style={styles.setLineSep}>·</Text>
        <ScoreCell
          value={rightValue}
          accent={rightSide === 'us'}
          disabled={disabled}
          saving={saving}
          onChange={(v) => onChange(rightSide, v)}
          onBlurCell={onBlurCell}
        />
      </View>
    </View>
  );
};

// ─── ScoreCell ──────────────────────────────────────────────────────────────
const ScoreCell: React.FC<{
  value: string;
  accent: boolean;
  disabled: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onBlurCell: () => void;
}> = ({ value, accent, disabled, saving, onChange, onBlurCell }) => (
  <View style={styles.scoreCellWrap}>
    <TextInput
      value={value}
      onChangeText={onChange}
      onBlur={onBlurCell}
      keyboardType="number-pad"
      maxLength={2}
      editable={!disabled}
      placeholder="·"
      placeholderTextColor={Colors.textFaint}
      style={[
        styles.scoreCell,
        { color: accent && value ? Colors.accent : Colors.text },
        disabled && { opacity: 0.5 },
      ]}
    />
    {saving ? (
      <View style={styles.scoreCellSaving}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    ) : null}
  </View>
);

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
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
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  headerCount: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
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
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 30,
  },
  lede: {
    color: Colors.textMuted,
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
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  aggregateSide: { flex: 1, minWidth: 0 },
  aggregateSideLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  aggregateSideSub: {
    color: Colors.textMuted,
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
    backgroundColor: Colors.hairStrong,
  },

  // Row card
  row: {
    backgroundColor: Colors.bgCard,
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
    backgroundColor: Colors.bgRaised,
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
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowSummary: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textFaint,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  outcomePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.hair,
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
    color: Colors.textFaint,
    letterSpacing: 0.5,
  },
  chevWrap: { width: 14, alignItems: 'center' },
  rowBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: Colors.hair,
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
    color: Colors.textFaint,
    letterSpacing: 1.6,
    fontWeight: '500',
  },
  teamsHeaderName: {
    color: Colors.text,
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
    color: Colors.textMuted,
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
    color: Colors.textFaint,
  },
  scoreCellWrap: {
    flex: 1,
    position: 'relative',
  },
  scoreCell: {
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
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
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
