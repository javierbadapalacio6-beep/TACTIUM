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
import { useAuthStore } from '@store/authStore';
import * as TeamMembersApi from '@core/services/teamMembers';
import * as InvitationsApi from '@core/services/invitations';
import { TeamMembersSheet } from '../components/TeamMembersSheet';
import { TeamCrest } from '@features/team/components/TeamCrest';
import { shortDate, teamLogoOf } from '@features/team/teamData';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import * as PlayersApi from '@core/services/players';
import { matchdayState } from '@core/utils/matchday';
import { FcpSeasonUpdateSheet } from '../components/FcpSeasonUpdateSheet';
import { FcpGroupSheet } from '../components/FcpGroupSheet';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { usePremiumGate, useIsPremium } from '@core/hooks/usePremiumGate';

import type { TeamStackScreenProps } from '@navigation/types';

/**
 * Dashboard READ-ONLY de un equipo concreto, accesible desde el tab
 * "Equipos" (rol club_admin). Muestra stats agregadas, próxima jornada
 * (con info de si la alineación ya está hecha) y lista navegable de
 * jornadas. Al tap en una jornada navega a JornadaScreen — que ya queda
 * read-only para club_admin gracias a `selectIsCaptain = false`.
 *
 * READ-ONLY en lo OPERATIVO: NO crea/edita jornadas, alineaciones ni
 * resultados — eso es del capitán (el gestor cambia a Modo Capitán desde
 * Profile; los triggers DB le hacen captain real de sus teams).
 *
 * SÍ ofrece GESTIÓN FEDERATIVA de estructura (etiquetada "(Federación)"):
 * "Preparar nueva temporada" y "Mi grupo" (volcado de calendario/resultados
 * desde la Federación). Es administración de club, no operativa de partido, y
 * la RLS `is_team_admin` la autoriza — por eso vive aquí y no rompe el read-only.
 */
export const ClubTeamPreviewScreen = ({
  navigation,
}: TeamStackScreenProps<'ClubTeamPreview'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);

  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays] = useState<MatchdaysApi.Matchday[]>([]);
  const [players, setPlayers] = useState<PlayersApi.Player[]>([]);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const gate = usePremiumGate();
  const isPremium = useIsPremium();
  const [loading, setLoading] = useState(true);
  // «Capitán y miembros»: abre la TeamMembersSheet que ya existía (roles,
  // invitar al capitán, liberar un hueco, borrar el equipo). Antes solo se
  // llegaba desde el panel de Inicio.
  const [membersOpen, setMembersOpen] = useState(false);
  const [crew, setCrew] = useState<{ captain: string | null; openInvites: number } | null>(null);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const loadCrew = useCallback(async () => {
    if (!team) return;
    try {
      const [ms, invs] = await Promise.all([
        TeamMembersApi.fetchTeamMembersWithProfiles(team.id),
        InvitationsApi.fetchTeamInvitations(team.id).catch(() => []),
      ]);
      const caps = ms.filter(
        (m) => (m.role === 'captain' || m.role === 'admin') && m.user_id !== myUserId,
      );
      setCrew({
        captain: caps[0]?.profile?.full_name ?? (caps.length ? 'Capitán asignado' : null),
        openInvites: invs.filter(
          (i) => i.role === 'captain' && InvitationsApi.isInvitationActive(i),
        ).length,
      });
    } catch {
      setCrew(null);
    }
  }, [team, myUserId]);
  const isFcpTeam = team?.federation === FCP_FEDERATION_CODE;
  const reloadPlayers = useCallback(async () => {
    if (!team) return;
    try {
      setPlayers(await PlayersApi.fetchPlayers(team.id));
    } catch (e) {
      console.warn('ClubTeamPreview reloadPlayers', e);
    }
  }, [team]);

  useFocusEffect(
    useCallback(() => {
      if (!team) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const [s, ps] = await Promise.all([
            SeasonsApi.fetchActiveSeason(team.id),
            PlayersApi.fetchPlayers(team.id).catch(() => [] as PlayersApi.Player[]),
          ]);
          if (cancelled) return;
          setSeason(s);
          setPlayers(ps);
          void loadCrew();
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
    }, [team, loadCrew]),
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

  // "Preparar nueva temporada" solo cuando la actual está cerrada o entre
  // temporadas (no siempre visible).
  const seasonClosed = useMemo(() => {
    if (!season) return true;
    if (matchdays.length === 0) return true;
    if (matchdays.every((m) => m.outcome != null)) return true;
    if (season.end_date && new Date(season.end_date) < new Date()) return true;
    return false;
  }, [season, matchdays]);

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

  const avgPts = players.length
    ? Math.round(players.reduce((acc, p) => acc + (p.pts ?? 0), 0) / players.length)
    : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Equipos</Text>
        </Pressable>
        {/* La operativa (jornada, alineación, acta) es del capitán: la
            etiqueta lo deja claro en vez de esconder botones sin explicar. */}
        <View style={styles.readOnly}>
          <Text style={styles.readOnlyText}>Solo lectura</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <TeamCrest name={team.name} logo={teamLogoOf(team)} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {team.name}
            </Text>
            {teamMeta ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {teamMeta}
              </Text>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <>
            <View style={styles.statsCard}>
              <Stat label="Jugadas" value={`${stats.played}/${stats.total}`} />
              <View style={styles.statsDivider} />
              <Stat label="Ganadas" value={String(stats.wins)} color={c.accent} />
              <View style={styles.statsDivider} />
              <Stat label="Perdidas" value={String(stats.losses)} color={c.error} />
              {stats.draws > 0 ? (
                <>
                  <View style={styles.statsDivider} />
                  <Stat label="Empates" value={String(stats.draws)} />
                </>
              ) : null}
            </View>

            {nextMatchday ? (
              <Pressable
                onPress={() => navigation.navigate('Jornada', { matchdayId: nextMatchday.id })}
                style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.nextJornadaNum}>
                  {matchdayState(nextMatchday) === 'pending-acta' ? 'PENDIENTE · ' : ''}
                  JORNADA {nextMatchday.jornada_number} ·{' '}
                  {shortDate(nextMatchday.match_date).toUpperCase()}
                  {nextMatchday.match_time ? ` · ${nextMatchday.match_time.slice(0, 5)}` : ''}
                </Text>
                <Text style={styles.nextRival}>
                  vs {nextMatchday.opponent} · {nextMatchday.is_home ? 'Local' : 'Visitante'}
                </Text>
                <Text style={styles.nextMeta}>Toca para ver alineación y resultados</Text>
              </Pressable>
            ) : null}

            <View style={styles.rows}>
              <Pressable
                onPress={() => setMembersOpen(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.navRow, styles.navDivider, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.navGlyph}>
                  <Text style={styles.navGlyphText}>C</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.navTitle}>Capitán y miembros</Text>
                  <Text style={styles.navSub} numberOfLines={1}>
                    {crew
                      ? [
                          crew.captain ?? 'Sin capitán',
                          crew.openInvites > 0
                            ? `${crew.openInvites} ${crew.openInvites === 1 ? 'invitación abierta' : 'invitaciones abiertas'}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Roles, invitar al capitán, liberar un hueco'}
                  </Text>
                </View>
                <IconChevron size={14} color={c.textFaint} />
              </Pressable>
              <Pressable
                onPress={() => setRosterOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: rosterOpen }}
                style={({ pressed }) => [
                  styles.navRow,
                  isFcpTeam && styles.navDivider,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.navGlyph}>
                  <Text style={styles.navGlyphText}>≡</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.navTitle}>Plantilla · {players.length}</Text>
                  <Text style={styles.navSub}>
                    {players.length ? `Media ${avgPts} pts` : 'Aún sin jugadores'}
                  </Text>
                </View>
                <View style={{ transform: [{ rotate: rosterOpen ? '90deg' : '0deg' }] }}>
                  <IconChevron size={14} color={c.textFaint} />
                </View>
              </Pressable>
              {rosterOpen && players.length > 0 ? (
                <View style={styles.rosterList}>
                  {[...players]
                    .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0))
                    .map((p, i) => (
                      <View key={p.id} style={styles.rosterRow}>
                        <Text style={styles.rosterNum}>{i + 1}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rosterName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          {p.position ? <Text style={styles.rosterPos}>{p.position}</Text> : null}
                        </View>
                        <Text style={styles.rosterPts}>{p.pts ?? 0}</Text>
                      </View>
                    ))}
                </View>
              ) : null}
              {isFcpTeam ? (
                // El grupo de la Federación es Pro (mismo gate por equipo: el
                // del club tiene que estar cubierto). Sin Pro la fila se ve,
                // con el distintivo, y abre el paywall.
                <Pressable
                  onPress={gate(() => setGroupOpen(true), 'fcp_group')}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.navRow,
                    seasonClosed && styles.navDivider,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.navGlyph}>
                    <Text style={styles.navGlyphText}>▦</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.navTitle}>Federación</Text>
                    <Text style={styles.navSub}>Clasificación y jornadas del grupo</Text>
                  </View>
                  {isPremium ? (
                    <IconChevron size={14} color={c.textFaint} />
                  ) : (
                    <View style={styles.pro}>
                      <Text style={styles.proText}>PRO</Text>
                    </View>
                  )}
                </Pressable>
              ) : null}
              {isFcpTeam && seasonClosed ? (
                <Pressable
                  onPress={() => setSeasonOpen(true)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.navGlyph}>
                    <Text style={styles.navGlyphText}>★</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.navTitle}>Preparar la temporada nueva</Text>
                    <Text style={styles.navSub}>Traer la plantilla de la Federación</Text>
                  </View>
                  <IconChevron size={14} color={c.textFaint} />
                </Pressable>
              ) : null}
            </View>

            {/* Lista completa de jornadas */}
            <Text style={styles.sectionLabel}>
              Jornadas{season ? ` · ${season.name}` : ''}
            </Text>
            {matchdays.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {season ? 'Sin jornadas configuradas' : 'Sin temporada activa'}
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
                    onPress={() => navigation.navigate('Jornada', { matchdayId: md.id })}
                    style={({ pressed }) => [styles.matchdayRow, pressed && { opacity: 0.85 }]}
                  >
                    <View style={styles.matchdayNumBox}>
                      <Text style={styles.matchdayNumText}>
                        J{String(md.jornada_number).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.matchdayRival} numberOfLines={1}>
                        vs {md.opponent}
                      </Text>
                      <Text style={styles.matchdayMeta} numberOfLines={1}>
                        {md.match_date ? shortDate(md.match_date) : 'Sin fecha'}
                        {md.is_home ? ' · Local' : ' · Visitante'}
                      </Text>
                    </View>
                    {md.outcome ? <OutcomePill outcome={md.outcome} /> : null}
                    <IconChevron size={14} color={c.textFaint} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {team ? (
        <FcpSeasonUpdateSheet
          open={seasonOpen}
          teamId={team.id}
          teamName={team.name}
          teamGender={team.gender}
          onClose={() => setSeasonOpen(false)}
          onDone={reloadPlayers}
        />
      ) : null}

      {team ? (
        <FcpGroupSheet
          open={groupOpen}
          teamId={team.id}
          teamName={team.name}
          onClose={() => setGroupOpen(false)}
        />
      ) : null}

      <TeamMembersSheet
        open={membersOpen}
        teamId={team.id}
        teamName={team.name}
        onClose={() => {
          setMembersOpen(false);
          void loadCrew();
        }}
      />
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
  pro: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: c.accent15,
  },
  proText: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  root: { flex: 1, backgroundColor: c.background },
  readOnly: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
  },
  readOnlyText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rows: {
    marginTop: 14,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  navDivider: { borderBottomWidth: 1, borderColor: c.hair },
  navGlyph: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyphText: { color: c.accent, fontSize: 15, fontWeight: '700' },
  navTitle: { color: c.text, fontSize: 14.5, fontWeight: '700' },
  navSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
  rosterList: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: c.hair,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    fontSize: 12,
    color: c.textFaint,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 10,
  },
  nextCard: {
    marginTop: 14,
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
  rosterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rosterToggleText: { color: c.accent, fontSize: 14, fontWeight: '700' },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hair,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rosterNum: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 12,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  rosterName: { color: c.text, fontSize: 14, fontWeight: '600' },
  rosterPos: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  rosterPts: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 13,
    fontWeight: '700',
  },
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
    color: c.textFaint,
    fontSize: 12,
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
