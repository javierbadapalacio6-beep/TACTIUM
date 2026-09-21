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
import {
  BtnLink,
  Card,
  CardHead,
  Chip,
  IconTile,
  ListRow,
  PageHeader,
  Progress,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import {
  IconCalendar,
  IconChevronRight,
  IconFlag,
  IconSearch,
  IconTrophy,
  IconUpload,
  IconUserPlus,
  IconUsers,
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
    body: "Por zona, club o fecha, o con tu código",
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
    title: "Invitar a un capitán",
    body: "Regálale dejar el Excel",
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

  const header = (
    <PageHeader
      title={activeTeam?.name ?? "Inicio"}
      meta={[
        [activeTeam?.category, activeTeam?.gender].filter(Boolean).join(" · ") || null,
        season?.name ?? null,
      ]}
      actions={
        <>
          <BtnLink href="/equipo" icon={<IconUsers size={15} />}>
            Plantilla
          </BtnLink>
          <BtnLink href="/temporadas" variant="quiet" icon={<IconCalendar size={15} />}>
            Temporadas
          </BtnLink>
        </>
      }
    />
  );

  if (!season) {
    return (
      <div className="tw-page">
        {header}
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
      {header}

      <StatRow style={{ marginBottom: 16 }}>
        <Stat
          label="Disponibles para la próxima"
          value={availableCount}
          unit={`/ ${active.length}`}
          tone={active.length > 0 && pct >= 70 ? "accent" : active.length > 0 && pct < 50 ? "warning" : undefined}
        >
          <Progress value={pct} style={{ marginTop: 10 }} tone={pct < 50 ? "warning" : undefined} />
        </Stat>
        <Stat
          label="Plantilla"
          value={players.length}
          sub={`${players.length - active.length} ${players.length - active.length === 1 ? "baja" : "bajas"}`}
        />
        <Stat
          label="Balance"
          value={`${wins}–${losses}`}
          sub={`${played.length} de ${season.totalMatchdays ?? matchdays.length} jugadas`}
        />
        <Stat
          label="Próxima jornada"
          value={m ? `J${m.round}` : "—"}
          sub={
            m
              ? dUntil === null
                ? "Fecha por confirmar"
                : dUntil === 0
                  ? "Hoy"
                  : dUntil === 1
                    ? "Mañana"
                    : dUntil > 1
                      ? `En ${dUntil} días`
                      : "Pendiente de cerrar"
              : "Calendario completado"
          }
        />
      </StatRow>

      {m ? (
        <div className="tw-home-grid">
          {/* ── Jornada pendiente ────────────────────────────────── */}
          <Card flush>
            <CardHead title="Próxima jornada">
              <Chip tone={m.status === "in_progress" ? "warning" : "mute"}>
                {m.status === "in_progress" ? "En juego" : "Pendiente"}
              </Chip>
            </CardHead>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    Jornada {m.round} · {m.isHome ? "En casa" : "Fuera"}
                  </div>
                  <h2 style={{ fontSize: 22, marginTop: 4 }}>vs {m.opponent}</h2>
                  <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{formatDate(m.date)}</span>
                    {formatTime(m.time) && (
                      <>
                        <span style={{ color: "var(--text-faint)" }}>·</span>
                        <span className="mono">{formatTime(m.time)}</span>
                      </>
                    )}
                    {m.location && (
                      <>
                        <span style={{ color: "var(--text-faint)" }}>·</span>
                        <span>{m.location}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Disponibles</div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>
                    {availableCount}
                    <span style={{ fontSize: 14, color: "var(--text-faint)", fontWeight: 500 }}>
                      {" "}/ {active.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {isCaptain && (
              <div className="card-foot">
                <BtnLink href={`/jornada/${m.id}/alineacion`} variant="accent">
                  Crear alineación
                </BtnLink>
                <BtnLink href={`/jornada/${m.id}`}>Abrir jornada</BtnLink>
                <BtnLink href={`/jornada/${m.id}/disponibilidad`} variant="quiet">
                  Disponibilidad
                </BtnLink>
              </div>
            )}
          </Card>

          {/* ── Mi disponibilidad ────────────────────────────────── */}
          <Card flush>
            <CardHead title="Mi disponibilidad" sub="¿Puedes jugar la próxima jornada?" />
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      gap: 10,
                      minHeight: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: on ? 700 : 500,
                      textAlign: "left",
                      background: on ? o.bg : "var(--bg-card-2)",
                      color: on ? o.c : "var(--text-muted)",
                      border: `1px solid ${on ? o.c : "var(--line)"}`,
                      transition: "all var(--dur-fast) var(--ease)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: on ? o.c : "var(--text-faint)",
                      }}
                    />
                    {o.label}
                  </button>
                );
              })}
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
                Modo solo lectura · no se guarda
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<IconTrophy size={24} />}
            title="No hay más jornadas programadas"
            body="Has disputado todas las jornadas del calendario."
            action={
              <BtnLink href={`/temporadas/${season.id}`}>Ver temporada</BtnLink>
            }
          />
        </Card>
      )}

      <div className="tw-home-grid" style={{ marginTop: 16 }}>
        {/* ── Próximas jornadas ────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Calendario" count={upcoming.length}>
            <Link href={`/temporadas/${season.id}`} className="link-action">
              Ver temporada
            </Link>
          </CardHead>
          {upcoming.length <= 1 ? (
            <EmptyState compact title="No quedan más jornadas" body="El calendario está completo." />
          ) : (
            upcoming.slice(1, 6).map((j) => (
              <Link key={j.id} href={`/jornada/${j.id}`} className="tw-md-row">
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  J{j.round}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>vs {j.opponent}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {formatDate(j.date)}
                  {formatTime(j.time) ? ` · ${formatTime(j.time)}` : ""}
                </span>
                <Chip tone={j.isHome ? "accent" : "mute"} plain style={{ justifySelf: "start" }}>
                  {j.isHome ? "En casa" : "Fuera"}
                </Chip>
                <span style={{ color: "var(--text-faint)", display: "flex" }}>
                  <IconChevronRight size={16} />
                </span>
              </Link>
            ))
          )}
        </Card>

        {/* ── Atajos ───────────────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Atajos" />
          {SHORTCUTS.map((s) => (
            <ListRow
              key={s.href}
              href={s.href}
              icon={
                <IconTile>
                  <s.Icon size={16} />
                </IconTile>
              }
              title={s.title}
              sub={s.body}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
