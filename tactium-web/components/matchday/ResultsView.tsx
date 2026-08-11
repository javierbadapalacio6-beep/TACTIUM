"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  LINEUP_VARIANTS,
  RIVAL_PAIRS,
  TEAM,
  courtTotals,
  gameTotals,
  matchdayById,
  playerById,
} from "@/lib/team-data";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconCalendar, IconLock } from "@/components/Icon";

/**
 * Resultados.
 *
 * Es la pantalla que usan los JUGADORES para meter el resultado de su propio
 * partido, no solo el capitán. Por eso la pista del usuario se resalta arriba
 * con el rótulo "TU PARTIDO" y el resto queda por debajo.
 */
export function ResultsView({ id }: { id: string }) {
  const m = matchdayById(id);
  const official = LINEUP_VARIANTS.find((v) => v.official) ?? LINEUP_VARIANTS[0];

  const courts = useMemo(
    () =>
      RIVAL_PAIRS.map((rp, i) => {
        const pair = official.pairs[i] ?? [null, null];
        const mine = pair.some((pid) => playerById(pid)?.isMe);
        return { court: i + 1, pair, rival: rp, mine };
      }),
    [official]
  );

  const [sets, setSets] = useState<Record<number, [number, number][]>>(() =>
    Object.fromEntries(
      courts.map((c) => [
        c.court,
        [
          [0, 0],
          [0, 0],
          [0, 0],
        ] as [number, number][],
      ])
    )
  );

  const asResults = courts.map((c) => ({
    court: c.court,
    ours: c.pair as [string, string],
    rivalPair: c.rival.split(" · ") as [string, string],
    sets: sets[c.court],
  }));
  const totals = courtTotals(asResults);
  const games = gameTotals(asResults);

  if (!m) {
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

  const readOnly = m.state === "closed";

  function edit(court: number, si: number, side: 0 | 1, v: string) {
    const n = Math.max(0, Math.min(9, Number(v.replace(/\D/g, "")) || 0));
    setSets((s) => ({
      ...s,
      [court]: s[court].map((pair, i) =>
        i === si
          ? ((side === 0 ? [n, pair[1]] : [pair[0], n]) as [number, number])
          : pair
      ),
    }));
  }

  const mine = courts.find((c) => c.mine);
  const rest = courts.filter((c) => !c.mine);

  function CourtCard({ c }: { c: (typeof courts)[number] }) {
    const a = playerById(c.pair[0]);
    const b = playerById(c.pair[1]);
    const s = sets[c.court];
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
            vs {c.rival}
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
          {TEAM.name} vs {m.rival}
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
          {m.date} · {m.time} · {m.home ? "LOCAL" : "VISITANTE"}
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

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mine && <CourtCard c={mine} />}
        {rest.map((c) => (
          <CourtCard key={c.court} c={c} />
        ))}
      </div>

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
