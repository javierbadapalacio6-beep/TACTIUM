import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { IconChevron, IconPlus } from '@components/ui';
import { supabase } from '@core/supabase/client';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import * as ClubDashboardApi from '@core/services/clubDashboard';
import type { ClubTeamOverview } from '@core/services/clubDashboard';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { FcpImportSheet } from '@features/club/components/FcpImportSheet';
import { TeamMembersSheet } from '@features/club/components/TeamMembersSheet';
import { TeamCrest } from '@features/team/components/TeamCrest';
import { StaggerRow } from '@features/team/components/TeamMotion';
import { shortDate, teamLogoOf } from '@features/team/teamData';

import type { TeamStackScreenProps } from '@navigation/types';

/** Liga Cántabra: 5 parejas por encuentro = 10 jugadores. */
const MATCHDAY_PLAYERS = 10;

type Filter = 'todos' | 'masculino' | 'femenino' | 'mixto' | 'avisos';

interface Extra {
  won: number;
  lost: number;
  hasCaptain: boolean;
}

const GENDER_SHORT: Record<string, string> = {
  masculino: 'Masc.',
  femenino: 'Fem.',
  mixto: 'Mixto',
};

/**
 * Récord real (G y P contados) y si el equipo tiene capitán además del propio
 * club. Antes la tarjeta pintaba «25% V» dividiendo el ÚLTIMO resultado entre
 * todas las jornadas jugadas. Son dos consultas para todos los equipos.
 */
async function fetchExtras(
  overviews: ClubTeamOverview[],
  myUserId: string | null,
): Promise<Map<string, Extra>> {
  const out = new Map<string, Extra>();
  overviews.forEach((o) => out.set(o.team.id, { won: 0, lost: 0, hasCaptain: false }));
  const seasonToTeam = new Map<string, string>();
  overviews.forEach((o) => o.activeSeason && seasonToTeam.set(o.activeSeason.id, o.team.id));
  const [mdsRes, capsRes] = await Promise.all([
    seasonToTeam.size
      ? supabase
          .from('matchdays')
          .select('season_id, outcome')
          .in('season_id', [...seasonToTeam.keys()])
          .not('outcome', 'is', null)
      : Promise.resolve({ data: [] as { season_id: string; outcome: string | null }[] }),
    supabase
      .from('team_members')
      .select('team_id, user_id, role')
      .in('team_id', overviews.map((o) => o.team.id))
      .in('role', ['captain', 'admin']),
  ]);
  for (const m of (mdsRes.data ?? []) as { season_id: string; outcome: string | null }[]) {
    const t = seasonToTeam.get(m.season_id);
    const e = t ? out.get(t) : null;
    if (!e) continue;
    if (m.outcome === 'win') e.won++;
    else if (m.outcome === 'loss') e.lost++;
  }
  // El club ya es capitán de sus equipos (lo hacen los triggers); «sin
  // capitán» es que no hay OTRO capitán que no sea quien gestiona el club.
  for (const m of capsRes.data ?? []) {
    if (m.user_id === myUserId) continue;
    const e = out.get(m.team_id);
    if (e) e.hasCaptain = true;
  }
  return out;
}

/**
 * Pestaña Equipo del club (rediseño 2026-10): cada tarjeta dice qué toca (la
 * próxima jornada, con fecha legible) y qué falta (sin capitán, no cubierto,
 * faltan N para una jornada). Tocar un equipo abre su vista de solo lectura.
 */
export const ClubTeamsScreen = ({ navigation }: TeamStackScreenProps<'TeamRoot'>) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((st) => st.teams);
  const setActiveTeam = useTeamStore((st) => st.setActiveTeam);
  const myUserId = useAuthStore((st) => st.user?.id ?? null);

  const [overviews, setOverviews] = useState<ClubTeamOverview[]>([]);
  const [extras, setExtras] = useState<Map<string, Extra>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>('todos');
  const [fcpOpen, setFcpOpen] = useState(false);
  const [membersFor, setMembersFor] = useState<{ id: string; name: string } | null>(null);

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  // Spinner y entrada escalonada solo en la 1.ª carga (no al volver a la pestaña).
  const didLoadRef = useRef(false);
  const [animateIn, setAnimateIn] = useState(true);
  const load = useCallback(
    async (showSpinner: boolean) => {
      if (clubTeams.length === 0) {
        setOverviews([]);
        setLoadError(false);
        setLoading(false);
        return;
      }
      if (showSpinner) setLoading(true);
      try {
        const data = await ClubDashboardApi.fetchClubOverview(clubTeams);
        setOverviews(data);
        setLoadError(false);
        fetchExtras(data, myUserId)
          .then(setExtras)
          .catch(() => {});
      } catch (e) {
        console.warn('ClubTeamsScreen overview', e);
        setLoadError(true);
      } finally {
        if (didLoadRef.current) setAnimateIn(false);
        didLoadRef.current = true;
        setLoading(false);
      }
    },
    [clubTeams, myUserId],
  );

  useFocusEffect(
    useCallback(() => {
      void load(!didLoadRef.current);
    }, [load]),
  );

  const handleOpenTeam = async (teamId: string) => {
    try {
      await setActiveTeam(teamId);
      navigation.navigate('ClubTeamPreview');
    } catch (e) {
      console.warn('ClubTeams setActiveTeam', e);
    }
  };

  const goCreate = () => navigation.navigate('Home', { screen: 'CreateTeamFromClub' });

  const alertsOf = (o: ClubTeamOverview) => {
    const e = extras.get(o.team.id);
    return {
      noCaptain: !!e && !e.hasCaptain,
      notCovered: !o.team.covered,
      missing: Math.max(0, MATCHDAY_PLAYERS - o.playersCount),
    };
  };
  const hasAlert = (o: ClubTeamOverview) => {
    const a = alertsOf(o);
    return a.noCaptain || a.notCovered || a.missing > 0;
  };
  const alertCount = overviews.filter(hasAlert).length;
  const shown = overviews.filter((o) =>
    filter === 'todos'
      ? true
      : filter === 'avisos'
        ? hasAlert(o)
        : o.team.gender === filter,
  );

  if (!club) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 18 }]}>
        <Text style={s.empty}>Sin club activo.</Text>
      </View>
    );
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'masculino', label: 'Masc.' },
    { id: 'femenino', label: 'Fem.' },
    { id: 'mixto', label: 'Mixto' },
    { id: 'avisos', label: `Con avisos · ${alertCount}` },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <View style={s.topbar}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>EQUIPOS · {clubTeams.length}</Text>
          <Text style={s.brandName} numberOfLines={1}>
            {club.name}
          </Text>
        </View>
        <Pressable
          onPress={goCreate}
          accessibilityRole="button"
          accessibilityLabel="Nuevo equipo"
          style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.85 }]}
        >
          <IconPlus size={14} color={c.textInverse} />
          <Text style={s.addBtnText}>Equipo</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 64 + 12 + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {clubTeams.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filters}
          >
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[s.filter, on && { backgroundColor: c.accent15, borderColor: c.accent50 }]}
                >
                  <Text style={[s.filterText, on && { color: c.accent }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loadError && !loading ? (
          <Pressable
            onPress={() => load(true)}
            style={({ pressed }) => [s.errorBanner, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.errorBannerText}>
              No se pudieron cargar los datos de los equipos. Toca para reintentar.
            </Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={s.loaderBox}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : clubTeams.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Aún no hay equipos</Text>
            <Text style={s.emptyText}>
              Da de alta el primero o tráelos de la Federación con su plantilla.
            </Text>
            <Pressable
              onPress={goCreate}
              style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.primaryText}>＋ Equipo</Text>
            </Pressable>
            {club.federation === FCP_FEDERATION_CODE ? (
              <Pressable onPress={() => setFcpOpen(true)} hitSlop={8}>
                <Text style={s.link}>Traer de la Federación</Text>
              </Pressable>
            ) : null}
          </View>
        ) : shown.length === 0 ? (
          <Text style={s.empty}>Ningún equipo con este filtro.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {shown.map((o, i) => {
              const e = extras.get(o.team.id);
              const a = alertsOf(o);
              const meta = [
                o.team.category && o.team.gender
                  ? `${o.team.category} ${GENDER_SHORT[o.team.gender] ?? ''}`.trim()
                  : o.team.category,
                o.team.group_name ? `Grupo ${o.team.group_name}` : null,
                `${o.playersCount} jug.`,
              ]
                .filter(Boolean)
                .join(' · ');
              const n = o.nextMatchday;
              return (
                <StaggerRow key={o.team.id} index={i} animate={animateIn}>
                  <Pressable
                    onPress={() => handleOpenTeam(o.team.id)}
                    accessibilityRole="button"
                    style={({ pressed }) => [s.teamCard, pressed && { opacity: 0.85 }]}
                  >
                    <View style={s.cardTop}>
                      <TeamCrest name={o.team.name} logo={teamLogoOf(o.team)} size={42} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.teamName} numberOfLines={1}>
                          {o.team.name}
                        </Text>
                        <Text style={s.teamMeta} numberOfLines={1}>
                          {meta}
                        </Text>
                      </View>
                      {a.noCaptain ? (
                        <View style={[s.chip, s.chipWarn]}>
                          <Text style={[s.chipText, { color: c.warning }]}>SIN CAPITÁN</Text>
                        </View>
                      ) : a.notCovered ? (
                        <View style={[s.chip, s.chipMute]}>
                          <Text style={[s.chipText, { color: c.textMuted }]}>NO CUBIERTO</Text>
                        </View>
                      ) : e && e.won + e.lost > 0 ? (
                        <Text style={s.record}>
                          <Text style={{ color: c.accent }}>{e.won}G</Text> {e.lost}P
                        </Text>
                      ) : null}
                    </View>
                    {n ? (
                      <Text style={s.next} numberOfLines={1}>
                        {shortDate(n.match_date)}
                        {n.match_time ? ` · ${n.match_time.slice(0, 5)}` : ''} vs {n.opponent}
                        {n.is_home ? ' · Local' : ''}
                      </Text>
                    ) : null}
                    {a.missing > 0 || a.noCaptain ? (
                      <View style={s.alertRow}>
                        <Text style={s.alertText}>
                          {a.missing > 0
                            ? `Faltan ${a.missing} para una jornada`
                            : 'Sin capitán asignado'}
                        </Text>
                        {a.noCaptain ? (
                          <Pressable
                            onPress={() => setMembersFor({ id: o.team.id, name: o.team.name })}
                            hitSlop={8}
                            accessibilityRole="button"
                          >
                            <Text style={s.link}>Invitar capitán ›</Text>
                          </Pressable>
                        ) : (
                          <IconChevron size={14} color={c.textFaint} />
                        )}
                      </View>
                    ) : null}
                  </Pressable>
                </StaggerRow>
              );
            })}
          </View>
        )}
      </ScrollView>

      <FcpImportSheet open={fcpOpen} clubId={club.id} onClose={() => setFcpOpen(false)} />
      <TeamMembersSheet
        open={!!membersFor}
        teamId={membersFor?.id ?? null}
        teamName={membersFor?.name ?? null}
        onClose={() => {
          setMembersFor(null);
          void load(false);
        }}
      />
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topbar: {
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.4,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 4,
    },
    brandName: { color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
    },
    addBtnText: { color: c.textInverse, fontSize: 13.5, fontWeight: '700' },
    scroll: { paddingHorizontal: 20, paddingTop: 4 },
    filters: { gap: 6, paddingBottom: 14 },
    filter: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      justifyContent: 'center',
    },
    filterText: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    errorBanner: {
      marginBottom: 12,
      backgroundColor: c.error + '1A',
      borderWidth: 1,
      borderColor: c.error + '55',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    errorBannerText: { color: c.error, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    loaderBox: { paddingVertical: 32, alignItems: 'center' },
    emptyCard: {
      paddingVertical: 28,
      paddingHorizontal: 18,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      alignItems: 'center',
      gap: 10,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    primary: {
      height: 44,
      paddingHorizontal: 22,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    primaryText: { color: c.textInverse, fontSize: 14, fontWeight: '700' },
    link: { color: c.accent, fontSize: 13, fontWeight: '700' },
    empty: { color: c.textFaint, textAlign: 'center', fontSize: 14, paddingVertical: 20 },
    teamCard: {
      padding: 14,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 10,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    teamName: { color: c.text, fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 },
    teamMeta: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    record: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 13, fontWeight: '700' },
    chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    chipWarn: { backgroundColor: 'rgba(242,201,76,0.15)' },
    chipMute: { backgroundColor: c.hairStrong },
    chipText: { fontFamily: Fonts.mono, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6 },
    next: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    alertText: { color: c.warning, fontSize: 12.5, fontWeight: '600' },
  });
