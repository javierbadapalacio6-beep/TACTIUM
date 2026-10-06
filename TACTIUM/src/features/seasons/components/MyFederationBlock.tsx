// Federación · «primero lo tuyo». Encima del explorador: tu equipo y tu grupo
// (capitán y jugador), los equipos del club (club y organizador con equipos) o,
// sin equipo, la invitación a buscarse. Debajo, lo que sigues con la ☆ (que ya
// se guardaba en favoritesStore pero no se veía en ningún sitio).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconCalendar, IconChevron, IconSearch } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useFavoritesStore, type Favorite } from '@store/favoritesStore';
import { useNavRole } from '@navigation/navRole';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { zoneColor } from '@core/data/fcpZones';
import { fetchFcpGroupSchedule, type FcpScheduleRow } from '@core/services/fcpSeason';
import { usePremiumGate, useIsPremium } from '@core/hooks/usePremiumGate';
import {
  useFcpStanding,
  loadFcpStanding,
  shortGroupName,
  fmtDay,
  type FcpStanding,
} from './ligaParts';

const initials = (name: string): string => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '?';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
};

export const MyFederationBlock: React.FC<{
  onTeam: (idEquipo: number, name: string) => void;
  onGroup: (idGrupo: string, nombre: string | null) => void;
  onPlayer: (idJugador: string, name: string) => void;
  /** Sin equipo: lleva al buscador de jugadores. */
  onFindMe: () => void;
}> = ({ onTeam, onGroup, onPlayer, onFindMe }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const role = useNavRole();
  const team = useTeamStore((st) => st.team);
  const favs = useFavoritesStore((st) => st.items);
  const following = useMemo(
    () =>
      favs
        .filter((f) => f.kind === 'team' || f.kind === 'player')
        .sort((a, b) => b.addedAt - a.addedAt),
    [favs],
  );

  const showTeam =
    (role === 'captain' || role === 'player') && team?.federation === FCP_FEDERATION_CODE;

  return (
    <View style={{ gap: 18, marginTop: 6, marginBottom: 10 }}>
      {showTeam && team ? (
        <MyTeamCard teamId={team.id} teamName={team.name} onTeam={onTeam} onGroup={onGroup} />
      ) : role === 'club' || role === 'organizer' ? (
        <ClubTeams onTeam={onTeam} />
      ) : role === 'solo' ? (
        <Pressable
          onPress={onFindMe}
          accessibilityRole="button"
          style={({ pressed }) => [s.findCard, pressed && { opacity: 0.9 }]}
        >
          <View style={s.findIcon}>
            <IconSearch size={16} color={c.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.findTitle}>¿Juegas en la Cántabra?</Text>
            <Text style={s.findText}>Búscate y sigue tu ficha: puntos, partidos y parejas.</Text>
          </View>
          <IconChevron size={14} color={c.accent} />
        </Pressable>
      ) : null}

      <View>
        <Text style={s.label}>SIGUIENDO · {following.length}</Text>
        {following.length === 0 ? (
          <Text style={s.hint}>Toca ☆ en un equipo o un jugador para tenerlo aquí.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          >
            {following.map((f) => (
              <FollowChip
                key={`${f.kind}:${f.refId}`}
                fav={f}
                onPress={() =>
                  f.kind === 'team'
                    ? onTeam(Number(f.refId), f.label)
                    : onPlayer(f.refId, f.label)
                }
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

// ─── Tu equipo (capitán / jugador) ───────────────────────────────────────────

const MyTeamCard: React.FC<{
  teamId: string;
  teamName: string;
  onTeam: (idEquipo: number, name: string) => void;
  onGroup: (idGrupo: string, nombre: string | null) => void;
}> = ({ teamId, teamName, onTeam, onGroup }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { loading, data } = useFcpStanding(teamId);
  // Mismo gate que el resto de funciones Pro: decide por equipo y rol (al
  // jugador no lo bloquea nunca, ver `hasPremiumAccess`).
  const gate = usePremiumGate();
  const isPremium = useIsPremium();
  // Próxima jornada: el primer partido tuyo del grupo sin jugar (como la web).
  // Solo con la tabla de la temporada en juego: en la anterior no hay próxima.
  const [next, setNext] = useState<FcpScheduleRow | null>(null);
  const wantNext = data.idEquipo != null && !!data.me && !data.previous && !data.finished;
  useEffect(() => {
    if (!wantNext || data.idEquipo == null) {
      setNext(null);
      return;
    }
    let alive = true;
    fetchFcpGroupSchedule(data.idEquipo)
      .then(({ rows }) => {
        if (!alive) return;
        const mine = rows
          .filter(
            (r) => (r.isMeLocal || r.isMeVisit) && r.estado !== 'jugado' && !r.resultado,
          )
          .sort((a, b) => (a.jornada ?? 999) - (b.jornada ?? 999));
        setNext(mine[0] ?? null);
      })
      .catch(() => alive && setNext(null));
    return () => {
      alive = false;
    };
  }, [wantNext, data.idEquipo]);

  if (loading || data.idEquipo == null) return null;
  const pos = data.me?.posicion ?? null;
  const name = data.me?.equipo ?? teamName;
  const group = shortGroupName(data.grupo);
  const nextMeta = next
    ? [
        'Próxima',
        next.jornada != null ? `jornada ${next.jornada}` : null,
        next.fecha ? fmtDay(next.fecha) : null,
        next.hora ? next.hora.slice(0, 5) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  return (
    <View style={s.mineCard}>
      <View style={s.mineTop}>
        <View style={s.tile}>
          <Text style={s.tileText}>{initials(name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.mineName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={s.mineMeta} numberOfLines={1}>
            {['TU EQUIPO', group?.toUpperCase(), data.previous ? data.temporada : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {pos != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.minePos, data.zone ? { color: zoneColor(data.zone.key, c) } : null]}>
              {pos}º
            </Text>
            {data.me?.puntos != null ? (
              <Text style={s.minePts}>{data.me.puntos} PTS</Text>
            ) : null}
          </View>
        ) : (
          <Text style={s.noDraw}>SIN SORTEO</Text>
        )}
      </View>
      {data.previous ? (
        // Mismo aviso que FcpGroupSheet: la tabla es de la temporada pasada.
        <Text style={s.mineNote}>
          <Text style={{ fontWeight: '700', color: c.text }}>
            Clasificación final
            {data.temporada ? ` de la ${data.temporada}` : ' de la temporada pasada'}
          </Text>
          . La Federación aún no ha publicado los grupos de la temporada nueva. Cuando lo haga,
          aquí verás tu grupo nuevo.
        </Text>
      ) : data.finished ? (
        <Text style={s.mineNote}>
          Temporada{data.temporada ? ` ${data.temporada}` : ''} terminada · clasificación final
        </Text>
      ) : next ? (
        <View style={s.nextBox}>
          <IconCalendar size={15} color={c.textMuted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.nextMeta} numberOfLines={1}>
              {nextMeta}
            </Text>
            <Text style={s.nextTeams} numberOfLines={1}>
              {next.equipo_local} – {next.equipo_visit}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={s.mineBtns}>
        {data.idGrupo ? (
          // «Tu grupo» es Pro (el explorador público de abajo, no). Sin Pro el
          // botón se ve, con el distintivo, y abre el paywall.
          <Pressable
            onPress={gate(() => onGroup(data.idGrupo!, data.grupo), 'fcp_group')}
            style={({ pressed }) => [
              s.mineBtn,
              isPremium && s.mineBtnOn,
              !isPremium && s.mineBtnRow,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPremium ? 'Ver clasificación' : 'Ver clasificación (Pro)'}
          >
            <Text style={[s.mineBtnText, isPremium && { color: c.textInverse }]}>
              Ver clasificación
            </Text>
            {!isPremium ? (
              <View style={s.pro}>
                <Text style={s.proText}>PRO</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onTeam(data.me?.id_equipo ?? data.idEquipo!, name)}
          style={({ pressed }) => [s.mineBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={s.mineBtnText}>Ficha del equipo</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ─── Equipos del club ────────────────────────────────────────────────────────

const ClubTeams: React.FC<{ onTeam: (idEquipo: number, name: string) => void }> = ({ onTeam }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((st) => st.teams);
  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );
  const [rows, setRows] = useState<{ id: string; name: string; st: FcpStanding }[] | null>(null);
  const key = clubTeams.map((t) => t.id).join(',');

  useEffect(() => {
    if (clubTeams.length === 0) {
      setRows([]);
      return;
    }
    let alive = true;
    // Una consulta por equipo (como mucho 6-8 en un club) y cacheadas.
    Promise.all(
      clubTeams.map(async (t) => ({
        id: t.id,
        name: t.name,
        st: await loadFcpStanding(t.id).catch(() => null),
      })),
    ).then((r) => {
      if (!alive) return;
      setRows(
        r.filter((x): x is { id: string; name: string; st: FcpStanding } => !!x.st && x.st.idEquipo != null),
      );
    });
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows || rows.length === 0) return null;
  return (
    <View>
      <Text style={s.label}>TUS EQUIPOS EN LA FEDERACIÓN · {rows.length}</Text>
      <View style={{ gap: 6, marginTop: 10 }}>
        {rows.map(({ id, name, st }) => {
          const pos = st.me?.posicion ?? null;
          return (
            <Pressable
              key={id}
              onPress={() => onTeam(st.me?.id_equipo ?? st.idEquipo!, st.me?.equipo ?? name)}
              style={({ pressed }) => [s.clubRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <View style={s.clubTile}>
                <Text style={s.clubTileText}>{name.trim().slice(-1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.clubName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={s.clubMeta} numberOfLines={1}>
                  {shortGroupName(st.grupo) ?? 'En inscripción'}
                </Text>
              </View>
              {pos != null ? (
                <Text
                  style={[s.clubPos, st.zone ? { color: zoneColor(st.zone.key, c) } : null]}
                >
                  {pos}º
                </Text>
              ) : (
                <Text style={s.noDraw}>SIN SORTEO</Text>
              )}
              <IconChevron size={14} color={c.textFaint} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ─── Chip de «Siguiendo» ─────────────────────────────────────────────────────

const FollowChip: React.FC<{ fav: Favorite; onPress: () => void }> = ({ fav, onPress }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fav.label}
      style={({ pressed }) => [s.follow, pressed && { opacity: 0.85 }]}
    >
      <View style={[s.followTile, fav.kind === 'player' && { borderRadius: 999 }]}>
        <Text style={s.followTileText}>{initials(fav.label)}</Text>
      </View>
      <View style={{ maxWidth: 130 }}>
        <Text style={s.followName} numberOfLines={1}>
          {fav.label}
        </Text>
        <Text style={s.followMeta} numberOfLines={1}>
          {fav.meta || (fav.kind === 'team' ? 'Equipo' : 'Jugador')}
        </Text>
      </View>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    label: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2.4,
      color: c.textFaint,
      fontWeight: '600',
      marginBottom: 8,
    },
    hint: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    mineCard: {
      padding: 14,
      borderRadius: 18,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    mineTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tile: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 14, fontWeight: '800' },
    mineName: { color: c.text, fontSize: 16, fontWeight: '800' },
    mineMeta: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 10,
      letterSpacing: 1.2,
      marginTop: 3,
    },
    minePos: { fontFamily: Fonts.mono, color: c.accent, fontSize: 26, fontWeight: '800' },
    minePts: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 10,
      letterSpacing: 1,
      marginTop: 1,
    },
    mineNote: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
    nextBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard2,
    },
    nextMeta: { color: c.textMuted, fontSize: 12.5 },
    nextTeams: { color: c.text, fontSize: 13.5, fontWeight: '700', marginTop: 2 },
    noDraw: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontWeight: '700',
    },
    mineBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
    mineBtn: {
      flex: 1,
      height: 38,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    mineBtnOn: { backgroundColor: c.accent, borderColor: c.accent },
    mineBtnRow: { flexDirection: 'row', gap: 8 },
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
    mineBtnText: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    findCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    findIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.accent15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    findTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
    findText: { color: c.textMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
    clubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    clubTile: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: c.bgCard2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clubTileText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13, fontWeight: '800' },
    clubName: { color: c.text, fontSize: 14, fontWeight: '700' },
    clubMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10.5, marginTop: 2 },
    clubPos: { fontFamily: Fonts.mono, color: c.text, fontSize: 18, fontWeight: '800' },
    follow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    followTile: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: c.bgCard2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    followTileText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, fontWeight: '800' },
    followName: { color: c.text, fontSize: 13, fontWeight: '700' },
    followMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, marginTop: 1 },
  });
