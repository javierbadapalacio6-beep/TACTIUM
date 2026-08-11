"use client";

import Link from "next/link";
import { useState } from "react";

import { MATCHDAYS, SEASONS, TEAM, winRate } from "@/lib/team-data";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconCalendar, IconLock, IconPlus } from "@/components/Icon";

/** Cuadro de eliminatorias: columnas por ronda con conectores. */
const BRACKET = [
  {
    round: "CUARTOS",
    ties: [
      { a: "Halcones A", b: "CP Castro", score: "3–2", winner: 0 },
      { a: "Bahía", b: "Astillero", score: "2–3", winner: 1 },
      { a: "CD Norte", b: "Pádel Sur", score: "3–2", winner: 0 },
      { a: "Raqueta", b: "Indoor", score: "2–3", winner: 1 },
    ],
  },
  {
    round: "SEMIS",
    ties: [
      { a: "Halcones A", b: "Astillero", score: "3–2", winner: 0 },
      { a: "CD Norte", b: "Indoor", score: "2–3", winner: 1 },
    ],
  },
  {
    round: "FINAL",
    ties: [{ a: "Halcones A", b: "Indoor", score: "", winner: -1 }],
  },
];

export function SeasonDetail({ id }: { id: string }) {
  const season = SEASONS.find((s) => s.id === id) ?? SEASONS[0];
  const [tab, setTab] = useState<"jornadas" | "cuadro">("jornadas");
  const [newOpen, setNewOpen] = useState(false);

  const hasBracket = season.format !== "Liga regular";
  const rounds = [...MATCHDAYS].sort((a, b) => a.round - b.round);
  const nextRound = rounds.find((r) => r.state === "pending");

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>TEMPORADA</Eyebrow>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ fontSize: 30 }}>{season.name}</h1>
          <span className={"chip " + (season.active ? "" : "chip-mute")}>
            {season.active ? "Activa" : "Archivada"}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: "var(--text-faint)",
            }}
          >
            {season.format.toUpperCase()}
          </span>
        </div>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "var(--text-faint)",
          }}
        >
          {TEAM.name} · {TEAM.category} · Federación Cántabra de Pádel
        </p>
      </div>

      {season.archived && (
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
          Temporada archivada · solo lectura.
        </div>
      )}

      <div className="tw-solo-stats" style={{ marginBottom: 22 }}>
        {[
          { l: "JORNADAS", v: String(season.rounds) },
          { l: "JUGADAS", v: `${season.played}/${season.rounds}` },
          { l: "BALANCE", v: `${season.won}-${season.drawn}-${season.lost}` },
          { l: "TASA V.", v: `${winRate(season)}%`, accent: true },
        ].map((k) => (
          <Card key={k.l} style={{ padding: 18 }}>
            <div className="mono tw-stat-label">{k.l}</div>
            <div
              className="mono tw-stat-value"
              style={{
                fontSize: 24,
                ...(k.accent ? { color: "var(--accent)" } : null),
              }}
            >
              {k.v}
            </div>
          </Card>
        ))}
      </div>

      {/* Pestañas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        {(
          [
            ["jornadas", "Jornadas"],
            ...(hasBracket ? ([["cuadro", "Cuadro"]] as const) : []),
          ] as const
        ).map(([k, label]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as typeof tab)}
              className="btn"
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                background: on ? "var(--accent-10)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
              }}
            >
              {label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {!season.archived && (
          <button
            className="btn btn-accent"
            onClick={() => setNewOpen(true)}
            style={{ padding: "11px 20px", fontSize: 13 }}
          >
            <IconPlus size={15} />
            Añadir jornada
          </button>
        )}
      </div>

      {/* ── Jornadas ─────────────────────────────────────────────── */}
      {tab === "jornadas" &&
        (rounds.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconCalendar size={34} />}
              title="Aún no hay jornadas"
              body="Añade la primera para empezar a planificar."
            />
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {rounds.map((j, i) => {
              const isNext = j.id === nextRound?.id;
              const won = j.score && j.score[0] > j.score[1];
              const drew = j.score && j.score[0] === j.score[1];
              return (
                <Link
                  key={j.id}
                  href={`/jornada/${j.id}`}
                  className="tw-md-row"
                  style={{
                    borderBottom:
                      i === rounds.length - 1 ? "none" : "1px solid var(--hair)",
                    color: "inherit",
                    boxShadow: isNext ? "inset 2px 0 0 var(--accent)" : "none",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      color: isNext ? "var(--accent)" : "var(--text-faint)",
                    }}
                  >
                    J·{j.round}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    vs {j.rival}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "0.08em",
                      color: "var(--text-muted)",
                    }}
                  >
                    {j.date} · {j.time} · {j.venue}
                  </span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={"chip " + (j.home ? "" : "chip-mute")}>
                      {j.home ? "Local" : "Visitante"}
                    </span>
                    {j.score ? (
                      <span
                        className="mono"
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: won
                            ? "var(--accent)"
                            : drew
                              ? "var(--warning)"
                              : "var(--error)",
                        }}
                      >
                        {j.score[0]}–{j.score[1]}
                      </span>
                    ) : isNext ? (
                      <span className="chip">Próxima</span>
                    ) : null}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.16em",
                      color: "var(--text-faint)",
                    }}
                  >
                    {j.state === "closed" ? "ACTA" : ""}
                  </span>
                </Link>
              );
            })}
          </Card>
        ))}

      {/* ── Cuadro ───────────────────────────────────────────────── */}
      {tab === "cuadro" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="tw-bracket-scroll">
            <div className="tw-bracket">
              {BRACKET.map((col) => (
                <div key={col.round} className="tw-bracket-col">
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      color: "var(--text-faint)",
                      textAlign: "center",
                      marginBottom: 14,
                    }}
                  >
                    {col.round}
                  </div>
                  <div className="tw-bracket-ties">
                    {col.ties.map((t, i) => (
                      <div key={i} className="tw-tie">
                        {[t.a, t.b].map((name, side) => {
                          const isWinner = t.winner === side;
                          const decided = t.winner >= 0;
                          return (
                            <div
                              key={side}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderBottom:
                                  side === 0 ? "1px solid var(--hair)" : "none",
                                boxShadow: isWinner
                                  ? "inset 2px 0 0 var(--accent)"
                                  : "none",
                                opacity: decided && !isWinner ? 0.5 : 1,
                              }}
                            >
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 12.5,
                                  fontWeight: isWinner ? 700 : 500,
                                }}
                              >
                                {name}
                              </span>
                              {decided && side === 0 && (
                                <span
                                  className="mono"
                                  style={{ fontSize: 12, fontWeight: 700 }}
                                >
                                  {t.score}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="tw-bracket-col">
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: "var(--accent)",
                    textAlign: "center",
                    marginBottom: 14,
                  }}
                >
                  CAMPEONES
                </div>
                <div
                  style={{
                    padding: "18px 14px",
                    borderRadius: 12,
                    background: "var(--accent-10)",
                    border: "1.5px solid var(--accent)",
                    textAlign: "center",
                    color: "var(--accent)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Por determinar
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Crear jornada ────────────────────────────────────────── */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} labelledBy="nueva-jor" width={520}>
        <Eyebrow>JORNADA · NUEVA</Eyebrow>
        <h2 id="nueva-jor" style={{ margin: "14px 0 22px", fontSize: 23 }}>
          Crear nueva jornada
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { l: "RIVAL", ph: "Club Visitante", type: "text" },
            { l: "FECHA DEL PARTIDO", ph: "", type: "date" },
            { l: "HORA DEL PARTIDO", ph: "", type: "time" },
            { l: "LUGAR (OPCIONAL)", ph: "Ej. Club Pádel Indoor, Pista 3", type: "text" },
          ].map((f) => (
            <label key={f.l}>
              <span
                className="mono"
                style={{
                  display: "block",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "var(--text-faint)",
                  marginBottom: 7,
                }}
              >
                {f.l}
              </span>
              <input
                type={f.type}
                placeholder={f.ph}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--hair-strong)",
                  background: "var(--bg-card)",
                  color: "var(--text)",
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "'Satoshi', sans-serif",
                }}
              />
            </label>
          ))}

          <div>
            <span
              className="mono"
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              LOCALIZACIÓN
            </span>
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: 4,
                borderRadius: 12,
                background: "var(--bg-card-2)",
              }}
            >
              {["En nuestras pistas", "Fuera de casa"].map((s, i) => (
                <span
                  key={s}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "9px 10px",
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontWeight: i === 0 ? 700 : 500,
                    background: i === 0 ? "var(--accent-10)" : "transparent",
                    color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                    boxShadow: i === 0 ? "inset 0 0 0 1.5px var(--accent)" : "none",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setNewOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => setNewOpen(false)}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            Crear jornada
          </button>
        </div>
      </Modal>
    </div>
  );
}
