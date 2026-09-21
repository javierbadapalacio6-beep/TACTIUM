"use client";

import Link from "next/link";
import { useState } from "react";

import {
  createMatchday,
  fetchMatchdays,
  renumberSeasonMatchdays,
  fetchSeasons,
  type DbMatchday,
  type DbSeason,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  Field,
  Input,
  Modal,
  Note,
  PageHeader,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconChevronRight, IconLock, IconPlus } from "@/components/Icon";

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
    round: "Cuartos",
    ties: [
      { a: "Halcones A", b: "CP Castro", score: "3–2", winner: 0 },
      { a: "Bahía", b: "Astillero", score: "2–3", winner: 1 },
      { a: "CD Norte", b: "Pádel Sur", score: "3–2", winner: 0 },
      { a: "Raqueta", b: "Indoor", score: "2–3", winner: 1 },
    ],
  },
  {
    round: "Semifinales",
    ties: [
      { a: "Halcones A", b: "Astillero", score: "3–2", winner: 0 },
      { a: "CD Norte", b: "Indoor", score: "2–3", winner: 1 },
    ],
  },
  {
    round: "Final",
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

  /**
   * Renumera las jornadas 1..N por fecha. Tras borrar una en medio, la
   * numeración queda con huecos y no hay forma de arreglarla a mano.
   */
  async function renumber() {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("renumerar las jornadas", () =>
      renumberSeasonMatchdays(id),
    );
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Jornadas renumeradas");
    } else setToast(res.reason);
  }

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

  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="No se pudo cargar la temporada"
            body={error}
          />
        </Card>
      </div>
    );
  }

  const dbSeason = data?.season ?? null;
  if (!dbSeason) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Temporada no encontrada"
            body="Puede que no exista o que no tengas acceso a ella."
          />
        </Card>
      </div>
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

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: "/temporadas", label: "Temporadas" }}
        title={dbSeason.name}
        meta={[
          format,
          activeTeam?.name ?? null,
          activeTeam?.category ?? null,
          "Federación Cántabra de Pádel",
        ]}
        actions={
          <>
            <Chip tone={dbSeason.active ? "accent" : "mute"}>
              {dbSeason.active ? "Activa" : "Archivada"}
            </Chip>
            {!archived && tab === "jornadas" && (
              <Btn variant="quiet" onClick={() => void renumber()} disabled={busy}>
                Renumerar
              </Btn>
            )}
            {!archived && (
              <Btn variant="accent" onClick={() => setNewOpen(true)} icon={<IconPlus size={15} />}>
                Añadir jornada
              </Btn>
            )}
          </>
        }
      />

      {archived && (
        <Note icon={<IconLock size={15} />} style={{ marginBottom: 16 }}>
          Temporada archivada: solo lectura.
        </Note>
      )}

      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Jornadas" value={totalRounds} icon={<IconCalendar size={14} />} />
        <Stat label="Jugadas" value={played} unit={`/ ${totalRounds}`} />
        <Stat
          label="Balance"
          value={`${seasonWon}-${seasonDrawn}-${seasonLost}`}
          sub="Ganadas · empatadas · perdidas"
        />
        <Stat
          label="Victorias"
          value={winRatePct}
          unit="%"
          tone={played > 0 && winRatePct >= 50 ? "accent" : undefined}
          sub={played > 0 ? `${seasonWon} de ${played} jugadas` : "Aún sin actas"}
        />
      </StatRow>

      {/* Pestañas */}
      {hasBracket && (
        <div className="tw-toolbar">
          <Segmented
            label="Vista de la temporada"
            value={tab}
            onChange={setTab}
            options={[
              { value: "jornadas", label: "Jornadas" },
              { value: "cuadro", label: "Cuadro" },
            ]}
          />
        </div>
      )}

      {/* ── Jornadas ─────────────────────────────────────────────── */}
      {tab === "jornadas" &&
        (rounds.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconCalendar size={24} />}
              title="Aún no hay jornadas"
              body="Añade la primera para empezar a planificar."
              action={
                !archived ? (
                  <Btn variant="accent" onClick={() => setNewOpen(true)} icon={<IconPlus size={14} />}>
                    Añadir jornada
                  </Btn>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card flush>
            <CardHead title="Jornadas" count={rounds.length} />
            {rounds.map((j: DbMatchday) => {
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
                    boxShadow: isNext ? "inset 2px 0 0 var(--accent)" : "none",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isNext ? "var(--accent)" : "var(--text-faint)",
                    }}
                  >
                    J{j.round}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    vs {j.opponent}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {meta || "Fecha por confirmar"}
                  </span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Chip tone={j.isHome ? "accent" : "mute"} plain>
                      {j.isHome ? "En casa" : "Fuera"}
                    </Chip>
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
                      <Chip>Próxima</Chip>
                    ) : j.status === "finished" ? (
                      <Chip tone="mute" plain>
                        Acta
                      </Chip>
                    ) : null}
                  </span>
                  <span style={{ color: "var(--text-faint)", display: "flex" }}>
                    <IconChevronRight size={16} />
                  </span>
                </Link>
              );
            })}
          </Card>
        ))}

      {/* ── Cuadro ───────────────────────────────────────────────── */}
      {tab === "cuadro" && (
        <Card flush>
          <CardHead title="Cuadro de eliminatorias" sub="Maqueta: los cruces reales llegarán con el playoff." />
          <div className="tw-bracket-scroll">
            <div className="tw-bracket">
              {BRACKET.map((col) => (
                <div key={col.round} className="tw-bracket-col">
                  <div
                    className="grid-head"
                    style={{ textAlign: "center", marginBottom: 14 }}
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
                                  side === 0 ? "1px solid var(--line)" : "none",
                                boxShadow: isWinner
                                  ? "inset 2px 0 0 var(--accent)"
                                  : "none",
                                opacity: decided && !isWinner ? 0.5 : 1,
                              }}
                            >
                              <span
                                className="truncate"
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  fontWeight: isWinner ? 700 : 500,
                                }}
                              >
                                {name}
                              </span>
                              {decided && side === 0 && (
                                <span
                                  className="mono"
                                  style={{ fontSize: 12.5, fontWeight: 700 }}
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
                  className="grid-head"
                  style={{ textAlign: "center", marginBottom: 14 }}
                >
                  Campeón
                </div>
                <div
                  style={{
                    padding: "16px 14px",
                    borderRadius: 10,
                    background: "var(--accent-10)",
                    border: "1px solid var(--accent-40)",
                    textAlign: "center",
                    color: "var(--accent)",
                    fontSize: 13.5,
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
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        labelledBy="nueva-jor"
        width={520}
        title="Nueva jornada"
        lede="Se numera automáticamente a continuación de la última."
        footer={
          <>
            <Btn onClick={() => setNewOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled={busy} onClick={saveJornada}>
              {busy ? "Creando…" : "Crear jornada"}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Rival" htmlFor="jor-rival">
            <Input
              id="jor-rival"
              type="text"
              placeholder="Club Visitante"
              value={jorRival}
              onChange={(e) => setJorRival(e.target.value)}
            />
          </Field>
          <div className="tw-form-grid">
            <Field label="Fecha del partido" htmlFor="jor-fecha">
              <Input
                id="jor-fecha"
                type="date"
                value={jorDate}
                onChange={(e) => setJorDate(e.target.value)}
              />
            </Field>
            <Field label="Hora del partido" htmlFor="jor-hora">
              <Input
                id="jor-hora"
                type="time"
                value={jorTime}
                onChange={(e) => setJorTime(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Lugar" hint="Opcional" htmlFor="jor-lugar">
            <Input
              id="jor-lugar"
              type="text"
              placeholder="Ej. Club Pádel Indoor, Pista 3"
              value={jorLoc}
              onChange={(e) => setJorLoc(e.target.value)}
            />
          </Field>

          <Field label="Localización">
            <Segmented
              label="Localización"
              value={jorHome ? "home" : "away"}
              onChange={(v) => setJorHome(v === "home")}
              options={[
                { value: "home", label: "En nuestras pistas" },
                { value: "away", label: "Fuera de casa" },
              ]}
              style={{ alignSelf: "flex-start" }}
            />
          </Field>
        </div>
      </Modal>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
