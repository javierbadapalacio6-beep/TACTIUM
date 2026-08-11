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
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconCalendar,
  IconChevronRight,
  IconFlag,
  IconSearch,
  IconTrophy,
  IconUpload,
  IconUserPlus,
} from "@/components/Icon";

const SHORTCUTS = [
  {
    href: "/equipo",
    title: "Escanear calendario",
    body: "Sube la imagen del calendario de tu liga",
    Icon: IconUpload,
  },
  {
    href: "/torneos",
    title: "Explorar torneos",
    body: "Busca por zona, club o fecha · o entra con tu código",
    Icon: IconSearch,
  },
  {
    href: "/federacion",
    title: "Explorar la Federación",
    body: "Clasificaciones y jornadas de toda la liga",
    Icon: IconFlag,
  },
  {
    href: "/ajustes/invitaciones",
    title: "Invita a un capitán",
    body: "¿Conoces a otro capitán? Regálale dejar el Excel",
    Icon: IconUserPlus,
  },
];

/** dd mmm en español a partir de la fecha ISO de la base. */
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

/** "10:00:00" → "10:00". */
function formatTime(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

interface HomeData {
  season: DbSeason | null;
  matchdays: DbMatchday[];
  players: DbPlayer[];
  availability: Record<string, boolean>;
}

/** Panel del capitán / jugador de equipo, con datos reales del equipo activo. */
export function CaptainHome({ isCaptain }: { isCaptain: boolean }) {
  const { activeTeam } = useSession();
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
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="Sin equipo activo"
          body="Entra con una cuenta que pertenezca a un equipo, o crea el tuyo."
          action={
            <Link href="/empezar" className="btn btn-accent" style={{ padding: "13px 22px" }}>
              Crear equipo
            </Link>
          }
        />
      </Card>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="No se pudo cargar el inicio"
          body={error}
        />
      </Card>
    );
  }

  const season = data?.season ?? null;
  const matchdays = data?.matchdays ?? [];
  const players = data?.players ?? [];
  const availability = data?.availability ?? {};

  const active = players.filter((p) => p.active);
  // La disponibilidad de la jornada manda; si nadie se ha marcado, cae al flag
  // general del jugador.
  const availableCount = active.filter((p) =>
    p.id in availability ? availability[p.id] : p.available === true
  ).length;
  const pct = active.length
    ? Math.round((availableCount / active.length) * 100)
    : 0;

  const upcoming = matchdays.filter((m) => m.status !== "finished");
  const m = upcoming[0] ?? null;

  const header = (
    <div style={{ marginBottom: 24 }}>
      <Eyebrow>INICIO</Eyebrow>
      <h1 style={{ marginTop: 10, fontSize: 32 }}>{activeTeam?.name}</h1>
      <p
        className="mono"
        style={{
          margin: "8px 0 0",
          fontSize: 11.5,
          letterSpacing: "0.14em",
          color: "var(--text-faint)",
        }}
      >
        {[activeTeam?.category, activeTeam?.gender, season?.name]
          .filter(Boolean)
          .join(" · ")
          .toUpperCase()}
      </p>
    </div>
  );

  // Sin temporada no hay nada que planificar.
  if (!season) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {header}
        <Card>
          <EmptyState
            icon={<IconCalendar size={34} />}
            title="Aún no hay jornadas"
            body="Crea una temporada activa desde la pestaña Temporadas."
            action={
              <Link href="/temporadas" className="btn btn-accent" style={{ padding: "13px 22px" }}>
                Crear temporada
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {header}

      {m ? (
        <div className="tw-home-grid">
          {/* ── Jornada pendiente ────────────────────────────────── */}
          <Card style={{ padding: 26 }}>
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
                <Eyebrow>JORNADA PENDIENTE</Eyebrow>
                <h2 style={{ margin: "12px 0 0", fontSize: 30, lineHeight: 1.04 }}>
                  Jornada {m.round} · vs {m.opponent}
                </h2>
                <div
                  className="mono"
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    color: "var(--text-muted)",
                  }}
                >
                  {formatDate(m.date)}
                  {formatTime(m.time) ? ` · ${formatTime(m.time)}` : ""} ·{" "}
                  <span style={{ color: "var(--accent)" }}>
                    {m.isHome ? "LOCAL" : "VISITANTE"}
                  </span>
                  {m.location ? ` · ${m.location}` : ""}
                </div>
              </div>
              <span className="chip chip-warning" style={{ flex: "none" }}>
                {m.status === "in_progress" ? "En juego" : "Pendiente"}
              </span>
            </div>

            <div style={{ height: 1, background: "var(--hair)", margin: "22px 0" }} />

            <div className="tw-home-stats">
              <div>
                <div className="mono tw-stat-label">DISPONIBLES</div>
                <div className="mono tw-stat-value">
                  {availableCount}/{active.length}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--hair-strong)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "var(--accent)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mono tw-stat-label">PLANTILLA</div>
                <div className="mono tw-stat-value">{players.length}</div>
                <div
                  className="mono"
                  style={{
                    marginTop: 10,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "var(--text-faint)",
                  }}
                >
                  {players.length - active.length} BAJAS
                </div>
              </div>
              <div>
                <div className="mono tw-stat-label">TEMPORADA</div>
                <div className="mono tw-stat-value" style={{ fontSize: 20 }}>
                  J·{m.round}
                  {season.totalMatchdays ? `/${season.totalMatchdays}` : ""}
                </div>
                <div
                  style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)" }}
                >
                  {matchdays.filter((x) => x.status === "finished").length} jugadas
                </div>
              </div>
            </div>

            {isCaptain && (
              <div
                style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}
              >
                <Link
                  href={`/jornada/${m.id}/alineacion`}
                  className="btn btn-accent"
                  style={{ padding: "13px 22px", fontSize: 14 }}
                >
                  Crear alineación
                </Link>
                <Link
                  href={`/jornada/${m.id}`}
                  className="btn btn-ghost"
                  style={{ padding: "13px 20px", fontSize: 14 }}
                >
                  Abrir jornada
                </Link>
              </div>
            )}
          </Card>

          {/* ── Mi disponibilidad ────────────────────────────────── */}
          <Card style={{ padding: 26 }}>
            <Eyebrow>MI DISPONIBILIDAD</Eyebrow>
            <p
              style={{
                margin: "14px 0 20px",
                fontSize: 13.5,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              Marca si puedes jugar la próxima jornada
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(
                [
                  { key: "yes", label: "Disponible", c: "var(--accent)", bg: "var(--accent-10)" },
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
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "16px 18px",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontFamily: "'Satoshi', sans-serif",
                      fontSize: 14.5,
                      fontWeight: on ? 700 : 500,
                      textAlign: "left",
                      background: on ? o.bg : "transparent",
                      color: on ? o.c : "var(--text-muted)",
                      border: `1.5px solid ${on ? o.c : "var(--hair-strong)"}`,
                      transition: "all var(--dur-fast) var(--ease)",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            <p
              className="mono"
              style={{
                marginTop: 16,
                fontSize: 9.5,
                letterSpacing: "0.14em",
                color: "var(--text-faint)",
              }}
            >
              MODO SOLO LECTURA · NO SE GUARDA
            </p>
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<IconTrophy size={34} />}
            title="No hay más jornadas programadas"
            body="Has disputado todas las jornadas del calendario."
            action={
              <Link
                href={`/temporadas/${season.id}`}
                className="btn btn-ghost"
                style={{ padding: "12px 20px" }}
              >
                Ver temporada
              </Link>
            }
          />
        </Card>
      )}

      {/* ── Atajos ───────────────────────────────────────────────── */}
      <section style={{ marginTop: 28 }}>
        <Eyebrow style={{ marginBottom: 12 }}>ATAJOS</Eyebrow>
        <div className="tw-shortcuts">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} style={{ color: "inherit" }}>
              <Card style={{ padding: 20, height: "100%" }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--accent-10)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <s.Icon size={17} />
                </span>
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 14.5,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    textWrap: "pretty",
                  }}
                >
                  {s.body}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Próximas jornadas ────────────────────────────────────── */}
      {upcoming.length > 1 && (
        <section style={{ marginTop: 28 }}>
          <Eyebrow style={{ marginBottom: 12 }}>PRÓXIMAS JORNADAS</Eyebrow>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {upcoming.slice(1, 6).map((j, i, arr) => (
              <Link
                key={j.id}
                href={`/jornada/${j.id}`}
                className="tw-md-row"
                style={{
                  borderBottom:
                    i === arr.length - 1 ? "none" : "1px solid var(--hair)",
                  color: "inherit",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    color: "var(--text-faint)",
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
                  {formatDate(j.date)}
                  {formatTime(j.time) ? ` · ${formatTime(j.time)}` : ""}
                </span>
                <span
                  className={"chip " + (j.isHome ? "" : "chip-mute")}
                  style={{ justifySelf: "start" }}
                >
                  {j.isHome ? "Local" : "Visitante"}
                </span>
                <span style={{ color: "var(--text-faint)", display: "flex" }}>
                  <IconChevronRight size={16} />
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
