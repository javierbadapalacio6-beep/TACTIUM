"use client";

import Link from "next/link";
import { useState } from "react";

import {
  createMatchday,
  fetchMatchdays,
  fetchSeasons,
  type DbMatchday,
  type DbSeason,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import { IconCalendar, IconLock, IconPlus } from "@/components/Icon";

/** Etiqueta de formato a partir de la fase que guarda la base de datos. */
const PHASE_FORMAT: Record<DbSeason["phase"], string> = {
  liga: "Liga regular",
  playoff: "Eliminatorias",
  mixto: "Liga + Playoff",
};

/** Fecha del partido: «sáb 12 jul», o vacío si no hay o no es válida. */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
}

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
  const { user, activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;
  const [tab, setTab] = useState<"jornadas" | "cuadro">("jornadas");
  const [newOpen, setNewOpen] = useState(false);
  // Formulario de nueva jornada.
  const [jorRival, setJorRival] = useState("");
  const [jorDate, setJorDate] = useState("");
  const [jorTime, setJorTime] = useState("");
  const [jorLoc, setJorLoc] = useState("");
  const [jorHome, setJorHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // La temporada vive bajo el equipo; las jornadas se piden por su id. Ambas van
  // en paralelo porque son independientes bajo RLS.
  const { data, loading, error } = useAsync(
    async () => {
      const [seasons, matchdays] = await Promise.all([
        teamId ? fetchSeasons(teamId) : Promise.resolve<DbSeason[]>([]),
        fetchMatchdays(id),
      ]);
      return { season: seasons.find((s) => s.id === id) ?? null, matchdays };
    },
    [id, teamId, user?.id, reloadKey],
    !!user,
  );

  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="No se pudo cargar la temporada"
          body={error}
        />
      </Card>
    );
  }

  const dbSeason = data?.season ?? null;
  if (!dbSeason) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="Temporada no encontrada"
          body="Puede que no exista o que no tengas acceso a ella."
        />
      </Card>
    );
  }

  const matchdays = data?.matchdays ?? [];
  const format = PHASE_FORMAT[dbSeason.phase] ?? "Liga regular";
  const hasBracket = format !== "Liga regular";
  const archived = !dbSeason.active;

  const rounds = [...matchdays].sort((a, b) => a.round - b.round);
  const nextRound = rounds.find((r) => r.status !== "finished");

  async function saveJornada() {
    if (busy) return;
    if (!jorRival.trim()) {
      setToast("Pon el rival de la jornada.");
      return;
    }
    const nextNum =
      matchdays.reduce((m, j) => Math.max(m, j.round), 0) + 1;
    setBusy(true);
    const res = await guardedWrite("crear la jornada", () =>
      createMatchday(id, {
        jornada_number: nextNum,
        opponent: jorRival.trim(),
        match_date: jorDate || null,
        match_time: jorTime || null,
        is_home: jorHome,
        location: jorLoc.trim() || null,
      }),
    );
    setBusy(false);
    if (res.ok) {
      setNewOpen(false);
      setJorRival("");
      setJorDate("");
      setJorTime("");
      setJorLoc("");
      setJorHome(true);
      setReloadKey((k) => k + 1);
      setToast("Jornada creada");
    } else {
      setToast(res.reason);
    }
  }

  // Balance y tasa de victorias a partir de las jornadas con acta cerrada.
  const finished = matchdays.filter((m) => m.status === "finished");
  const seasonWon = finished.filter((m) => m.outcome === "win").length;
  const seasonDrawn = finished.filter((m) => m.outcome === "draw").length;
  const seasonLost = finished.filter((m) => m.outcome === "loss").length;
  const played = finished.length;
  const totalRounds = dbSeason.totalMatchdays ?? matchdays.length;
  const winRatePct = played ? Math.round((seasonWon / played) * 100) : 0;

  const teamLine = [
    activeTeam?.name,
    activeTeam?.category,
    "Federación Cántabra de Pádel",
  ]
    .filter(Boolean)
    .join(" · ");

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
          <h1 style={{ fontSize: 30 }}>{dbSeason.name}</h1>
          <span className={"chip " + (dbSeason.active ? "" : "chip-mute")}>
            {dbSeason.active ? "Activa" : "Archivada"}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: "var(--text-faint)",
            }}
          >
            {format.toUpperCase()}
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
          {teamLine}
        </p>
      </div>

      {archived && (
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
          { l: "JORNADAS", v: String(totalRounds) },
          { l: "JUGADAS", v: `${played}/${totalRounds}` },
          { l: "BALANCE", v: `${seasonWon}-${seasonDrawn}-${seasonLost}` },
          { l: "TASA V.", v: `${winRatePct}%`, accent: true },
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
        {!archived && (
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
            {rounds.map((j: DbMatchday, i) => {
              const isNext = j.id === nextRound?.id;
              const hasScore =
                j.scoreFor !== null && j.scoreAgainst !== null;
              const won = hasScore && j.scoreFor! > j.scoreAgainst!;
              const drew = hasScore && j.scoreFor === j.scoreAgainst;
              const meta = [fmtDate(j.date), j.time?.slice(0, 5), j.location]
                .filter(Boolean)
                .join(" · ");
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
                    vs {j.opponent}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "0.08em",
                      color: "var(--text-muted)",
                    }}
                  >
                    {meta}
                  </span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={"chip " + (j.isHome ? "" : "chip-mute")}>
                      {j.isHome ? "Local" : "Visitante"}
                    </span>
                    {hasScore ? (
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
                        {j.scoreFor}–{j.scoreAgainst}
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
                    {j.status === "finished" ? "ACTA" : ""}
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
          {(
            [
              ["RIVAL", "Club Visitante", "text", jorRival, setJorRival],
              ["FECHA DEL PARTIDO", "", "date", jorDate, setJorDate],
              ["HORA DEL PARTIDO", "", "time", jorTime, setJorTime],
              [
                "LUGAR (OPCIONAL)",
                "Ej. Club Pádel Indoor, Pista 3",
                "text",
                jorLoc,
                setJorLoc,
              ],
            ] as const
          ).map(([l, ph, type, val, set]) => (
            <label key={l}>
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
                {l}
              </span>
              <input
                type={type}
                placeholder={ph}
                value={val}
                onChange={(e) => set(e.target.value)}
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
              {(
                [
                  ["En nuestras pistas", true],
                  ["Fuera de casa", false],
                ] as const
              ).map(([s, home]) => {
                const on = jorHome === home;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setJorHome(home)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "9px 10px",
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: on ? 700 : 500,
                      cursor: "pointer",
                      background: on ? "var(--accent-10)" : "transparent",
                      color: on ? "var(--accent)" : "var(--text-muted)",
                      border: "none",
                      boxShadow: on ? "inset 0 0 0 1.5px var(--accent)" : "none",
                      fontFamily: "'Satoshi', sans-serif",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
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
            disabled={busy}
            onClick={saveJornada}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            {busy ? "Creando…" : "Crear jornada"}
          </button>
        </div>
      </Modal>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
