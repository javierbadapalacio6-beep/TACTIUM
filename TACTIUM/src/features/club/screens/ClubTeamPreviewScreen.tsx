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

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import { matchdayState } from '@core/utils/matchday';

import type { ClubTeamsStackScreenProps } from '@navigation/types';

/**
 * Dashboard READ-ONLY de un equipo concreto, accesible desde el tab
 * "Equipos" (rol club_admin). Muestra stats agregadas, próxima jornada
 * (con info de si la alineación ya está hecha) y lista navegable de
 * jornadas. Al tap en una jornada navega a JornadaScreen — que ya queda
 * read-only para club_admin gracias a `selectIsCaptain = false`.
 *
 * IMPORTANTE: este screen NO ofrece crear temporadas, ni jornadas, ni
 * editar resultados. El gestor que quiera hacerlo cambia a Modo Capitán
 * desde Profile (los triggers DB le hacen captain real de sus teams).
 */
export const ClubTeamPreviewScreen = ({
  navigation,
}: ClubTeamsStackScreenProps<'ClubTeamPreview'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);

  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays] = useState<MatchdaysApi.Matchday[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!team) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const s = await SeasonsApi.fetchActiveSeason(team.id);
          if (cancelled) return;
          setSeason(s);
          if (!s) {
            setMatchdays([]);
            return;
          }
          const mds = await MatchdaysApi.fetchMatchdays(s.id);
          if (cancelled) return;
          setMatchdays(mds);
        } catch (e) {
          console.warn('ClubTeamPreview load', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [team]),
  );

  // Stats agregadas
  const stats = useMemo(() => {
    const wins = matchdays.filter((m) => m.outcome === 'win').length;
    const losses = matchdays.filter((m) => m.outcome === 'loss').length;
    const draws = matchdays.filter((m) => m.outcome === 'draw').length;
    const played = wins + losses + draws;
    const total = matchdays.length;
    return { played, total, wins, losses, draws };
  }, [matchdays]);

  // Próxima jornada: la primera sin outcome ordenada por número.
  const nextMatchday = useMemo(
    () => matchdays.find((m) => m.outcome === null) ?? null,
    [matchdays],
  );

  const teamMeta = [team?.category, team?.league, team?.gender]
    .filter(Boolean)
    .join(' · ');

  if (!team) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.empty}>Selecciona un equipo desde la lista.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Equipos</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>EQUIPO</Text>
        <Text style={styles.title} numberOfLines={1}>
          {team.name}
        </Text>
        {teamMeta ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {teamMeta}
          </Text>
        ) : null}

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <>
            {/* Stats card */}
            <View style={styles.statsCard}>
              <Stat label="Jugadas" value={`${stats.played}/${stats.total}`} />
              <View style={styles.statsDivider} />
              <Stat
                label="Victorias"
                value={String(stats.wins)}
                color={c.accent}
              />
              <View style={styles.statsDivider} />
              <Stat
                label="Derrotas"
                value={String(stats.losses)}
                color={c.error}
              />
              <View style={styles.statsDivider} />
              <Stat label="Empates" value={String(stats.draws)} />
            </View>

            {/* Próxima jornada */}
            {nextMatchday ? (
              <>
                <Text style={styles.sectionLabel}>
                  {matchdayState(nextMatchday) === 'pending-acta'
                    ? 'JORNADA PENDIENTE'
                    : 'PRÓXIMA JORNADA'}
                </Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate('Jornada', {
                      matchdayId: nextMatchday.id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.nextCard,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.nextJornadaNum}>
                    J·{String(nextMatchday.jornada_number).padStart(2, '0')}
                  </Text>
                  <Text style={styles.nextRival}>
                    vs. {nextMatchday.opponent}
                  </Text>
                  <Text style={styles.nextMeta}>
                    {nextMatchday.match_date ?? 'Fecha por confirmar'}
                    {nextMatchday.match_time
                      ? ` · ${nextMatchday.match_time.slice(0, 5)}`
                      : ''}
                    {' · '}
                    {nextMatchday.is_home ? 'Local' : 'Visitante'}
                  </Text>
                  <Text style={styles.nextHint}>
                    Toca para ver alineación y resultados
                  </Text>
                </Pressable>
              </>
            ) : null}

            {/* Lista completa de jornadas */}
            <Text style={styles.sectionLabel}>
              JORNADAS {season ? `· ${season.name}` : ''}
            </Text>
            {matchdays.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {season
                    ? 'Sin jornadas configuradas'
                    : 'Sin temporada activa'}
                </Text>
                <Text style={styles.emptyText}>
                  {season
                    ? 'El capitán de este equipo añadirá las jornadas.'
                    : 'El capitán debe crear una temporada para empezar.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {matchdays.map((md) => (
                  <Pressable
                    key={md.id}
                    onPress={() =>
                      navigation.navigate('Jornada', { matchdayId: md.id })
                    }
                    style={({ pressed }) => [
                      styles.matchdayRow,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={styles.matchdayNumBox}>
                      <Text style={styles.matchdayNumText}>
                        J{String(md.jornada_number).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.matchdayRival} numberOfLines={1}>
                        vs. {md.opponent}
                      </Text>
                      <Text style={styles.matchdayMeta} numberOfLines={1}>
                        {md.match_date ?? 'Sin fecha'}
                        {md.is_home ? ' · L' : ' · V'}
                      </Text>
                    </View>
                    {md.outcome ? (
                      <OutcomePill outcome={md.outcome} />
                    ) : null}
                    <IconChevron size={14} color={c.textFaint} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

interface StatProps {
  label: string;
  value: string;
  color?: string;
}
const Stat: React.FC<StatProps> = ({ label, value, color }) => {
  const c = useColors();
  const statStyles = useMemo(() => makeStatStyles(c), [c]);
  return (
  <View style={statStyles.box}>
    <Text style={[statStyles.value, color ? { color } : null]}>{value}</Text>
    <Text style={statStyles.label}>{label}</Text>
  </View>
  );
};

const OutcomePill: React.FC<{ outcome: 'win' | 'loss' | 'draw' }> = ({
  outcome,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const label = outcome === 'win' ? 'V' : outcome === 'loss' ? 'D' : 'E';
  const color =
    outcome === 'win'
      ? c.accent
      : outcome === 'loss'
        ? c.error
        : c.warning;
  const bg =
    outcome === 'win'
      ? c.accent15
      : outcome === 'loss'
        ? 'rgba(255,107,107,0.14)'
        : 'rgba(242,201,76,0.14)';
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
};

const makeStatStyles = (c: Palette) => StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  value: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: 6,
    textTransform: 'uppercase',
  },
});

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
  scroll: { paddingHorizontal: 22, paddingTop: 14 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: c.accent,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 6 },
  loaderBox: { paddingVertical: 32, alignItems: 'center' },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    marginTop: 18,
  },
  statsDivider: {
    width: 1,
    backgroundColor: c.hair,
    marginVertical: 10,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    color: c.textFaint,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 10,
  },
  nextCard: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    padding: 14,
  },
  nextJornadaNum: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  nextRival: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 10,
  },
  nextMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  nextHint: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 12,
  },
  matchdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hair,
  },
  matchdayNumBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchdayNumText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: c.text,
    letterSpacing: 0.5,
  },
  matchdayRival: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  matchdayMeta: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 3,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyCard: {
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { color: c.text, fontSize: 14, fontWeight: '600' },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  empty: { color: c.textFaint, textAlign: 'center', fontSize: 14 },
});
