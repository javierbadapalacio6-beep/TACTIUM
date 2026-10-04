/**
 * Lecturas y escrituras de la Liga que la web aún no tenía (la app sí):
 * balance del histórico, cerrar temporada y traer la temporada de la
 * Federación. Las escrituras pasan por `guardedWrite` desde quien las llama.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DbMatchday } from "@/lib/queries";

export interface SeasonBalance {
  w: number;
  d: number;
  l: number;
  total: number;
}

/** V-E-D de varias temporadas en una consulta. */
export async function fetchSeasonsBalance(
  seasonIds: string[],
): Promise<Record<string, SeasonBalance>> {
  const out: Record<string, SeasonBalance> = {};
  if (seasonIds.length === 0) return out;
  const { data, error } = await supabaseBrowser()
    .from("matchdays")
    .select("season_id, outcome")
    .in("season_id", seasonIds);
  if (error) throw error;
  for (const r of (data ?? []) as { season_id: string; outcome: DbMatchday["outcome"] }[]) {
    const b = (out[r.season_id] ??= { w: 0, d: 0, l: 0, total: 0 });
    b.total += 1;
    if (r.outcome === "win") b.w += 1;
    else if (r.outcome === "draw") b.d += 1;
    else if (r.outcome === "loss") b.l += 1;
  }
  return out;
}

/** Fecha de cierre de una temporada (`seasons.end_date`). */
export async function fetchSeasonEndDate(seasonId: string): Promise<string | null> {
  const { data } = await supabaseBrowser()
    .from("seasons")
    .select("end_date")
    .eq("id", seasonId)
    .maybeSingle();
  return (data as { end_date: string | null } | null)?.end_date ?? null;
}

/** Cierra (archiva) la temporada: igual que `closeSeason` de la app. */
export async function closeSeason(seasonId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabaseBrowser()
    .from("seasons")
    .update({ active: false, end_date: today })
    .eq("id", seasonId);
  if (error) throw error;
}

/** Vuelca la temporada de la Federación (calendario y rivales) en el equipo.
 *  Misma RPC que «Traer de la Federación» en la app. */
export async function importFcpSeason(
  teamId: string,
  fcpIdEquipo: number,
): Promise<{ seasonId: string; created: number; updated: number; newSeason: boolean }> {
  const { data, error } = await supabaseBrowser().rpc("import_fcp_season", {
    p_team_id: teamId,
    p_fcp_id_equipo: fcpIdEquipo,
    p_season_name: "Liga Cántabra",
  });
  if (error) throw error;
  const r = (data ?? {}) as {
    season_id?: string;
    created?: number;
    updated?: number;
    new_season?: boolean;
  };
  return {
    seasonId: r.season_id ?? "",
    created: r.created ?? 0,
    updated: r.updated ?? 0,
    newSeason: !!r.new_season,
  };
}

/* ── Formato ─────────────────────────────────────────────────────── */

/** «sáb 10 oct» (o «10 oct» sin día de la semana). */
export function fmtDay(iso: string | null | undefined, withDow = true): string {
  if (!iso) return "";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", {
    ...(withDow ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
  });
}

export function scoreText(m: Pick<DbMatchday, "scoreFor" | "scoreAgainst" | "outcome">): string | null {
  if (m.scoreFor != null && m.scoreAgainst != null) return `${m.scoreFor}–${m.scoreAgainst}`;
  if (m.outcome === "win") return "V";
  if (m.outcome === "draw") return "E";
  if (m.outcome === "loss") return "D";
  return null;
}

export function outcomeVar(outcome: DbMatchday["outcome"]): string {
  return outcome === "win"
    ? "var(--accent)"
    : outcome === "loss"
      ? "var(--error)"
      : outcome === "draw"
        ? "var(--warning)"
        : "var(--text-muted)";
}

export const PHASE_EYEBROW: Record<"liga" | "playoff" | "mixto", string> = {
  liga: "Liga",
  playoff: "Playoff",
  mixto: "Liga + playoff",
};

/** ¿Jornada aún por jugar? (sin resultado y con fecha futura o sin fecha). */
export function isUpcoming(m: DbMatchday, now = new Date()): boolean {
  if (m.outcome !== null) return false;
  if (!m.date) return true;
  const t = new Date(`${m.date}T${m.time ?? "00:00:00"}`);
  return Number.isNaN(t.getTime()) || t.getTime() > now.getTime();
}

/** La próxima por fecha entre las que quedan por jugar. */
export function pickNext(matchdays: DbMatchday[]): DbMatchday | undefined {
  return matchdays
    .filter((m) => isUpcoming(m))
    .sort((a, b) => {
      if (!a.date && !b.date) return a.round - b.round;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) || a.round - b.round;
    })[0];
}

/** Jugadas en orden cronológico. */
export function playedChrono(matchdays: DbMatchday[]): DbMatchday[] {
  return matchdays
    .filter((m) => m.outcome !== null)
    .sort((a, b) =>
      a.date && b.date && a.date !== b.date ? a.date.localeCompare(b.date) : a.round - b.round,
    );
}
