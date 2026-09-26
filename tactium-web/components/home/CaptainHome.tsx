"use client";

import Link from "next/link";
import { useState } from "react";

import {
  fetchActiveSeason,
  fetchAvailability,
  fetchMatchdays,
  fetchPlayers,
  type DbMatchday,
  type DbPlayer,
  type DbSeason,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Avatar, BtnLink, Card, Chip } from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { SeasonCalendar } from "@/components/home/SeasonCalendar";
import { Crest } from "@/components/Crest";
import {
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconFlag,
  IconSearch,
  IconTrophy,
  IconUpload,
  IconUserPlus,
  IconUsers,
  IconZap,
} from "@/components/Icon";

/**
 * Inicio del capitán — capa «bento».
 *
 * Primera pantalla del lenguaje nuevo: tarjetas de tamaños distintos, cifras
 * grandes, una superficie entera en verde para lo que de verdad importa (la
 * próxima jornada) y el resto en silencio alrededor.
 */

const SHORTCUTS = [
  {
    href: "/equipo",
    title: "Escanear calendario",
    Icon: IconUpload,
  },
  {
    href: "/torneos",
    title: "Explorar torneos",
    Icon: IconSearch,
  },
  {
    href: "/federacion",
    title: "Ver la Federación",
    Icon: IconFlag,
  },
  {
    href: "/ajustes/invitaciones",
    title: "Invitar a un capitán",
    Icon: IconUserPlus,
  },
];

/** dd mmm en español a partir de la fecha ISO de la base. */
function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

/** Días hasta una fecha ISO (negativo si ya pasó). */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86400000);
}

/** Cuándo se juega, en una línea: «Mañana», «En 5 días», «Hace 3 días». */
function whenLabel(d: number | null): string {
  if (d === null) return "Fecha por confirmar";
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d > 1) return `En ${d} días`;
  if (d === -1) return "Ayer";
  return `Hace ${Math.abs(d)} días`;
}

interface HomeData {
  season: DbSeason | null;
  matchdays: DbMatchday[];
  players: DbPlayer[];
  availability: Record<string, boolean>;
}

/** Panel del capitán / jugador de equipo, con datos reales del equipo activo. */
export function CaptainHome({ isCaptain }: { isCaptain: boolean }) {
  const { activeTeam, user } = useSession();
  const teamId = activeTeam?.id ?? null;
  const [avail, setAvail] = useState<"yes" | "no" | null>(null);

  const { data, loading, error } = useAsync<HomeData>(
    async () => {
      const season = await fetchActiveSeason(teamId!);
      const [matchdays, players] = await Promise.all([
        season ? fetchMatchdays(season.id) : Promise.resolve([]),
        fetchPlayers(teamId!),
      ]);
      const next = matchdays.find((m) => m.status !== "finished");
      const availability = next ? await fetchAvailability(next.id) : {};
      return { season, matchdays, players, availability };
    },
    [teamId],
    !!teamId
  );

  if (!teamId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo, o crea el tuyo."
            action={
              <BtnLink href="/empezar" variant="accent">
                Crear equipo
              </BtnLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (loading) return <SkeletonPage />;

  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="No se pudo cargar el inicio"
            body={error}
          />
        </Card>
      </div>
    );
  }

  const season = data?.season ?? null;
  const matchdays = data?.matchdays ?? [];
  const players = data?.players ?? [];
  const availability = data?.availability ?? {};

  const active = players.filter((p) => p.active);
  const availableCount = active.filter((p) =>
    p.id in availability ? availability[p.id] : p.available === true
  ).length;
  const pct = active.length
    ? Math.round((availableCount / active.length) * 100)
    : 0;

  const upcoming = matchdays.filter((m) => m.status !== "finished");
  const played = matchdays.filter((m) => m.status === "finished");
  const wins = played.filter((m) => m.outcome === "win").length;
  const losses = played.filter((m) => m.outcome === "loss").length;
  const m = upcoming[0] ?? null;
  const dUntil = m ? daysUntil(m.date) : null;

  // Racha: las últimas jornadas jugadas, de la más antigua a la más reciente.
  const form = played.slice(-8);
  const totalRounds = season?.totalMatchdays ?? matchdays.length;
  const seasonPct = totalRounds ? Math.round((played.length / totalRounds) * 100) : 0;

  // Jornadas con acta cerrada: alimentan el gráfico de marcadores.
  const scored = played.filter(
    (j) => j.scoreFor != null && j.scoreAgainst != null,
  );
  // Pistas por eliminatoria: normalmente 5, pero se deduce del acta más alta
  // para no dar por hecho un formato que el club puede tener distinto.
  const maxCourts = Math.max(
    5,
    ...scored.map((j) => (j.scoreFor ?? 0) + (j.scoreAgainst ?? 0)),
  );
  const courtsFor = scored.reduce((s, j) => s + (j.scoreFor ?? 0), 0);
  const courtsAgainst = scored.reduce((s, j) => s + (j.scoreAgainst ?? 0), 0);

  // Los que más puntos suman de la plantilla activa: es el orden con el que
  // se monta la alineación, así que verlo de un vistazo tiene valor.
  const topPlayers = [...active].sort((a, b) => b.pts - a.pts).slice(0, 6);
  const topMax = topPlayers[0]?.pts || 1;
  const avgPts = active.length
    ? Math.round(active.reduce((s, p) => s + p.pts, 0) / active.length)
    : 0;

  const greeting = (
    <div className="greet">
      <div className="greet-main">
        <Crest src={activeTeam?.logoUrl} size={56} />
        <div style={{ minWidth: 0 }}>
        <div className="greet-hi">Hola, {(user?.name ?? "").split(" ")[0] || "capitán"}</div>
        <h1 className="greet-name">{activeTeam?.name}</h1>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {activeTeam?.category && (
            <Chip tone="mute" plain>
              {activeTeam.category}
              {activeTeam.gender ? ` · ${activeTeam.gender}` : ""}
            </Chip>
          )}
          {season && (
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
              {season.name}
            </span>
          )}
        </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <BtnLink href="/equipo" icon={<IconUsers size={15} />}>
          Plantilla
        </BtnLink>
        <BtnLink href="/temporadas" variant="quiet" icon={<IconCalendar size={15} />}>
          Temporadas
        </BtnLink>
      </div>
    </div>
  );

  if (!season) {
    return (
      <div className="tw-page">
        {greeting}
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Aún no hay jornadas"
            body="Crea una temporada activa para empezar a planificar."
            action={
              <BtnLink href="/temporadas" variant="accent">
                Crear temporada
              </BtnLink>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="tw-page">
      {greeting}

      <div className="bento">
        {/* ══ La tarjeta que manda: la próxima jornada ══════════════ */}
        {m ? (
          <div className="bcard bcard-accent col-7">
            <div className="bcard-head">
              <span className="tile-round">
                <IconCalendar size={17} />
              </span>
              {/* Si la fecha ya pasó no es «la próxima»: está sin cerrar, y
                  decir las dos cosas a la vez se lee como un error. */}
              <span className="bcard-title">
                {dUntil !== null && dUntil < 0 ? "Jornada sin cerrar" : "Próxima jornada"}
              </span>
              <span className="delta">{whenLabel(dUntil)}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                  Jornada {m.round} · {m.isHome ? "En casa" : "Fuera"}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: "clamp(18px, 1.9vw, 24px)",
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.1,
                  }}
                >
                  vs {m.opponent}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  {formatDate(m.date)}
                  {formatTime(m.time) ? ` · ${formatTime(m.time)}` : ""}
                  {m.location ? ` · ${m.location}` : ""}
                </div>
              </div>

              {/* Disponibles, dentro de la tarjeta que manda: es el dato que
                  decide si el capitán puede hacer su trabajo hoy. */}
              <div style={{ flex: "none" }}>
                <div className="kpi-label">Disponibles</div>
                <div className="kpi-num">
                  {availableCount}
                  <span className="unit">/ {active.length}</span>
                </div>
              </div>
            </div>

            {isCaptain && (
              <div className="bcard-foot" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Si ya se jugó, lo que toca es meter el resultado, no
                    preparar la alineación. */}
                {dUntil !== null && dUntil < 0 ? (
                  <Link href={`/jornada/${m.id}`} className="btn btn-accent">
                    <IconCheck size={15} />
                    Meter el resultado
                  </Link>
                ) : (
                  <Link href={`/jornada/${m.id}/alineacion`} className="btn btn-accent">
                    <IconZap size={15} />
                    Crear alineación
                  </Link>
                )}
                <Link href={`/jornada/${m.id}`} className="btn btn-ghost">
                  Abrir jornada
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bcard col-7">
            <EmptyState
              compact
              icon={<IconTrophy size={22} />}
              title="No quedan jornadas"
              body="Has disputado todas las del calendario."
              action={<BtnLink href={`/temporadas/${season.id}`}>Ver temporada</BtnLink>}
            />
          </div>
        )}

        {/* ══ Balance de la temporada ══════════════════════════════ */}
        <div className="bcard col-5">
          <div className="bcard-head">
            <span className="tile-round tile-round-accent">
              <IconTrophy size={17} />
            </span>
            <span className="bcard-title">Balance</span>
            <span className="delta delta-flat">
              {played.length} de {totalRounds}
            </span>
          </div>

          <div className="kpi-num">
            {wins}
            <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>–</span>
            {losses}
          </div>
          <div className="kpi-sub">
            {wins === losses
              ? "Tantas ganadas como perdidas"
              : wins > losses
                ? `${wins - losses} ${wins - losses === 1 ? "victoria" : "victorias"} de ventaja`
                : `${losses - wins} por debajo`}
          </div>

          {/* Racha: una barra por jornada jugada, verde si se ganó. */}
          {form.length > 0 && (
            <div className="bcard-foot">
              <div className="spark">
                {form.map((j) => {
                  const won = j.outcome === "win";
                  const lost = j.outcome === "loss";
                  const hasScore = j.scoreFor != null && j.scoreAgainst != null;
                  return (
                    <i
                      key={j.id}
                      className={
                        (won ? "on" : lost ? "lost" : "") + " has-tip"
                      }
                      style={{ height: won ? "100%" : lost ? "38%" : "18%" }}
                      aria-label={`Jornada ${j.round} contra ${j.opponent}${
                        hasScore ? `, ${j.scoreFor}-${j.scoreAgainst}` : ""
                      }`}
                    >
                      <span className="tip" role="presentation">
                        <span className="tip-round">Jornada {j.round}</span>
                        <span className="tip-rival">{j.opponent}</span>
                        {hasScore && (
                          <span className="tip-score">
                            <b style={{ color: won ? "var(--accent)" : "var(--error)" }}>
                              {j.scoreFor}–{j.scoreAgainst}
                            </b>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: won ? "var(--accent)" : "var(--error)",
                              }}
                            >
                              {won ? "Ganada" : lost ? "Perdida" : "Empate"}
                            </span>
                          </span>
                        )}
                      </span>
                    </i>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-faint)" }}>
                Últimas {form.length} jornadas · temporada al {seasonPct}%
              </div>
            </div>
          )}
        </div>

        {/* ══ Marcador por jornada ═════════════════════════════════
            El equivalente nuestro a la barra de ventas de un panel de
            negocio: cada columna es una jornada y su altura, las pistas
            ganadas de cinco. */}
        <div className="bcard col-8">
          <div className="bcard-head">
            <span className="bcard-title">Cómo va la temporada</span>
            <span className="delta delta-flat">Pistas ganadas de 5</span>
          </div>

          {scored.length === 0 ? (
            <EmptyState
              compact
              title="Todavía sin actas"
              body="Cuando cierres la primera jornada verás aquí el marcador de cada una."
            />
          ) : (
            <>
              <div className="rounds">
                {scored.map((j) => {
                  const won = (j.scoreFor ?? 0) > (j.scoreAgainst ?? 0);
                  const h = Math.max(8, ((j.scoreFor ?? 0) / maxCourts) * 100);
                  return (
                    <Link
                      key={j.id}
                      href={`/jornada/${j.id}`}
                      className="round-col has-tip"
                      aria-label={`Jornada ${j.round} contra ${j.opponent}, ${
                        won ? "ganada" : "perdida"
                      } ${j.scoreFor}-${j.scoreAgainst}`}
                    >
                      <span
                        className={"round-bar" + (won ? "" : " is-loss")}
                        style={{ height: "100%" }}
                      >
                        <span style={{ height: `${h}%` }} />
                      </span>
                      <span className="round-num">{j.round}</span>

                      {/* El cartelito: jornada, rival y el marcador entero. */}
                      <span className="tip" role="presentation">
                        <span className="tip-round">
                          Jornada {j.round} · {j.isHome ? "En casa" : "Fuera"}
                        </span>
                        <span className="tip-rival">{j.opponent}</span>
                        <span className="tip-score">
                          <b style={{ color: won ? "var(--accent)" : "var(--error)" }}>
                            {j.scoreFor}–{j.scoreAgainst}
                          </b>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: won ? "var(--accent)" : "var(--error)",
                            }}
                          >
                            {won ? "Ganada" : "Perdida"}
                          </span>
                        </span>
                        <span className="tip-meta">{formatDate(j.date)}</span>
                      </span>
                    </Link>
                  );
                })}
                {m && (
                  <span className="round-col is-next has-tip">
                    <span className="round-bar is-next" style={{ height: "100%" }} />
                    <span className="round-num">{m.round}</span>
                    <span className="tip" role="presentation">
                      <span className="tip-round">
                        Jornada {m.round} · {m.isHome ? "En casa" : "Fuera"}
                      </span>
                      <span className="tip-rival">{m.opponent}</span>
                      <span className="tip-meta" style={{ marginTop: 8 }}>
                        Por jugar · {formatDate(m.date)}
                      </span>
                    </span>
                  </span>
                )}
              </div>
              <div
                className="bcard-foot"
                style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5 }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <i
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: "var(--accent)",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)" }}>Ganadas {wins}</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <i
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: "color-mix(in srgb, var(--error) 70%, transparent)",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)" }}>Perdidas {losses}</span>
                </span>
                <span style={{ color: "var(--text-faint)" }}>
                  {courtsFor} pistas a favor, {courtsAgainst} en contra
                </span>
              </div>
            </>
          )}
        </div>

        {/* ══ Disponibilidad del equipo ════════════════════════════ */}
        <div className="bcard col-4">
          <div className="bcard-head">
            <span className="tile-round tile-round-accent">
              <IconCheck size={17} />
            </span>
            <span className="bcard-title">Disponibilidad</span>
          </div>
          <div className="kpi-num">
            {pct}
            <span className="unit">%</span>
          </div>
          <div className="kpi-sub">
            {availableCount} de {active.length} para la próxima jornada
          </div>
          <div style={{ marginTop: 14 }}>
            <div
              className="progress"
              style={{ height: 8 }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                style={{
                  width: `${pct}%`,
                  background: pct < 50 ? "var(--warning)" : "var(--accent)",
                }}
              />
            </div>
          </div>
          <div
            className="bcard-foot"
            style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <span className="tile-round" style={{ width: 32, height: 32 }}>
              <IconUsers size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
              <span style={{ display: "block", fontWeight: 700 }}>
                {players.length} en plantilla
              </span>
              <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
                {players.length - active.length === 0
                  ? "Toda activa"
                  : `${players.length - active.length} de baja`}
              </span>
            </span>
            <Link href="/equipo" className="link-action">
              Ver <IconChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* ══ Calendario ═══════════════════════════════════════════
            En rejilla de mes: se ve de un vistazo cuándo toca, contra quién
            y si hay que desplazarse (casa o avión). */}
        <div className="bcard col-7">
          <SeasonCalendar matchdays={matchdays} seasonId={season.id} />
        </div>

        {/* ══ Plantilla por puntos ═════════════════════════════════
            El orden por puntos ES el orden de la alineación, así que verlo
            de un vistazo es trabajo, no adorno. */}
        <div className="bcard col-5">
          <div className="bcard-head">
            <span className="bcard-title">Plantilla por puntos</span>
            <span className="delta delta-flat">Media {avgPts}</span>
          </div>

          {topPlayers.length === 0 ? (
            <EmptyState
              compact
              title="Sin jugadores todavía"
              body="Añade tu plantilla para verla ordenada por puntos."
              action={
                <BtnLink href="/equipo" variant="accent" size="sm">
                  Añadir jugadores
                </BtnLink>
              }
            />
          ) : (
            <>
              {topPlayers.map((p, i) => (
                <div key={p.id} className="rank-row">
                  <span className="rank-pos">{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="rank-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar
                        initials={p.name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
                        src={p.photoUrl}
                        size={22}
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="rank-track">
                      <span style={{ width: `${Math.round((p.pts / topMax) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="rank-val">{p.pts}</span>
                </div>
              ))}
              {active.length > topPlayers.length && (
                <div className="bcard-foot">
                  <Link href="/equipo" className="link-action">
                    Ver los {active.length} <IconChevronRight size={14} />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* ══ Mi disponibilidad ════════════════════════════════════ */}
        <div className="bcard col-5">
          <div className="bcard-head">
            <span className="bcard-title">¿Puedes jugar la próxima jornada?</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(
              [
                { key: "yes", label: "Sí, cuenta conmigo", c: "var(--accent)", bg: "var(--accent-10)" },
                { key: "no", label: "No puedo", c: "var(--error)", bg: "var(--error-soft)" },
              ] as const
            ).map((o) => {
              const on = avail === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAvail(on ? null : o.key)}
                  style={{
                    flex: "1 1 160px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 46,
                    padding: "0 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: on ? 700 : 500,
                    textAlign: "left",
                    background: on ? o.bg : "var(--bg-card-2)",
                    color: on ? o.c : "var(--text-muted)",
                    border: `1.5px solid ${on ? o.c : "transparent"}`,
                    transition: "all var(--dur-fast) var(--ease)",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: on ? o.c : "var(--text-faint)",
                      flex: "none",
                    }}
                  />
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className="bcard-foot">
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Modo solo lectura · no se guarda
            </span>
          </div>
        </div>

        {/* ══ Atajos ═══════════════════════════════════════════════
            Ocupa las 7 columnas que deja la disponibilidad: si fuera de 12
            la fila anterior se quedaba medio vacía. */}
        <div className="bcard col-7">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="bcard bcard-hover"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "var(--bg-card-2)",
                  boxShadow: "none",
                  gap: 11,
                }}
              >
                <span className="tile-round" style={{ width: 32, height: 32 }}>
                  <s.Icon size={15} />
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.title}
                </span>
                <IconChevronRight size={15} style={{ color: "var(--text-faint)", flex: "none" }} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
