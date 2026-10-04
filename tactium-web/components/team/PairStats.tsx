"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

import { fetchPlayers, fetchTeamPairStats } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, CardHead, Table } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconUsers } from "@/components/Icon";
import { EASE } from "@/components/entry/motion-bits";

/** Apellido para la pareja: «Luis Gómez» → «Gómez»; con alias, el alias. */
function surname(p: { name: string; alias: string | null }): string {
  const alias = p.alias?.trim();
  if (alias) return alias;
  const parts = p.name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/**
 * Con quién juega mejor cada jugador del equipo activo («Parejas»).
 *
 * La RPC `team_pair_stats` devuelve ids de jugador, así que hay que cruzarla
 * con la plantilla para poner nombres. Se ordena por victorias y no por
 * porcentaje: una pareja con 1 de 1 no es mejor que otra con 7 de 10.
 *
 * `embedded`: dentro de /equipo (pestaña), sin repetir el nombre del equipo.
 * `myPlayerId`: resalta tu pareja, como en la app.
 */
export function PairStats({
  embedded = false,
  myPlayerId = null,
}: {
  embedded?: boolean;
  myPlayerId?: string | null;
} = {}) {
  const { activeTeam } = useSession();
  const reduce = useReducedMotion();
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
    const byId = new Map(data.players.map((p) => [p.id, p]));
    const label = (id: string) => {
      const p = byId.get(id);
      if (!p) return "—";
      return `${surname(p)}${id === myPlayerId ? " (tú)" : ""}`;
    };
    return data.pairs
      .filter((p) => p.played > 0)
      .map((p) => ({
        key: `${p.a}-${p.b}`,
        names: `${label(p.a)} / ${label(p.b)}`,
        mine: !!myPlayerId && (p.a === myPlayerId || p.b === myPlayerId),
        wins: p.wins,
        played: p.played,
      }))
      .sort((x, y) => y.wins - x.wins || y.played - x.played);
  }, [data, myPlayerId]);

  if (!teamId) return null;
  if (loading) return <SkeletonCard />;
  if (error) return null;

  return (
    <Card flush>
      <CardHead
        title="Parejas"
        count={rows.length || undefined}
        sub={
          embedded
            ? "Liga · ordenadas por victorias, no por porcentaje"
            : `Con quién juega mejor cada jugador de ${activeTeam?.name ?? "tu equipo"}`
        }
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
              <th className="num" style={{ width: 40 }}>
                #
              </th>
              <th>Pareja</th>
              <th className="num">Jugados</th>
              <th className="num">Ganados–perdidos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr
                key={r.key}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 12) * 0.06 }}
                style={r.mine ? { background: "var(--accent-10)" } : undefined}
              >
                <td className="num cell-muted">{i + 1}</td>
                <td className="cell-main">{r.names}</td>
                <td className="num cell-muted">{r.played}</td>
                <td
                  className="num mono"
                  style={{
                    fontWeight: 700,
                    color: r.wins * 2 >= r.played ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {r.wins}–{r.played - r.wins}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
