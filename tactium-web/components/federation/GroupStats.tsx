"use client";

/**
 * Estadísticas del grupo con las actas de la Federación (mismo cálculo que la app, `lib/group-stats.ts`):
 * tu equipo frente a la media del grupo por pista y en casa/fuera, mejores parejas y jugadores.
 * Los nombres van enteros (nunca con puntos suspensivos).
 */
import { useMemo, useState } from "react";

import { Card } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { useAsync } from "@/lib/use-async";
import {
  computeGroupStats,
  fetchGroupActas,
  niceName,
  type Record2,
} from "@/lib/group-stats";

const pct = (r: Record2) => (r.pj > 0 ? Math.round((r.pg / r.pj) * 100) : 0);
const sg = (n: number) => (n > 0 ? `+${n}` : String(n));

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(value, 2)}%`, height: 6, borderRadius: 3, background: color }} />
    </div>
  );
}

export function FcpGroupStats({
  idGrupo,
  equipos,
  myTeam,
}: {
  idGrupo: string;
  equipos: string[];
  myTeam: string | null;
}) {
  const key = equipos.join("|");
  const actas = useAsync(() => fetchGroupActas(idGrupo), [idGrupo]);
  const stats = useMemo(
    () => (actas.data ? computeGroupStats(actas.data, equipos) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actas.data, key]
  );
  const [allPairs, setAllPairs] = useState(false);
  const [allPlayers, setAllPlayers] = useState(false);

  if (actas.loading) return <SkeletonCard />;
  if (!stats || stats.total === 0) {
    return (
      <Card>
        <EmptyState
          title="Aún sin estadísticas"
          body="Aparecen en cuanto la Federación sube las primeras actas del grupo."
        />
      </Card>
    );
  }

  const mine = myTeam ? stats.courtsByTeam.get(myTeam) ?? [] : [];
  const split = myTeam ? stats.splitByTeam.get(myTeam) : undefined;
  const pairs = allPairs ? stats.pairs : stats.pairs.slice(0, 5);
  const players = allPlayers ? stats.players : stats.players.slice(0, 5);

  const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)" } as const;
  const moreBtn = { cursor: "pointer", width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 12, border: 0, background: "var(--accent-10)", color: "var(--accent)", fontWeight: 700 } as const;

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      {myTeam && (mine.length > 0 || split) ? (
        <Card>
          <h3 style={{ margin: 0, fontSize: 16 }}>Tu equipo · {myTeam}</h3>
          {mine.length > 0 ? (
            <>
              <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
                Partidos ganados por pista, frente a la media del grupo
              </p>
              {mine.map((m) => {
                const g = stats.courtsGroup.find((x) => x.court === m.court);
                const gp = g ? pct(g) : 0;
                return (
                  <div key={m.court} style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong>Pista {m.court}</strong>
                      <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                        {m.pg}/{m.pj} · {pct(m)}% <span style={{ color: "var(--text-faint)" }}>· grupo {gp}%</span>
                      </span>
                    </div>
                    <Bar value={pct(m)} color="var(--accent)" />
                    <Bar value={gp} color="var(--text-faint)" />
                  </div>
                );
              })}
            </>
          ) : null}
          {split ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(
                [
                  ["En casa", split.home],
                  ["Fuera", split.away],
                ] as const
              ).map(([label, r]) => (
                <div key={label} style={{ padding: 12, borderRadius: 12, background: "var(--accent-10)" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--text-muted)" }}>
                    {label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>
                    {r.pg}/{r.pj}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {r.pj > 0 ? `${pct(r)}% ganados` : "Sin partidos"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h3 style={{ margin: 0, fontSize: 16 }}>Mejores parejas</h3>
        <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>
          Por porcentaje de partidos ganados; desempata sets y juegos
        </p>
        {pairs.map((p, i) => (
          <div key={`${p.team}${p.a}${p.b}`} style={rowStyle}>
            <span className="mono" style={{ width: 18, color: "var(--text-muted)" }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{niceName(p.a)}</div>
              <div style={{ fontWeight: 700 }}>{niceName(p.b)}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {p.team}
                {p.courts.length ? ` · P${[...p.courts].sort().join(", P")}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>
                {p.pg}-{p.pj - p.pg}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {sg(p.sf - p.sc)} sets · {sg(p.jf - p.jc)} juegos
              </div>
            </div>
          </div>
        ))}
        {stats.pairs.length > 5 ? (
          <button type="button" style={moreBtn} onClick={() => setAllPairs((v) => !v)}>
            {allPairs ? "Ver menos" : `Ver todas (${stats.pairs.length})`}
          </button>
        ) : null}
      </Card>

      <Card>
        <h3 style={{ margin: 0, fontSize: 16 }}>Jugadores</h3>
        <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>
          Partidos ganados de cada jugador en la liga
        </p>
        {players.map((p, i) => (
          <div key={`${p.team}${p.name}`} style={rowStyle}>
            <span className="mono" style={{ width: 18, color: "var(--text-muted)" }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{niceName(p.name)}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.team}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>
                {p.pg}-{p.pj - p.pg}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{pct(p)}% ganados</div>
            </div>
          </div>
        ))}
        {stats.players.length > 5 ? (
          <button type="button" style={moreBtn} onClick={() => setAllPlayers((v) => !v)}>
            {allPlayers ? "Ver menos" : `Ver todos (${stats.players.length})`}
          </button>
        ) : null}
      </Card>

      <p style={{ gridColumn: "1 / -1", margin: 0, textAlign: "center", fontSize: 11.5, color: "var(--text-faint)" }}>
        Calculado con {stats.total} partidos con acta. Se actualiza solo según la Federación sube actas.
      </p>
    </div>
  );
}

