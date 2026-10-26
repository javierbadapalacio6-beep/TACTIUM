"use client";

/**
 * Estadísticas de TU equipo en la Federación (pestaña «Stats» de Plantilla): rendimiento por pista, tendencia,
 * proyección, tus parejas y jugadores, y los líderes del grupo. Salen de las actas de tu grupo.
 */
import { Card } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { fetchTeamStanding } from "@/components/federation/fed-data";
import { FcpGroupStats } from "@/components/federation/GroupStats";
import { useAsync } from "@/lib/use-async";

export function TeamFcpStats({ teamId }: { teamId: string }) {
  const st = useAsync(() => fetchTeamStanding(teamId), [teamId]);
  if (st.loading) return <SkeletonCard />;
  const t = st.data;
  if (!t || !t.idGrupo || t.rows.length === 0) {
    return (
      <Card>
        <EmptyState title="Sin estadísticas" body="Vincula tu equipo a la Federación para ver sus estadísticas." />
      </Card>
    );
  }
  return (
    <FcpGroupStats
      idGrupo={t.idGrupo}
      equipos={t.rows.map((r) => r.equipo)}
      myTeam={t.me?.equipo ?? null}
      standings={t.rows.map((r) => ({ equipo: r.equipo, puntos: r.puntos, enf: r.enf }))}
    />
  );
}
