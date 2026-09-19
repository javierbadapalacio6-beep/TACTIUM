"use client";

import { useMemo } from "react";

import { fetchPlayers, fetchTeamPairStats } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
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
    <Card>
      <Eyebrow>CON QUIÉN JUEGAS MEJOR</Eyebrow>
      <h2 style={{ margin: "14px 0 18px", fontSize: 24 }}>
        Parejas de {activeTeam?.name}
      </h2>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={30} />}
          title="Todavía no hay parejas con partidos"
          body="En cuanto cerréis actas con resultados, aquí se verá qué parejas funcionan."
        />
      ) : (
        <div
          style={{
            borderRadius: 12,
            background: "var(--bg-card-2)",
            overflow: "hidden",
          }}
        >
          {rows.map((r, i) => (
            <div
              key={r.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                alignItems: "center",
                gap: 16,
                padding: "12px 18px",
                borderBottom:
                  i === rows.length - 1 ? "none" : "1px solid var(--hair)",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.names}</span>
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--text-faint)" }}
              >
                {r.wins}/{r.played}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: r.pct >= 50 ? "var(--accent)" : "var(--text-muted)",
                  minWidth: 46,
                  textAlign: "right",
                }}
              >
                {r.pct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
