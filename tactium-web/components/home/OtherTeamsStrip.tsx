"use client";

import {
  fetchActiveSeason,
  fetchMatchdays,
  fetchMyMatchdayAvailability,
  type AvailStatus,
  type DbMatchday,
} from "@/lib/queries";
import { useSession, type TeamRef } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Chip, SectionHead } from "@/components/ui";
import { Crest } from "@/components/Crest";
import { IconChevronRight } from "@/components/Icon";

/**
 * «Tus otros equipos»: con dos o más equipos, una fila deslizable con la
 * próxima jornada de cada uno de los demás (máx. 5). Tocar una tarjeta cambia
 * el equipo activo, y el Inicio entero pasa a ese equipo. Igual que la app:
 * los equipos sin jornada próxima no tienen tarjeta y, si ninguno la tiene,
 * la fila no se pinta.
 */

interface TeamNext {
  team: TeamRef;
  matchday: DbMatchday;
  /** null si no eres jugador de ese equipo (no se pinta la pastilla). */
  mine: { status: AvailStatus | null } | null;
}

const MAX_TEAMS = 5;

/** La próxima jornada sin cerrar, como la app: la futura (o sin fecha) más
 *  cercana; si no hay, la pasada más reciente que siga abierta. */
function pickNext(mds: DbMatchday[]): DbMatchday | null {
  const open = mds.filter((m) => m.status !== "finished");
  if (open.length === 0) return null;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const future = open
    .filter((m) => !m.date || m.date >= iso)
    .sort((a, b) =>
      a.date && b.date ? a.date.localeCompare(b.date) || a.round - b.round : a.date ? -1 : b.date ? 1 : a.round - b.round
    );
  if (future[0]) return future[0];
  return (
    open
      .filter((m) => !!m.date && m.date < iso)
      .sort((a, b) => b.date!.localeCompare(a.date!) || b.round - a.round)[0] ?? null
  );
}

async function loadTeamNext(team: TeamRef): Promise<TeamNext | null> {
  try {
    const season = await fetchActiveSeason(team.id);
    if (!season) return null;
    const md = pickNext(await fetchMatchdays(season.id));
    if (!md) return null;
    const mine = await fetchMyMatchdayAvailability(md.id).catch(() => null);
    return { team, matchday: md, mine: mine ? { status: mine.status } : null };
  } catch {
    // Un equipo que no carga no tumba la fila: simplemente no sale.
    return null;
  }
}

/** «J05 · sáb 3 oct · 18:00». */
function whenLine(m: DbMatchday): string {
  let day: string | null = null;
  if (m.date) {
    const d = new Date(m.date + "T00:00:00");
    day = Number.isNaN(d.getTime())
      ? m.date
      : d
          .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
          .replace(/\./g, "")
          .replace(",", "");
  }
  return [
    `J${String(m.round).padStart(2, "0")}`,
    day ?? "Fecha por confirmar",
    m.time ? m.time.slice(0, 5) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const PILL: Record<"yes" | "maybe" | "no" | "none", { tone: "accent" | "warning" | "error" | "mute"; label: string }> = {
  yes: { tone: "accent", label: "Voy" },
  maybe: { tone: "warning", label: "Duda" },
  no: { tone: "error", label: "No" },
  none: { tone: "mute", label: "Sin contestar" },
};

export function OtherTeamsStrip() {
  const { teams, activeTeam, setActiveTeam } = useSession();
  const others = teams.filter((t) => t.id !== activeTeam?.id).slice(0, MAX_TEAMS);
  const key = others.map((t) => t.id).join(",");

  const { data } = useAsync<TeamNext[]>(
    async () => (await Promise.all(others.map(loadTeamNext))).filter((x): x is TeamNext => !!x),
    [key],
    teams.length >= 2 && others.length > 0
  );

  const cards = data ?? [];
  if (teams.length < 2 || cards.length === 0) return null;

  return (
    <section aria-label="Tus otros equipos" style={{ marginBottom: 16 }}>
      <SectionHead title="Tus otros equipos" style={{ marginTop: 0 }} />
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(232px, 264px)",
          gap: 12,
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x proximity",
          paddingBottom: 4,
        }}
      >
        {cards.map(({ team, matchday: m, mine }) => {
          const pill = mine ? PILL[mine.status ?? "none"] : null;
          return (
            <button
              key={team.id}
              type="button"
              className="card card-hover"
              onClick={() => {
                setActiveTeam(team.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label={`Cambiar a ${team.name}: jornada ${m.round} contra ${m.opponent}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 16,
                minWidth: 0,
                textAlign: "left",
                font: "inherit",
                color: "inherit",
                cursor: "pointer",
                scrollSnapAlign: "start",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, width: "100%" }}>
                <Crest src={team.logoUrl} size={32} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>
                    Próxima jornada
                  </span>
                  <span
                    className="truncate"
                    title={team.name}
                    style={{ display: "block", fontSize: 14, fontWeight: 700 }}
                  >
                    {team.name}
                  </span>
                </span>
                <IconChevronRight size={15} style={{ color: "var(--text-faint)", flex: "none" }} />
              </span>
              <span
                className="truncate"
                title={m.opponent}
                style={{ display: "block", width: "100%", fontSize: 15, fontWeight: 700 }}
              >
                vs {m.opponent}
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                }}
              >
                <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {whenLine(m)}
                </span>
                {pill && <Chip tone={pill.tone}>{pill.label}</Chip>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
