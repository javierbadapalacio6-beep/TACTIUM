import { unstable_cache } from "next/cache";

import { fetchFcpStandings, type FcpStanding } from "@/lib/fcp-public";
import { supabaseAnon } from "@/lib/supabase/anon";
import type { RowTournament } from "@/components/tournaments/TournamentRow";

/**
 * Datos de la portada, leídos EN SERVIDOR con el cliente anónimo y cacheados
 * 5 minutos para todos los visitantes. Antes la banda «Explorar» hacía en el
 * navegador ~6 consultas encadenadas por visita (ligas → grupos → metas →
 * clasificación) y la portada tardaba ~2,5 s en estar completa.
 *
 * Todo lo que sale de aquí ya es público: `explore_tournaments` (RPC anon, sin
 * clubes demo) y las tablas `fcp_*` (lectura anon por RLS).
 */

const REVALIDATE = 300;
const STANDINGS_ROWS = 5;

export interface FeaturedGroup {
  group: { idGrupo: string; nombre: string; temporada: string | null };
  rows: FcpStanding[];
  live: boolean;
}

export interface SiteStats {
  closedMatchdaysSeason: number;
  activeTeamsSeason: number;
  fcpMatches: number;
}

export interface HomeData {
  tournaments: RowTournament[];
  featured: FeaturedGroup | null;
  stats: SiteStats | null;
}

async function loadTournaments(): Promise<RowTournament[]> {
  const sb = supabaseAnon();
  if (!sb) return [];
  const { data, error } = await sb.rpc("explore_tournaments", { p_search: null });
  if (error) return [];
  return (data ?? []) as RowTournament[];
}

/** Mismo criterio que tenía la banda en el navegador: un grupo de liga
 *  regular de la temporada en curso, a poder ser en juego hoy. */
async function loadFeatured(): Promise<FeaturedGroup | null> {
  const sb = supabaseAnon();
  if (!sb) return null;
  const [{ data: ligas }, { data: grupos }] = await Promise.all([
    sb.from("fcp_ligas").select("id_liga, temporada"),
    sb.from("fcp_grupos").select("id_grupo, id_liga, nombre, temporada").limit(20000),
  ]);
  if (!ligas || !grupos) return null;
  const withGroups = new Set(grupos.map((g) => g.id_liga));
  const league = [...ligas]
    .filter((l) => withGroups.has(l.id_liga))
    .sort((a, b) => String(b.temporada ?? "").localeCompare(String(a.temporada ?? "")))[0];
  if (!league) return null;

  const regular = grupos
    .filter((g) => g.id_liga === league.id_liga)
    .map((g) => ({ ...g, nombre: (g.nombre ?? g.id_grupo) as string }))
    .filter((g) => !/^fase/i.test(g.id_grupo) && !/ORO|PLATA|PLAY\s*OFF/i.test(g.nombre))
    .slice(0, 60);
  if (regular.length === 0) return null;
  const ids = regular.map((g) => g.id_grupo);

  const [{ data: cls }, { data: parts }] = await Promise.all([
    sb.from("fcp_clasificacion").select("id_grupo").in("id_grupo", ids),
    sb.from("fcp_partidos").select("id_grupo, jornada, estado, fecha").in("id_grupo", ids),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const teams = new Map<string, number>();
  for (const r of (cls ?? []) as { id_grupo: string }[]) teams.set(r.id_grupo, (teams.get(r.id_grupo) ?? 0) + 1);
  const meta = new Map<string, { live: boolean; running: boolean }>();
  for (const p of (parts ?? []) as { id_grupo: string; estado: string | null; fecha: string | null }[]) {
    const m = meta.get(p.id_grupo) ?? { live: false, running: false };
    if (p.estado === "jugado") m.running = true;
    if (p.estado !== "jugado" && (p.fecha ?? "").slice(0, 10) === today) m.live = true;
    meta.set(p.id_grupo, m);
  }
  const best = regular
    .filter((g) => (teams.get(g.id_grupo) ?? 0) >= 4)
    .sort((a, b) => {
      const ma = meta.get(a.id_grupo);
      const mb = meta.get(b.id_grupo);
      if (!!ma?.live !== !!mb?.live) return mb?.live ? 1 : -1;
      if (!!ma?.running !== !!mb?.running) return mb?.running ? 1 : -1;
      return (teams.get(b.id_grupo) ?? 0) - (teams.get(a.id_grupo) ?? 0);
    })[0] ?? regular[0];

  const rows = await fetchFcpStandings(sb, best.id_grupo).catch(() => []);
  if (rows.length === 0) return null;
  return {
    group: { idGrupo: best.id_grupo, nombre: best.nombre, temporada: best.temporada ?? null },
    rows: rows.slice(0, STANDINGS_ROWS),
    live: Boolean(meta.get(best.id_grupo)?.live),
  };
}

async function loadStats(): Promise<SiteStats | null> {
  const sb = supabaseAnon();
  if (!sb) return null;
  const { data, error } = await sb.rpc("public_site_stats");
  const row = (Array.isArray(data) ? data[0] : data) as
    | { closed_matchdays_season: number; active_teams_season: number; fcp_matches: number }
    | null;
  if (error || !row) return null;
  return {
    closedMatchdaysSeason: Number(row.closed_matchdays_season ?? 0),
    activeTeamsSeason: Number(row.active_teams_season ?? 0),
    fcpMatches: Number(row.fcp_matches ?? 0),
  };
}

export const loadHomeData = unstable_cache(
  async (): Promise<HomeData> => {
    const [tournaments, featured, stats] = await Promise.all([
      loadTournaments().catch(() => []),
      loadFeatured().catch(() => null),
      loadStats().catch(() => null),
    ]);
    return { tournaments, featured, stats };
  },
  ["marketing-home-data-v1"],
  { revalidate: REVALIDATE },
);
