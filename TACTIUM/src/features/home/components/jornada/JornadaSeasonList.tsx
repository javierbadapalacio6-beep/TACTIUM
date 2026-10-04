import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import { matchdayState } from '@core/utils/matchday';
import {
  fmtDay,
  fmtMatchLine,
  outcomeColor,
  phaseLabel,
  pickNextMatchday,
  scoreLabel,
} from '@features/seasons/components/ligaParts';

type Matchday = MatchdaysApi.Matchday;

/**
 * TABLET · columna izquierda de la Jornada (lista + detalle): las jornadas
 * de la temporada en Próxima · Jugadas · Pendientes, como en «Detalle de
 * temporada». Tocar una cambia el detalle sin navegar.
 *
 * La temporada sale de la jornada abierta (`anchorMatchdayId`) o, si no
 * hay, de la temporada activa del equipo. Si nada está seleccionado,
 * preselecciona la próxima jornada para que el detalle no salga vacío.
 */
export const JornadaSeasonList: React.FC<{
  teamId: string | null | undefined;
  anchorMatchdayId: string | null;
  selectedId: string | null;
  onPick: (id: string) => void;
  onBack: () => void;
  backLabel?: string;
}> = ({ teamId, anchorMatchdayId, selectedId, onPick, onBack, backLabel = 'Atrás' }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          let s: SeasonsApi.Season | null = null;
          const anchor = anchorMatchdayId
            ? await MatchdaysApi.fetchMatchday(anchorMatchdayId)
            : null;
          if (anchor) s = await SeasonsApi.fetchSeasonById(anchor.season_id);
          else if (teamId) s = await SeasonsApi.fetchActiveSeason(teamId);
          const list = s ? await MatchdaysApi.fetchMatchdays(s.id) : [];
          if (cancelled) return;
          setSeason(s);
          setMatchdays(list);
          if (!selectedId && list.length > 0) {
            const next =
              pickNextMatchday(list, (m) => matchdayState(m) !== 'played') ?? list[0];
            onPick(next.id);
          }
        } catch (e) {
          console.warn('JornadaSeasonList', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamId, anchorMatchdayId]),
  );

  const groups = useMemo(() => {
    const next = pickNextMatchday(matchdays, (m) => matchdayState(m) === 'upcoming');
    const played = matchdays
      .filter((m) => matchdayState(m) !== 'upcoming')
      .sort((a, b) => b.jornada_number - a.jornada_number);
    const pending = matchdays.filter(
      (m) => matchdayState(m) === 'upcoming' && m.id !== next?.id,
    );
    return { next, played, pending };
  }, [matchdays]);

  const playedCount = matchdays.filter((m) => m.outcome !== null).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {season ? (
            <View style={styles.seasonHead}>
              <Text style={styles.eyebrow}>
                {season.active ? '● ACTIVA · ' : ''}
                {phaseLabel(season.phase)}
              </Text>
              <Text style={styles.seasonName} numberOfLines={1}>
                {season.name}
              </Text>
              <Text style={styles.seasonMeta}>
                {playedCount}/{season.total_matchdays ?? matchdays.length} jornadas
              </Text>
            </View>
          ) : (
            <Text style={styles.empty}>No hay temporada activa.</Text>
          )}

          {groups.next ? (
            <>
              <Text style={styles.section}>PRÓXIMA</Text>
              <Row m={groups.next} selected={groups.next.id === selectedId} onPress={onPick} />
            </>
          ) : null}

          {groups.played.length > 0 ? (
            <>
              <Text style={styles.section}>JUGADAS · {groups.played.length}</Text>
              {groups.played.map((m) => (
                <Row key={m.id} m={m} selected={m.id === selectedId} onPress={onPick} />
              ))}
            </>
          ) : null}

          {groups.pending.length > 0 ? (
            <>
              <Text style={styles.section}>PENDIENTES · {groups.pending.length}</Text>
              {groups.pending.map((m) => (
                <Row key={m.id} m={m} selected={m.id === selectedId} onPress={onPick} />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

const Row: React.FC<{
  m: Matchday;
  selected: boolean;
  onPress: (id: string) => void;
}> = ({ m, selected, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const score = m.outcome !== null ? scoreLabel(m) : null;
  const tint = outcomeColor(c, m.outcome);
  const state = matchdayState(m);
  return (
    <Pressable
      onPress={() => onPress(m.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Jornada ${m.jornada_number} contra ${m.opponent}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowOn,
        pressed && !selected && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.jb, selected && styles.jbOn]}>
        <Text style={[styles.jbTxt, selected && { color: c.accent }]}>
          J{String(m.jornada_number).padStart(2, '0')}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.opp} numberOfLines={1}>
          {m.opponent}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {state === 'upcoming'
            ? fmtMatchLine(m)
            : [m.is_home ? 'Casa' : 'Fuera', fmtDay(m.match_date, false)]
                .filter(Boolean)
                .join(' · ')}
        </Text>
      </View>
      {score ? (
        <View
          style={[
            styles.score,
            { backgroundColor: withAlpha(tint, 0.14), borderColor: withAlpha(tint, 0.35) },
          ]}
        >
          <Text style={[styles.scoreTxt, { color: tint }]}>{score}</Text>
        </View>
      ) : state === 'pending-acta' ? (
        <Text style={[styles.meta, { color: c.warning }]}>Sin acta</Text>
      ) : null}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    top: { paddingHorizontal: 16, paddingBottom: 6 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    scroll: { paddingHorizontal: 16, gap: 6 },
    seasonHead: { marginBottom: 6 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.6,
      color: c.accent,
    },
    seasonName: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
    seasonMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    empty: { color: c.textMuted, fontSize: 13, paddingVertical: 20 },
    section: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.6,
      color: c.textFaint,
      marginTop: 12,
      marginBottom: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rowOn: { backgroundColor: c.accent10, borderColor: c.accent40 },
    jb: {
      width: 40,
      height: 30,
      borderRadius: 8,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      alignItems: 'center',
      justifyContent: 'center',
    },
    jbOn: { borderColor: c.accent40, backgroundColor: c.accent15 },
    jbTxt: { fontFamily: Fonts.mono, fontSize: 11.5, fontWeight: '700', color: c.textMuted },
    opp: { color: c.text, fontSize: 14, fontWeight: '600' },
    meta: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
    score: {
      minWidth: 40,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    scoreTxt: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '800' },
  });
