import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconPlus, IconPencil, IconClock } from '@components/ui';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { TeamMembersSheet } from '@features/club/components/TeamMembersSheet';
import { DeleteClubSheet } from '@features/club/components/DeleteClubSheet';
import { toast } from '@store/toastStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { clubCoverage } from '@core/entitlements/coverage';
import { useTeamGate } from '@core/hooks/usePremiumGate';
import * as ClubDashboardApi from '@core/services/clubDashboard';
import type { ClubTeamOverview } from '@core/services/clubDashboard';

import type { ClubStackScreenProps } from '@navigation/types';

const MONTH_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAY_ES[d.getDay()]} ${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}

export const ClubDashboardScreen = ({
  navigation,
}: ClubStackScreenProps<'ClubRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);

  const [membersSheet, setMembersSheet] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [overviews, setOverviews] = useState<ClubTeamOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteClub = useClubStore((s) => s.deleteClub);
  const reloadTeams = useTeamStore((s) => s.loadForUser);

  const handleDeleteClub = async () => {
    if (!club || deleting) return;
    setDeleting(true);
    try {
      await deleteClub(club.id);
      await reloadTeams();
      setDeleteOpen(false);
      toast.success('Club borrado', 'Se ha eliminado el club y su contenido.');
    } catch (e: any) {
      toast.error('No se pudo borrar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  // Cobertura dura: cuántos equipos cubre el plan y cuántos van usados.
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const coverage = clubCoverage(club?.id ?? null, teams, subscriptions);
  // Gate POR EQUIPO (no el activo): tocar un equipo no cubierto ofrece cubrirlo.
  const teamGate = useTeamGate();

  // Refresh con cancellation guard: si el user navega tabs rápido, el
  // useFocusEffect dispara reload() varias veces. Sin guard, el primer
  // fetch que termina con datos stale puede pisar el state correcto y
  // dejar la pantalla con loading colgado o data desfasada. El cleanup
  // del useFocusEffect marca `cancelled = true` cuando la screen pierde
  // foco; los setState posteriores se ignoran.
  useFocusEffect(
    useCallback(() => {
      if (clubTeams.length === 0) {
        setOverviews([]);
        setLoading(false);
        return;
      }
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const data = await ClubDashboardApi.fetchClubOverview(clubTeams);
          if (!cancelled) setOverviews(data);
        } catch (e) {
          if (!cancelled) console.warn('club overview', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [clubTeams]),
  );

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco
  // desde otra pantalla (tab o stack nested).
  const scrollRef = useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);
  const didMountRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didMountRef.current) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        didMountRef.current = true;
      }
    }, []),
  );

  const openManage = (teamId: string, teamName: string) => {
    setMembersSheet({ teamId, teamName });
  };

  // Tap en una card de Próxima jornada o Último resultado: fijamos el
  // team activo al del card (para que JornadaScreen lo lea desde el store)
  // y navegamos al detalle. Como activeRole sigue siendo club_admin, las
  // pantallas Jornada/Lineup/Results quedan read-only.
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const openMatchday = useCallback(
    async (teamId: string, matchdayId: string) => {
      try {
        await setActiveTeam(teamId);
        navigation.navigate('Jornada', { matchdayId });
      } catch (e) {
        console.warn('ClubDashboard openMatchday', e);
      }
    },
    [navigation, setActiveTeam],
  );

  if (!club) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.empty}>Sin club activo.</Text>
      </View>
    );
  }

  const upcomingCards = overviews.filter((o) => o.nextMatchday !== null);
  const lastResultCards = overviews.filter((o) => o.lastResult !== null);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <TactiumMark size={34} gradient />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>CLUB · ADMIN</Text>
            <Text style={styles.brandName} numberOfLines={1}>
              {club.name}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('ClubSchedule')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Horarios de local"
            style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.6 }]}
          >
            <IconClock size={20} color={c.text} />
          </Pressable>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          // Tab bar flotante: ~64px alto + 12px bottom offset + safe-area.
          // Sumamos colchón visual de 32px para que el último equipo no
          // quede pegado al pill cristal.
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs club */}
        <View style={styles.statsRow}>
          <Stat label="EQUIPOS" value={String(clubTeams.length)} />
          <View style={styles.statsDivider} />
          <Stat label="FEDERACIÓN" value={club.federation ?? '—'} small />
        </View>

        <Text style={styles.intro}>
          Vista global del club. Las jornadas y los resultados los gestiona el
          capitán de cada equipo — desde aquí solo administras la estructura.
        </Text>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <>
            {/* PRÓXIMAS JORNADAS */}
            {upcomingCards.length > 0 ? (
              <View>
                <SectionHeader
                  label="PRÓXIMAS JORNADAS"
                  count={upcomingCards.length}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScrollContent}
                >
                  {upcomingCards.map((o) => (
                    <NextMatchdayCard
                      key={o.team.id}
                      overview={o}
                      onPress={() =>
                        openMatchday(o.team.id, o.nextMatchday!.id)
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* ÚLTIMOS RESULTADOS */}
            {lastResultCards.length > 0 ? (
              <View>
                <SectionHeader
                  label="ÚLTIMOS RESULTADOS"
                  count={lastResultCards.length}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScrollContent}
                >
                  {lastResultCards.map((o) => (
                    <LastResultCard
                      key={o.team.id}
                      overview={o}
                      onPress={() =>
                        openMatchday(o.team.id, o.lastResult!.id)
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* EQUIPOS */}
            <SectionHeader
              label="EQUIPOS"
              count={overviews.length}
              padded
              onAdd={() => navigation.navigate('CreateTeamFromClub')}
              addLabel="Crear nuevo equipo"
            />
            {coverage.hasActiveSub ? (
              <Text style={styles.coverageLine}>
                Cubiertos por tu plan: {coverage.used}/{coverage.quota}
                {!coverage.hasFreeSlot ? ' · mejora el plan para más' : ''}
              </Text>
            ) : null}
            {overviews.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aún no hay equipos</Text>
                <Text style={styles.emptyText}>
                  Crea el primer equipo del club para empezar.
                </Text>
              </View>
            ) : (
              <View style={styles.teamList}>
                {overviews.map((o, idx) => (
                  <TeamRow
                    key={o.team.id}
                    overview={o}
                    last={idx === overviews.length - 1}
                    uncovered={coverage.hasActiveSub && !o.team.covered}
                    onManage={teamGate(
                      o.team,
                      () => openManage(o.team.id, o.team.name),
                      'club_manage_team',
                    )}
                  />
                ))}
              </View>
            )}

            {/* ZONA DE PELIGRO · borrar club (cascada irreversible) */}
            {club ? (
              <View style={styles.dangerZone}>
                <Text style={styles.dangerEyebrow}>ZONA DE PELIGRO</Text>
                <Pressable
                  onPress={() => setDeleteOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar club"
                  style={({ pressed }) => [
                    styles.deleteClubBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.deleteClubLabel}>Borrar club</Text>
                </Pressable>
                <Text style={styles.dangerHint}>
                  Elimina el club y todo su contenido. No se puede deshacer.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <TeamMembersSheet
        open={membersSheet !== null}
        teamId={membersSheet?.teamId ?? null}
        teamName={membersSheet?.teamName ?? null}
        onClose={() => setMembersSheet(null)}
      />

      <DeleteClubSheet
        visible={deleteOpen}
        clubName={club?.name ?? ''}
        loading={deleting}
        onConfirm={handleDeleteClub}
        onCancel={() => setDeleteOpen(false)}
      />
    </View>
  );
};

// ─── SectionHeader ──────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  label: string;
  count: number;
  padded?: boolean;
  onAdd?: () => void;
  addLabel?: string;
}> = ({ label, count, padded, onAdd, addLabel }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View
    style={[
      styles.sectionHeader,
      padded && { paddingHorizontal: 22 },
    ]}
  >
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.sectionRight}>
      <Text style={styles.sectionCount}>{String(count).padStart(2, '0')}</Text>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel ?? 'Añadir'}
          onPress={onAdd}
          hitSlop={8}
          style={({ pressed }) => [
            styles.sectionAddBtn,
            pressed && { opacity: 0.75 },
          ]}
        >
          <IconPlus size={14} color={c.accent} />
        </Pressable>
      ) : null}
    </View>
  </View>
  );
};

// ─── NextMatchdayCard ───────────────────────────────────────────────────────
const NextMatchdayCard: React.FC<{
  overview: ClubTeamOverview;
  onPress: () => void;
}> = ({ overview, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const md = overview.nextMatchday!;
  const dateLabel = formatShortDate(md.match_date);
  const timeLabel = md.match_time ? md.match_time.slice(0, 5) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver jornada ${md.jornada_number} de ${overview.team.name} vs ${md.opponent}`}
      style={({ pressed }) => [
        styles.upcomingCard,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardJornada}>
          J·{String(md.jornada_number).padStart(2, '0')}
        </Text>
        <View
          style={[
            styles.venueDot,
            { backgroundColor: md.is_home ? c.accent : c.textFaint },
          ]}
        />
      </View>
      <Text style={styles.cardDate}>{dateLabel}</Text>
      {timeLabel ? <Text style={styles.cardTime}>{timeLabel}</Text> : null}
      <Text style={styles.cardOpponent} numberOfLines={2}>
        {md.is_home ? 'vs.' : '@ '}
        {md.opponent}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardTeamName} numberOfLines={1}>
          {overview.team.name}
        </Text>
      </View>
    </Pressable>
  );
};

// ─── LastResultCard ─────────────────────────────────────────────────────────
const LastResultCard: React.FC<{
  overview: ClubTeamOverview;
  onPress: () => void;
}> = ({ overview, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const md = overview.lastResult!;
  const tint =
    md.outcome === 'win'
      ? c.accent
      : md.outcome === 'loss'
        ? c.error
        : c.warning;
  const label =
    md.outcome === 'win' ? 'V' : md.outcome === 'loss' ? 'D' : 'E';
  const hasScore = md.score_for != null && md.score_against != null;
  const isHome = md.is_home;
  const leftScore = isHome ? md.score_for : md.score_against;
  const rightScore = isHome ? md.score_against : md.score_for;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de jornada ${md.jornada_number} ${overview.team.name} vs ${md.opponent}`}
      style={({ pressed }) => [
        styles.resultCard,
        { borderColor: `${tint}66` },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text
          style={[
            styles.cardOutcomePill,
            { color: tint, borderColor: `${tint}80` },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.cardJornadaSmall}>
          J·{String(md.jornada_number).padStart(2, '0')}
        </Text>
      </View>
      {hasScore ? (
        <View style={styles.resultScoreRow}>
          <Text
            style={[
              styles.resultScoreNum,
              { color: isHome ? tint : c.text },
            ]}
          >
            {leftScore}
          </Text>
          <Text style={styles.resultScoreSep}>·</Text>
          <Text
            style={[
              styles.resultScoreNum,
              { color: isHome ? c.text : tint },
            ]}
          >
            {rightScore}
          </Text>
        </View>
      ) : (
        <Text style={styles.resultScoreEmpty}>—</Text>
      )}
      <Text style={styles.cardOpponent} numberOfLines={2}>
        {isHome ? 'vs.' : '@ '}
        {md.opponent}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardTeamName} numberOfLines={1}>
          {overview.team.name}
        </Text>
      </View>
    </Pressable>
  );
};

// ─── TeamRow ────────────────────────────────────────────────────────────────
const TeamRow: React.FC<{
  overview: ClubTeamOverview;
  last: boolean;
  uncovered?: boolean;
  onManage: () => void;
}> = ({ overview, last, uncovered, onManage }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { team, playersCount } = overview;
  const meta =
    [team.category, team.gender, team.group_name && `Grupo ${team.group_name}`]
      .filter(Boolean)
      .join(' · ') || 'Sin configurar';

  return (
    <Pressable
      onPress={onManage}
      accessibilityRole="button"
      accessibilityLabel={`Gestionar equipo ${team.name}. ${meta}. ${playersCount} ${playersCount === 1 ? 'jugador' : 'jugadores'}.`}
      style={({ pressed }) => [
        styles.row,
        last ? null : styles.rowDivider,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.teamBadge}>
        <Text style={styles.teamBadgeText}>
          {(team.category ?? team.name).slice(0, 3).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.teamMeta} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={styles.teamKpi} numberOfLines={1}>
          {playersCount} {playersCount === 1 ? 'jugador' : 'jugadores'}
        </Text>
        {uncovered ? (
          <Text style={styles.uncoveredBadge} numberOfLines={1}>
            NO CUBIERTO · toca para cubrir
          </Text>
        ) : null}
      </View>
      <View style={styles.manageBtn}>
        <IconPencil size={14} color={uncovered ? c.warning : c.accent} />
      </View>
    </Pressable>
  );
};

// ─── Stat ───────────────────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string; small?: boolean }> = ({
  label,
  value,
  small,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View style={{ flex: 1 }}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text
      style={[styles.statValue, small && { fontSize: 16 }]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  empty: { color: c.textFaint, textAlign: 'center', fontSize: 14 },

  topbar: {
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '500',
  },
  brandName: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },

  scroll: { paddingTop: 22 },

  statsRow: {
    marginHorizontal: 22,
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.hair,
  },
  statsDivider: { width: 1, backgroundColor: c.hair },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  statValue: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
  },

  intro: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 22,
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 22,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.text,
    letterSpacing: 2,
    fontWeight: '500',
  },
  sectionCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    letterSpacing: 1,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hScrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 4,
    gap: 10,
  },

  // Cards
  upcomingCard: {
    width: 160,
    minHeight: 168,
    borderRadius: 16,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    padding: 14,
    justifyContent: 'space-between',
  },
  resultCard: {
    width: 160,
    minHeight: 168,
    borderRadius: 16,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardJornada: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardJornadaSmall: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  venueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardDate: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  cardTime: {
    fontFamily: Fonts.mono,
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  cardOpponent: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  cardFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: c.hair,
  },
  cardTeamName: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardOutcomePill: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  resultScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  resultScoreNum: {
    fontFamily: Fonts.mono,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1,
  },
  resultScoreSep: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    color: c.textFaint,
  },
  resultScoreEmpty: {
    color: c.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 18,
    marginTop: 8,
  },

  loaderBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },

  emptyCard: {
    marginHorizontal: 22,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
  emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center' },

  teamList: {
    marginHorizontal: 22,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  dangerZone: {
    marginHorizontal: 22,
    marginTop: 34,
    alignItems: 'center',
  },
  dangerEyebrow: {
    fontFamily: Fonts.mono,
    color: c.error,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
    marginBottom: 12,
  },
  deleteClubBtn: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.error + '66',
    backgroundColor: c.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteClubLabel: {
    color: c.error,
    fontSize: 15,
    fontWeight: '700',
  },
  dangerHint: {
    color: c.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  coverageLine: {
    fontFamily: Fonts.mono,
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 0.3,
    marginHorizontal: 22,
    marginTop: -4,
    marginBottom: 10,
  },
  uncoveredBadge: {
    fontFamily: Fonts.mono,
    color: c.warning,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '700',
    marginTop: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: c.hair,
  },
  teamBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teamName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  teamMeta: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textMuted,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  teamKpi: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  manageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cta: {
    marginTop: 16,
    marginHorizontal: 22,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.accent50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaLabel: { color: c.accent, fontSize: 14, fontWeight: '600' },
});
