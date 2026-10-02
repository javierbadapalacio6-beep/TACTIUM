import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import * as MatchdaysApi from '@core/services/matchdays';
import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';

const MAX_TEAMS = 5;

const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** «2026-10-03» → «SÁB 3 OCT». */
export function formatMatchDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

const RSVP_LABEL: Record<'yes' | 'maybe' | 'no', string> = {
  yes: 'Voy',
  maybe: 'Duda',
  no: 'No',
};

/**
 * Fila deslizable con la próxima jornada de cada uno de TUS OTROS equipos
 * (máx. 5). Tocar una tarjeta cambia el equipo activo (como el TeamSwitcher)
 * y la Home se recarga con él. Con un solo equipo, no pinta nada.
 */
export const OtherTeamsMatchdays: React.FC<{ bleed?: number }> = ({ bleed = 22 }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const teams = useTeamStore((s) => s.teams);
  const activeId = useTeamStore((s) => s.team?.id ?? null);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [rows, setRows] = useState<MatchdaysApi.TeamNextMatchday[]>([]);

  const otherIds = useMemo(
    () => teams.filter((t) => t.id !== activeId).slice(0, MAX_TEAMS).map((t) => t.id),
    [teams, activeId],
  );
  const otherKey = otherIds.join(',');

  useFocusEffect(
    useCallback(() => {
      if (otherIds.length === 0) {
        setRows([]);
        return;
      }
      let cancelled = false;
      MatchdaysApi.fetchNextMatchdaysForTeams(otherIds, userId)
        .then((r) => {
          if (!cancelled) setRows(r);
        })
        .catch((e) => console.warn('Home other teams', e));
      return () => {
        cancelled = true;
      };
      // otherKey resume otherIds (array nuevo en cada render del memo).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [otherKey, userId]),
  );

  if (teams.length < 2) return null;
  const visible = rows.filter((r) => r.teamId !== activeId);
  if (visible.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>TUS OTROS EQUIPOS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={{ paddingHorizontal: bleed, gap: 10 }}
      >
        {visible.map(({ teamId, matchday: md, myPlayerId, myStatus }) => {
          const teamName = teams.find((t) => t.id === teamId)?.name ?? 'Equipo';
          const when = [
            `J${String(md.jornada_number).padStart(2, '0')}`,
            md.match_date ? formatMatchDate(md.match_date) : null,
            md.match_time ? md.match_time.slice(0, 5) : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const rsvp = myStatus ? RSVP_LABEL[myStatus] : 'Sin contestar';
          const rsvpColor =
            myStatus === 'yes'
              ? c.accent
              : myStatus === 'no'
                ? c.error
                : myStatus === 'maybe'
                  ? c.warning
                  : c.textMuted;
          return (
            <Pressable
              key={teamId}
              onPress={() => {
                setActiveTeam(teamId).catch((e) =>
                  console.warn('OtherTeamsMatchdays:setActiveTeam', e),
                );
              }}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
              accessibilityLabel={`Cambiar a ${teamName}: próxima jornada contra ${md.opponent}`}
            >
              <Text style={styles.kicker} numberOfLines={1}>
                PRÓXIMA JORNADA
              </Text>
              <Text style={styles.team} numberOfLines={1}>
                {teamName}
              </Text>
              <Text style={styles.rival} numberOfLines={1}>
                <Text style={styles.vs}>vs </Text>
                {md.opponent}
              </Text>
              <Text style={styles.when} numberOfLines={1}>
                {when}
              </Text>
              {myPlayerId ? (
                <View style={[styles.chip, { borderColor: rsvpColor }]}>
                  <Text style={[styles.chipText, { color: rsvpColor }]}>{rsvp}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginBottom: 22 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.4,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 10,
    },
    card: {
      width: 200,
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 3,
    },
    kicker: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 1.6,
      color: c.textMuted,
    },
    team: { color: c.text, fontSize: 14, fontWeight: '700' },
    rival: { color: c.text, fontSize: 13 },
    vs: { color: c.textMuted },
    when: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    chip: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    chipText: { fontSize: 11, fontWeight: '700' },
  });
