"use client";

import { useMemo } from "react";

import { fetchPlayers, fetchTeamPairStats } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, CardHead, Table } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconUsers } from "@/components/Icon";

/**
 * Con quién juega mejor cada jugador del equipo activo.
 *
 * La RPC `team_pair_stats` devuelve ids de jugador, así que hay que cruzarla
 * con la plantilla para poder poner nombres. Se ordena por victorias y no por
 * porcentaje: una pareja con 1 de 1 no es mejor que otra con 7 de 10.
 */
export function PairStats() {
  const { activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;

  const { data, loading, error } = useAsync(
    async () => {
      const [pairs, players] = await Promise.all([
        fetchTeamPairStats(teamId!),
        fetchPlayers(teamId!),
      ]);
      return { pairs, players };
    },
    [teamId],
    !!teamId,
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.players.map((p) => [p.id, p.name]));
    return data.pairs
      .filter((p) => p.played > 0)
      .map((p) => ({
        key: `${p.a}-${p.b}`,
        names: `${byId.get(p.a) ?? "—"} · ${byId.get(p.b) ?? "—"}`,
        wins: p.wins,
        played: p.played,
        pct: Math.round((p.wins / p.played) * 100),
      }))
      .sort((x, y) => y.wins - x.wins || y.pct - x.pct);
  }, [data]);

  if (!teamId) return null;
  if (loading) return <SkeletonCard />;
  if (error) return null;

  return (
    <Card flush>
      <CardHead
        title="Parejas"
        count={rows.length || undefined}
        sub={`Con quién juega mejor cada jugador de ${activeTeam?.name ?? "tu equipo"}`}
      />

      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={<IconUsers size={22} />}
          title="Todavía no hay parejas con partidos"
          body="En cuanto cerréis actas con resultados, aquí se verá qué parejas funcionan."
        />
      ) : (
        <Table dense>
          <thead>
            <tr>
              <th>Pareja</th>
              <th className="num">Ganados</th>
              <th className="num">Victorias</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="cell-main">{r.names}</td>
                <td className="num cell-muted">
                  {r.wins}/{r.played}
                </td>
                <td
                  className="num"
                  style={{
                    fontWeight: 700,
                    color: r.pct >= 50 ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {r.pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
