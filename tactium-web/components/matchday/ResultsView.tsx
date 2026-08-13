"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { courtTotals, gameTotals, type CourtResult } from "@/lib/team-data";
import {
  fetchMatchdayBundle,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconCalendar, IconLock } from "@/components/Icon";

/**
 * Resultados — datos reales.
 *
 * Es la pantalla que usan los JUGADORES para meter el resultado de su propio
 * partido, no solo el capitán. Por eso la pista del usuario se resalta arriba
 * con el rótulo "TU PARTIDO" y el resto queda por debajo.
 *
 * De sólo lectura por ahora: el acta se pinta desde `match_results` (una fila
 * por set) y los controles de entrada quedan como estaban, pendientes de la
 * fase de guardado.
 */

const EMPTY_SETS: [number, number][] = [
  [0, 0],
  [0, 0],
  [0, 0],
];

/** Pista lista para pintar: pareja de la alineación activa + W.O. real. */
interface Court {
  court: number;
  pair: [DbPlayer | null, DbPlayer | null];
  mine: boolean;
  forfeit: boolean;
  forfeitUs: boolean | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function ResultsView({ id }: { id: string }) {
  const { activeTeam, user } = useSession();
  const teamId = activeTeam?.id ?? null;

  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId],
    !!teamId
  );

  // Sets por pista, editables en local (aún sin guardar). Se rellenan al llegar
  // los resultados reales: `match_results` trae una fila por set, aquí se
  // agrupan por pista.
  const [sets, setSets] = useState<Record<number, [number, number][]>>({});

  useEffect(() => {
    if (!data) return;
    const byCourt: Record<number, [number, number][]> = {};
    for (const l of data.lineup) {
      byCourt[l.court] = EMPTY_SETS.map((s) => [...s] as [number, number]);
    }
    for (const r of data.results) {
      if (!byCourt[r.court]) {
        byCourt[r.court] = EMPTY_SETS.map((s) => [...s] as [number, number]);
      }
      const idx = Math.max(0, r.set - 1);
      if (idx < 3) byCourt[r.court][idx] = [r.us, r.them];
    }
    setSets(byCourt);
  }, [data]);

  // Pistas: pareja de la alineación activa, si es mía (mi jugador vinculado) y
  // el W.O. si lo hubiera.
  const courts = useMemo<Court[]>(() => {
    if (!data) return [];
    const byId = new Map(data.players.map((p) => [p.id, p]));

    const map = new Map<number, Court>();
    for (const l of data.lineup) {
      const a = l.playerA ? byId.get(l.playerA) ?? null : null;
      const b = l.playerB ? byId.get(l.playerB) ?? null : null;
      map.set(l.court, {
        court: l.court,
        pair: [a, b],
        mine: [a, b].some((p) => p != null && p.userId === user?.id),
        forfeit: false,
        forfeitUs: null,
      });
    }
    for (const r of data.results) {
      const c =
        map.get(r.court) ??
        ({
          court: r.court,
          pair: [null, null],
          mine: false,
          forfeit: false,
          forfeitUs: null,
        } as Court);
      if (r.forfeit) {
        c.forfeit = true;
        c.forfeitUs = r.forfeitUs;
      }
      map.set(r.court, c);
    }
    return [...map.values()].sort((a, b) => a.court - b.court);
  }, [data, user?.id]);

  if (!teamId) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="Sin equipo activo"
          body="Entra con una cuenta que pertenezca a un equipo."
        />
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="No se pudieron cargar los resultados"
          body={error}
        />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="Sin jornada activa"
          body="Abre una jornada del calendario para empezar."
        />
      </Card>
    );
  }

  const m = data.matchday;
  const readOnly = m.status === "finished";

  const asResults: CourtResult[] = courts.map((c) => ({
    court: c.court,
    ours: null,
    rivalPair: ["", ""],
    sets: sets[c.court] ?? EMPTY_SETS,
    walkover: c.forfeit ? (c.forfeitUs ? "us" : "them") : undefined,
  }));
  const totals = courtTotals(asResults);
  const games = gameTotals(asResults);

  function edit(court: number, si: number, side: 0 | 1, v: string) {
    const n = Math.max(0, Math.min(9, Number(v.replace(/\D/g, "")) || 0));
    setSets((s) => ({
      ...s,
      [court]: (s[court] ?? EMPTY_SETS).map((pair, i) =>
        i === si
          ? ((side === 0 ? [n, pair[1]] : [pair[0], n]) as [number, number])
          : pair
      ),
    }));
  }

  const mine = courts.find((c) => c.mine);
  const rest = courts.filter((c) => !c.mine);

  function CourtCard({ c }: { c: Court }) {
    const [a, b] = c.pair;
    const s = sets[c.court] ?? EMPTY_SETS;
    const u = s.filter(([x, y]) => x > y).length;
    const t = s.filter(([x, y]) => y > x).length;
    const has = u + t > 0;

    return (
      <Card
        style={{
          padding: 22,
          border: c.mine ? "1.5px solid var(--accent)" : "1.5px solid transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: c.mine ? "var(--accent)" : "var(--text-faint)",
            }}
          >
            {c.mine ? `TU PARTIDO · PISTA ${c.court}` : `PISTA ${c.court}`}
          </span>
          {has && (
            <span
              className="chip"
              style={{
                color: u > t ? "var(--accent)" : "var(--error)",
                borderColor: u > t ? "var(--accent-40)" : "var(--error)",
              }}
            >
              {u > t ? "Victoria" : "Derrota"}
            </span>
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {a && b ? `${a.name} · ${b.name}` : "Sin alineación"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
            vs {m.opponent}
          </div>
        </div>

        <div className="tw-sets-row">
          {[0, 1, 2].map((si) => (
            <div key={si}>
              <div
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  color: "var(--text-faint)",
                  marginBottom: 7,
                  textAlign: "center",
                }}
              >
                SET {si + 1}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {([0, 1] as const).map((side) => (
                  <input
                    key={side}
                    type="text"
                    inputMode="numeric"
                    readOnly={readOnly}
                    value={s[si][side] || ""}
                    placeholder="–"
                    aria-label={`Pista ${c.court} set ${si + 1} ${side === 0 ? "nuestro" : "rival"}`}
                    onChange={(e) => edit(c.court, si, side, e.target.value)}
                    className="mono tw-set-input"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {c.mine && !readOnly && (
          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button className="btn btn-accent" style={{ padding: "11px 20px", fontSize: 13 }}>
              Listo
            </button>
            <button
              className="btn btn-ghost"
              onClick={() =>
                setSets((x) => ({
                  ...x,
                  [c.court]: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                }))
              }
              style={{ padding: "11px 18px", fontSize: 13 }}
            >
              Cancelar
            </button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow>RESULTADOS · J·{m.round}</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>
          {activeTeam?.name} vs {m.opponent}
        </h1>
        <div
          className="mono"
          style={{
            marginTop: 8,
            fontSize: 11.5,
            letterSpacing: "0.1em",
            color: "var(--text-muted)",
          }}
        >
          {formatDate(m.date)}
          {m.time ? ` · ${m.time.slice(0, 5)}` : ""} ·{" "}
          {m.isHome ? "LOCAL" : "VISITANTE"}
        </div>
      </div>

      {readOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderRadius: 12,
            background: "var(--bg-card-2)",
            border: "1px solid var(--hair-strong)",
            color: "var(--text-muted)",
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <IconLock size={16} />
          Acta cerrada · no se pueden modificar resultados.
        </div>
      )}

      {courts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={34} />}
            title="Sin alineación"
            body="Aún no hay parejas por pista para esta jornada."
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mine && <CourtCard c={mine} />}
          {rest.map((c) => (
            <CourtCard key={c.court} c={c} />
          ))}
        </div>
      )}

      <Card style={{ marginTop: 20 }}>
        <Eyebrow>RESUMEN</Eyebrow>
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 20,
          }}
        >
          <div>
            <div className="mono tw-stat-label">JUEGOS A FAVOR</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
              {games[0]}
            </div>
          </div>
          <div>
            <div className="mono tw-stat-label">JUEGOS DEL RIVAL</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
              {games[1]}
            </div>
          </div>
          <div>
            <div className="mono tw-stat-label">PISTAS</div>
            <div
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 700,
                marginTop: 6,
                color:
                  totals[0] > totals[1]
                    ? "var(--accent)"
                    : totals[0] < totals[1]
                      ? "var(--error)"
                      : "var(--warning)",
              }}
            >
              {totals[0]}–{totals[1]}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 20 }}>
        <Link
          href={`/jornada/${m.id}`}
          className="btn btn-ghost"
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          Volver a la jornada
        </Link>
      </div>
    </div>
  );
}
