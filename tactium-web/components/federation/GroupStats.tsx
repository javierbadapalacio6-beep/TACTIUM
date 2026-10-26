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
  fetchGroupResults,
  niceName,
  projectTable,
  suggestLineup,
  teamResults,
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
  standings,
}: {
  idGrupo: string;
  equipos: string[];
  myTeam: string | null;
  /** Puntos y enfrentamientos de cada equipo (para la proyección). */
  standings: { equipo: string; puntos: number; enf: number }[];
}) {
  const key = equipos.join("|");
  const actas = useAsync(() => fetchGroupActas(idGrupo), [idGrupo]);
  const results = useAsync(() => fetchGroupResults(idGrupo), [idGrupo]);
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
  const form = myTeam ? teamResults(results.data ?? [], myTeam, equipos) : [];
  const projection = projectTable(standings, (equipos.length - 1) * 2);
  const myEnf = standings.find((r) => r.equipo === myTeam)?.enf ?? 0;
  const myPairs = myTeam ? stats.pairs.filter((p) => p.team === myTeam) : [];
  const myPlayers = myTeam ? stats.players.filter((p) => p.team === myTeam) : [];
  const suggestion = myTeam ? suggestLineup(stats, myTeam).filter((x) => x.pair) : [];

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

      {myTeam && form.length > 0 ? (
        <Card>
          <h3 style={{ margin: 0, fontSize: 16 }}>Tendencia</h3>
          <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>Tus enfrentamientos jugados</p>
          {form.map((f) => (
            <div key={`${f.jornada}${f.rival}`} style={rowStyle}>
              <span style={{ width: 28, height: 28, borderRadius: 14, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, background: f.won ? "var(--accent-10)" : "rgba(220,60,60,0.12)", color: f.won ? "var(--accent)" : "#d33" }}>{f.won ? "V" : "D"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{f.rival}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Jornada {f.jornada ?? "–"} · {f.home ? "en casa" : "fuera"}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{f.us}-{f.them}</div>
            </div>
          ))}
        </Card>
      ) : null}

      <Card>
        <h3 style={{ margin: 0, fontSize: 16 }}>Proyección</h3>
        {myEnf >= 2 ? (
          <>
            <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>Puntos al acabar la liga si cada equipo mantiene su ritmo (orientativa)</p>
            {projection.map((p, i) => (
              <div key={p.equipo} style={rowStyle}>
                <span className="mono" style={{ width: 18, color: "var(--text-muted)" }}>{i + 1}</span>
                <div style={{ flex: 1, fontWeight: 700, color: p.equipo === myTeam ? "var(--accent)" : undefined }}>{p.equipo}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{p.proj.toFixed(1).replace(".", ",")}</div>
              </div>
            ))}
          </>
        ) : (
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Disponible desde que tu equipo juegue su segundo enfrentamiento: con uno solo, el ritmo no dice nada.</p>
        )}
      </Card>

      {myTeam && myPairs.length > 0 ? (
        <Card>
          <h3 style={{ margin: 0, fontSize: 16 }}>Tus parejas</h3>
          <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>Con quién has jugado y cómo os ha ido</p>
          {myPairs.map((p) => (
            <div key={`${p.a}${p.b}`} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{niceName(p.a)}</div>
                <div style={{ fontWeight: 700 }}>{niceName(p.b)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.courts.length ? `P${[...p.courts].sort().join(", P")}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{p.pg}-{p.pj - p.pg}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sg(p.sf - p.sc)} sets · {sg(p.jf - p.jc)} juegos</div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {myTeam && myPlayers.length > 0 ? (
        <Card>
          <h3 style={{ margin: 0, fontSize: 16 }}>Tus jugadores</h3>
          <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>Partidos ganados y juegos de cada uno</p>
          {myPlayers.map((p) => (
            <div key={p.name} style={rowStyle}>
              <div style={{ flex: 1, fontWeight: 700 }}>{niceName(p.name)}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{p.pg}-{p.pj - p.pg}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sg(p.jf - p.jc)} juegos</div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {suggestion.length > 0 ? (
        <Card>
          <h3 style={{ margin: 0, fontSize: 16 }}>Sugerencia de parejas</h3>
          <p style={{ margin: "4px 0 6px", fontSize: 12.5, color: "var(--text-muted)" }}>La mejor pareja de cada pista según tu historial, sin repetir jugadores. Solo orienta: no cambia tu alineación.</p>
          {suggestion.map((x) => (
            <div key={x.court} style={rowStyle}>
              <span className="mono" style={{ width: 26, color: "var(--text-muted)" }}>P{x.court}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{niceName(x.pair!.a)}</div>
                <div style={{ fontWeight: 700 }}>{niceName(x.pair!.b)}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{x.rec!.pg}-{x.rec!.pj - x.rec!.pg}</div>
            </div>
          ))}
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

