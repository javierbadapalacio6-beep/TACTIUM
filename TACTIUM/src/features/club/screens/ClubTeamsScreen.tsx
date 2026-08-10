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
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconChevron, NeonDot } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import * as ClubDashboardApi from '@core/services/clubDashboard';
import type { ClubTeamOverview } from '@core/services/clubDashboard';

import type { ClubTeamsStackScreenProps } from '@navigation/types';

/**
 * Pantalla del tab "Equipos" (rol club_admin). Lista todos los equipos del
 * club con stats rápidos. Tap en un equipo cambia `activeTeam` al elegido
 * y navega a HomeRoot del ClubTeamsStack — desde ahí el club_admin recorre
 * Jornadas/Lineup/Resultados en SOLO LECTURA (selectIsCaptain devuelve false
 * para club_admin desde 2026-05-16).
 */
export const ClubTeamsScreen = ({
  navigation,
}: ClubTeamsStackScreenProps<'ClubTeamsRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);

  const [overviews, setOverviews] = useState<ClubTeamOverview[]>([]);
  const [loading, setLoading] = useState(true);

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  // Spinner solo en la 1ª carga (refrescos al volver a foco en 2º plano) +
  // estado de error para no tragarnos un fallo de red.
  const didLoadRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (clubTeams.length === 0) {
        setOverviews([]);
        setLoadError(false);
        setLoading(false);
        return;
      }
      let cancelled = false;
      (async () => {
        if (!didLoadRef.current) setLoading(true);
        try {
          const data = await ClubDashboardApi.fetchClubOverview(clubTeams);
          if (!cancelled) {
            setOverviews(data);
            setLoadError(false);
          }
        } catch (e) {
          if (!cancelled) {
            console.warn('ClubTeamsScreen overview', e);
            setLoadError(true);
          }
        } finally {
          if (!cancelled) {
            didLoadRef.current = true;
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [clubTeams]),
  );

  const retryOverviews = useCallback(async () => {
    if (clubTeams.length === 0) return;
    setLoading(true);
    try {
      const data = await ClubDashboardApi.fetchClubOverview(clubTeams);
      setOverviews(data);
      setLoadError(false);
    } catch (e) {
      console.warn('ClubTeamsScreen overview', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [clubTeams]);

  const handleOpenTeam = async (teamId: string) => {
    try {
      await setActiveTeam(teamId);
      navigation.navigate('ClubTeamPreview');
    } catch (e) {
      console.warn('ClubTeams setActiveTeam', e);
    }
  };

  if (!club) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.empty}>Sin club activo.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <TactiumMark size={32} gradient />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>EQUIPOS</Text>
            <Text style={styles.brandName} numberOfLines={1}>
              {club.name}
            </Text>
          </View>
        </View>
        <NeonDot size={7} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          // Tab bar flotante: ~64 + 12 + safe-area + colchón.
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Selecciona un equipo para ver su jornada, alineación y resultados.
        </Text>

        {loadError && !loading ? (
          <Pressable
            onPress={retryOverviews}
            style={({ pressed }) => [styles.errorBanner, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.errorBannerText}>
              No se pudieron cargar los datos de los equipos. Toca para reintentar.
            </Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : clubTeams.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún no hay equipos</Text>
            <Text style={styles.emptyText}>
              Crea el primer equipo del club desde la pestaña Club.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {overviews.map((o) => {
              const winRate =
                o.playedCount > 0
                  ? Math.round(
                      ((o.lastResult?.outcome === 'win' ? 1 : 0) /
                        Math.max(o.playedCount, 1)) *
                        100,
                    )
                  : null;
              const meta = [
                o.team.category,
                o.team.league,
                o.team.gender,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={o.team.id}
                  onPress={() => handleOpenTeam(o.team.id)}
                  style={({ pressed }) => [
                    styles.teamCard,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.teamCardLeft}>
                    <View style={styles.teamAvatar}>
                      <Text style={styles.teamAvatarText}>
                        {o.team.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.teamName} numberOfLines={1}>
                        {o.team.name}
                      </Text>
                      <Text style={styles.teamMeta} numberOfLines={1}>
                        {meta || 'Sin configurar'}
                      </Text>
                      <Text style={styles.teamStats}>
                        {o.playedCount}/{o.totalMatchdays} jornadas
                        {winRate !== null ? ` · ${winRate}% V` : ''}
                        {' · '}
                        {o.playersCount} jugadores
                      </Text>
                    </View>
                  </View>
                  <IconChevron size={16} color={c.textFaint} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  topbar: {
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: c.accent,
    fontWeight: '500',
    marginBottom: 2,
  },
  brandName: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scroll: { paddingHorizontal: 22, paddingTop: 6 },
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
  intro: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  loaderBox: { paddingVertical: 32, alignItems: 'center' },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  empty: { color: c.textFaint, textAlign: 'center', fontSize: 14 },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
  },
  teamCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  teamAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teamName: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  teamMeta: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  teamStats: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 4,
  },
});
