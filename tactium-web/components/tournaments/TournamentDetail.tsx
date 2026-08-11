"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import {
  CONSOLATION_ROUNDS,
  GROUPS,
  KO_ROUNDS,
  SCHEDULED,
  SCHEDULE_CONFIG,
  SCHEDULE_COURTS,
  SCHEDULE_HOURS,
  SIGNUPS,
  STATE_LABEL,
  tournamentById,
  type BracketTie,
  type ScheduledMatch,
} from "@/lib/tournament-data";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconAlert, IconCopy, IconTrophy, IconZap } from "@/components/Icon";

type Tab =
  | "inscripciones"
  | "grupos"
  | "clasificacion"
  | "cuadro"
  | "horario"
  | "config";

const TABS: [Tab, string][] = [
  ["inscripciones", "Inscripciones"],
  ["grupos", "Grupos"],
  ["clasificacion", "Clasificación"],
  ["cuadro", "Cuadro"],
  ["horario", "Horario"],
  ["config", "Configuración"],
];

/* ── Cuadro ────────────────────────────────────────────────────── */
function Bracket({
  rounds,
  title,
}: {
  rounds: { round: string; ties: BracketTie[] }[];
  title?: string;
}) {
  return (
    <div style={{ marginBottom: title ? 28 : 0 }}>
      {title && (
        <Eyebrow style={{ marginBottom: 14, paddingLeft: 24 }}>{title}</Eyebrow>
      )}
      <div className="tw-bracket-scroll">
        <div className="tw-bracket">
          {rounds.map((col) => (
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
                      const tbd = name === "Por determinar";
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
                            opacity: tbd ? 0.45 : decided && !isWinner ? 0.5 : 1,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              fontSize: 12.5,
                              fontWeight: isWinner ? 700 : 500,
                              fontStyle: tbd ? "italic" : "normal",
                            }}
                          >
                            {name}
                          </span>
                        </div>
                      );
                    })}
                    {t.score && (
                      <div
                        className="mono"
                        style={{
                          padding: "6px 12px",
                          fontSize: 10.5,
                          letterSpacing: "0.08em",
                          color: "var(--text-faint)",
                          borderTop: "1px solid var(--hair)",
                        }}
                      >
                        {t.score}
                      </div>
                    )}
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
                padding: "20px 14px",
                borderRadius: 12,
                background: "var(--accent-10)",
                border: "1.5px solid var(--accent)",
                textAlign: "center",
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <IconTrophy size={20} />
              Por determinar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Rejilla de horario ────────────────────────────────────────── */
function ScheduleGrid() {
  const [matches, setMatches] = useState<ScheduledMatch[]>(SCHEDULED);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const unassigned = matches.filter((m) => m.hour === null || m.court === null);

  /** Una pareja no puede jugar dos partidos a la misma hora. */
  function conflictAt(hour: number, court: number, movingId: string): string | null {
    const moving = matches.find((m) => m.id === movingId);
    if (!moving) return null;
    const occupied = matches.find(
      (m) => m.hour === hour && m.court === court && m.id !== movingId
    );
    if (occupied) return `Pista ocupada por ${occupied.round.toLowerCase()}`;
    const sameHour = matches.filter((m) => m.hour === hour && m.id !== movingId);
    const clash = sameHour.find(
      (m) => m.a === moving.a || m.b === moving.b || m.a === moving.b || m.b === moving.a
    );
    if (clash) return "Esa pareja ya juega a esa hora";
    return null;
  }

  function drop(hour: number, court: number) {
    if (!dragId) return;
    if (conflictAt(hour, court, dragId)) {
      setDragId(null);
      setHover(null);
      return;
    }
    setMatches((ms) =>
      ms.map((m) => (m.id === dragId ? { ...m, hour, court } : m))
    );
    setDragId(null);
    setHover(null);
  }

  function MatchCard({ m }: { m: ScheduledMatch }) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          setDragId(m.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", m.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setHover(null);
        }}
        className="tw-match-card"
        style={{ opacity: dragId === m.id ? 0.4 : 1 }}
      >
        <span
          className="mono"
          style={{
            fontSize: 8.5,
            letterSpacing: "0.16em",
            color: "var(--accent)",
          }}
        >
          {m.round} · {m.category}
        </span>
        <span style={{ display: "block", marginTop: 5, fontSize: 11.5, fontWeight: 700 }}>
          {m.a}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {m.b}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Configuración */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "16px 20px",
          borderBottom: "1px solid var(--hair)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="mono tw-stat-label">DURACIÓN POR PARTIDO</div>
          <div className="mono" style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            {SCHEDULE_CONFIG.minutesPerMatch} min
          </div>
        </div>
        <div>
          <div className="mono tw-stat-label">DESCANSO ENTRE PARTIDOS</div>
          <div className="mono" style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            {SCHEDULE_CONFIG.restBetween} min
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ padding: "10px 16px", fontSize: 12.5 }}>
          <IconZap size={14} />
          Generar horario
        </button>
        <button
          className="btn btn-danger-ghost"
          onClick={() => setClearOpen(true)}
          style={{ padding: "10px 16px", fontSize: 12.5 }}
        >
          Vaciar horario
        </button>
      </div>

      {/* Sin asignar */}
      {unassigned.length > 0 && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--hair)",
            background: "var(--bg-card-2)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.16em",
              color: "var(--warning)",
              marginBottom: 10,
            }}
          >
            SIN HORA · {unassigned.length}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {unassigned.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}

      {/* Rejilla horas × pistas */}
      <div className="tw-grid-scroll">
        <div
          className="tw-sched-canvas"
          style={{
            gridTemplateColumns: `70px repeat(${SCHEDULE_COURTS.length}, minmax(150px, 1fr))`,
          }}
        >
          <span />
          {SCHEDULE_COURTS.map((c) => (
            <span
              key={c}
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.16em",
                color: "var(--text-faint)",
                textAlign: "center",
                paddingBottom: 10,
              }}
            >
              {c.toUpperCase()}
            </span>
          ))}

          {SCHEDULE_HOURS.map((h, hi) => (
            <Fragment key={h}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: "var(--text-faint)",
                  alignSelf: "start",
                  paddingTop: 12,
                }}
              >
                {h}
              </span>
              {SCHEDULE_COURTS.map((_, ci) => {
                const key = `${hi}-${ci}`;
                const m = matches.find((x) => x.hour === hi && x.court === ci);
                const isHover = hover === key && dragId !== null;
                const conflict = dragId ? conflictAt(hi, ci, dragId) : null;
                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHover(key);
                    }}
                    onDragLeave={() => setHover(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(hi, ci);
                    }}
                    className="tw-slot-cell"
                    style={{
                      borderColor: isHover
                        ? conflict
                          ? "var(--error)"
                          : "var(--accent)"
                        : "var(--hair)",
                      background: isHover
                        ? conflict
                          ? "var(--error-soft)"
                          : "var(--accent-10)"
                        : "transparent",
                    }}
                  >
                    {m ? (
                      <MatchCard m={m} />
                    ) : isHover && conflict ? (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.1em",
                          color: "var(--error)",
                          textAlign: "center",
                          padding: 6,
                        }}
                      >
                        {conflict.toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        labelledBy="vaciar-horario"
        width={440}
      >
        <h2 id="vaciar-horario" style={{ fontSize: 22 }}>
          ¿Quitar todas las horas y pistas asignadas?
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
          Los partidos vuelven a la bandeja de «sin hora».
        </p>
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setClearOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              setMatches((ms) => ms.map((m) => ({ ...m, hour: null, court: null })));
              setClearOpen(false);
            }}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            Vaciar
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ── Pantalla ──────────────────────────────────────────────────── */
export function TournamentDetail({
  id,
  spectator,
}: {
  id: string;
  /** Vista de jugador/espectador: sin acciones de organizador. */
  spectator?: boolean;
}) {
  const t = tournamentById(id);
  const [tab, setTab] = useState<Tab>(spectator ? "cuadro" : "inscripciones");
  const [followed, setFollowed] = useState(false);
  const [copied, setCopied] = useState(false);

  const standings = useMemo(
    () => GROUPS.flatMap((g) => g.pairs).sort((a, b) => b.pts - a.pts),
    []
  );

  if (!t) {
    return (
      <Card>
        <EmptyState
          icon={<IconAlert size={34} />}
          title="Torneo no disponible."
          body="Puede que el enlace haya caducado o el torneo se haya borrado."
        />
      </Card>
    );
  }

  const visibleTabs = spectator
    ? TABS.filter(([k]) => k !== "inscripciones" && k !== "config")
    : TABS;

  return (
    <div className="tw-lineup-wrap">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div className="amb" style={{ padding: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <Eyebrow>TORNEO · {t.type.toUpperCase()}</Eyebrow>
              <h1 style={{ margin: "12px 0 0", fontSize: 32, lineHeight: 1.04 }}>
                {t.name}
              </h1>
              <div
                className="mono"
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                }}
              >
                {t.club} · {t.place} · {t.dates ?? "Fecha por confirmar"}
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {t.categories.map((c) => (
                  <span key={c} className="chip chip-mute">
                    {c}
                  </span>
                ))}
                {t.genders.map((g) => (
                  <span key={g} className="chip chip-mute">
                    {g}
                  </span>
                ))}
                <span className="chip">{STATE_LABEL[t.state]}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {spectator ? (
                <>
                  <button
                    className={"btn " + (followed ? "btn-ghost" : "btn-accent")}
                    onClick={() => setFollowed((v) => !v)}
                    style={{ padding: "12px 22px", fontSize: 13.5 }}
                  >
                    {followed ? "Seguido" : "Seguir torneo"}
                  </button>
                  <Link
                    href={`/torneos/${t.id}/inscripcion`}
                    className="btn btn-ghost"
                    style={{ padding: "12px 20px", fontSize: 13.5 }}
                  >
                    Apuntarme a este torneo
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/torneos/${t.id}/inscripcion`}
                    className="btn btn-ghost"
                    style={{ padding: "11px 18px", fontSize: 13 }}
                  >
                    Ficha de inscripción
                  </Link>
                  <button className="btn btn-ghost" style={{ padding: "11px 18px", fontSize: 13 }}>
                    Alta manual
                  </button>
                </>
              )}
            </div>
          </div>

          {!spectator && (
            <div
              style={{
                marginTop: 22,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderRadius: 12,
                background: "var(--bg-card-2)",
                flexWrap: "wrap",
              }}
            >
              <span className="eyebrow">CÓDIGO DE INSCRIPCIÓN</span>
              <span
                className="mono"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "var(--accent)",
                }}
              >
                {t.code}
              </span>
              <button
                type="button"
                aria-label="Copiar código"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(t.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    /* se puede copiar a mano */
                  }
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: copied ? "var(--accent)" : "var(--text-faint)",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <IconCopy size={16} />
              </button>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Compártelo para que se apunten desde la app.
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* ── Pestañas ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {visibleTabs.map(([k, label]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="btn"
              style={{
                padding: "10px 18px",
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
      </div>

      {/* ── Contenido ────────────────────────────────────────────── */}
      {tab === "inscripciones" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="tw-roster-scroll">
            <div className="tw-signup-head">
              <span>Pareja</span>
              <span>Categoría</span>
              <span>Género</span>
              <span>Puntos</span>
              <span>Cuota</span>
              <span>Contacto</span>
            </div>
            {SIGNUPS.map((s) => (
              <div key={s.pair} className="tw-signup-row">
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{s.pair}</span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {s.category}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-faint)" }}
                >
                  {s.gender.toUpperCase()}
                </span>
                <span className="mono" style={{ fontSize: 13, color: "var(--accent)" }}>
                  {s.pts}
                </span>
                <span>
                  {s.paid ? (
                    <span className="chip">Pagada</span>
                  ) : (
                    <span className="chip chip-warning">Pendiente</span>
                  )}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-muted)" }}
                >
                  {s.phone}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "grupos" && (
        <div className="tw-club-grid">
          {GROUPS.map((g) => (
            <Card key={g.name} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hair)" }}>
                <Eyebrow>{g.name}</Eyebrow>
              </div>
              {g.pairs.map((p, i) => (
                <div
                  key={p.pair}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom:
                      i === g.pairs.length - 1 ? "none" : "1px solid var(--hair)",
                    boxShadow: p.through ? "inset 2px 0 0 var(--accent)" : "none",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--text-faint)", width: 18 }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: p.through ? 700 : 500 }}>
                    {p.pair}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {p.won}-{p.lost}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
                  >
                    {p.pts}
                  </span>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {tab === "clasificacion" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="tw-roster-scroll">
            <div className="tw-standings-head">
              {["POS", "PAREJA", "PJ", "PG", "PP", "SETS +", "SETS −", "JUEGOS +", "JUEGOS −", "PTS"].map(
                (h) => (
                  <span key={h}>{h}</span>
                )
              )}
            </div>
            {standings.map((p, i) => (
              <div
                key={p.pair}
                className="tw-standings-row"
                style={{
                  boxShadow: p.through ? "inset 2px 0 0 var(--accent)" : "none",
                }}
              >
                <span className="mono">{i + 1}</span>
                <span style={{ fontWeight: 700 }}>{p.pair}</span>
                <span className="mono">{p.played}</span>
                <span className="mono">{p.won}</span>
                <span className="mono">{p.lost}</span>
                <span className="mono">{p.setsFor}</span>
                <span className="mono">{p.setsAgainst}</span>
                <span className="mono">{p.gamesFor}</span>
                <span className="mono">{p.gamesAgainst}</span>
                <span className="mono" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  {p.pts}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "cuadro" && (
        <Card style={{ padding: "24px 0" }}>
          <Bracket rounds={KO_ROUNDS} title="CUADRO PRINCIPAL" />
          {t.type === "Cuadro con consolación" && (
            <Bracket rounds={CONSOLATION_ROUNDS} title="CUADRO DE CONSOLACIÓN" />
          )}
        </Card>
      )}

      {tab === "horario" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ScheduleGrid />
        </Card>
      )}

      {tab === "config" && (
        <Card>
          <Eyebrow>CONFIGURACIÓN</Eyebrow>
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            Edita el torneo desde el asistente de creación.
          </p>
          <Link
            href="/club/torneos"
            className="btn btn-ghost"
            style={{ marginTop: 18, padding: "12px 20px", fontSize: 13.5 }}
          >
            Editar torneo
          </Link>
        </Card>
      )}
    </div>
  );
}

