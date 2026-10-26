import React from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { useColors } from '@core/theme';
import { useTeamStore } from '@store/teamStore';
import { GroupStatsView } from './GroupStatsView';
import { useFcpStanding } from './ligaParts';

/**
 * Estadísticas de TU equipo en la Federación (pestaña «Stats» de Equipo): tu rendimiento por pista, tendencia,
 * proyección, tus parejas y jugadores, y los líderes del grupo. Salen de las actas de tu grupo.
 */
export const TeamFcpStats: React.FC = () => {
  const c = useColors();
  const teamId = useTeamStore((s) => s.team?.id) ?? null;
  const { loading, data } = useFcpStanding(teamId);
  if (loading) return <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />;
  if (!data.idGrupo || data.rows.length === 0) {
    return (
      <Text style={{ marginTop: 24, color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
        Vincula tu equipo a la Federación para ver sus estadísticas.
      </Text>
    );
  }
  return (
    <GroupStatsView
      idGrupo={data.idGrupo}
      equipos={data.rows.map((r) => r.equipo)}
      myTeam={data.me?.equipo ?? null}
      standings={data.rows.map((r) => ({ equipo: r.equipo, puntos: r.puntos ?? 0, enf: r.pj }))}
    />
  );
};
