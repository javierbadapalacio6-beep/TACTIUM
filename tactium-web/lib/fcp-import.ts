/**
 * Importar equipos de la Federación Cántabra (FCP) — port de
 * `TACTIUM/src/core/services/fcpOnboarding.ts` (buscar + volcar).
 *
 * Lee el catálogo federativo espejado en las tablas `fcp_*` (las mismas que usa
 * el explorador de /federacion) y crea equipos TACTIUM con su plantilla real y
 * sus puntos. Las escrituras pasan por el llamador (guardedWrite).
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import { createTeam } from "@/lib/queries";
import { FCP_FEDERATION_CODE } from "@/lib/federations";

const FCP_LEAGUE = "Liga Cántabra de Pádel";

export interface FcpTeamOption {
  id_equipo: number;
  equipo: string; // "CENTRAL PADEL A"
  club: string; // "CENTRAL PADEL"
  grupo: string;
  gender: string; // masculino | femenino
  category: string | null; // "1ª"…
}
export interface FcpClubGroup {
  club: string;
  teams: FcpTeamOption[];
}

function clubOf(equipo: string): string {
  let s = equipo.trim().replace(/\s+/g, " ");
  s = s.replace(/\s*[-–]\s*[^-–]+$/, "").trim() || equipo.trim();
  s = s.replace(/\s+(MASCULINO|FEMENINO)?\s*([A-F]|\d{1,2})$/i, "").trim();
  return s || equipo.trim();
}
const genderOf = (g: string | null): string =>
  (g ?? "").toUpperCase().startsWith("F") ? "femenino" : "masculino";
const categoryOf = (grupo: string | null): string | null => {
  const m = (grupo ?? "").match(/(\d+)\s*ª/);
  return m ? `${m[1]}ª` : null;
};

/** Busca clubes/equipos federativos por nombre (typeahead), agrupados por club.
 *  Solo la temporada actual (mayor id_liga) y su liga regular (sin playoff). */
export async function searchFcpClubs(query: string): Promise<FcpClubGroup[]> {
  const sb = supabaseBrowser();
  const { data: maxRow } = await sb
    .from("fcp_clasificacion")
    .select("id_liga")
    .order("id_liga", { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentLiga = (maxRow as { id_liga: number } | null)?.id_liga ?? null;
  if (currentLiga == null) return [];

  const { data: clasif, error } = await sb
    .from("fcp_clasificacion")
    .select("id_equipo, equipo, id_grupo, id_liga")
    .eq("id_liga", currentLiga);
  if (error) throw error;
  const { data: grupos } = await sb
    .from("fcp_grupos")
    .select("id_grupo, nombre, genero")
    .eq("id_liga", currentLiga);
  const gById = new Map(
    ((grupos ?? []) as { id_grupo: string; nombre: string; genero: string }[]).map(
      (g) => [g.id_grupo, g],
    ),
  );

  const seen = new Set<number>();
  const opts: FcpTeamOption[] = [];
  for (const row of (clasif ?? []) as {
    id_equipo: number | null;
    equipo: string | null;
    id_grupo: string | null;
  }[]) {
    if (row.id_equipo == null || !row.equipo || seen.has(row.id_equipo)) continue;
    if (typeof row.id_grupo === "string" && /^fase/i.test(row.id_grupo)) continue;
    seen.add(row.id_equipo);
    const g = row.id_grupo ? gById.get(row.id_grupo) : undefined;
    opts.push({
      id_equipo: row.id_equipo,
      equipo: row.equipo,
      club: clubOf(row.equipo),
      grupo: g?.nombre ?? "",
      gender: genderOf(g?.genero ?? null),
      category: categoryOf(g?.nombre ?? null),
    });
  }

  const q = query.trim().toLowerCase();
  const byClub = new Map<string, FcpTeamOption[]>();
  for (const o of opts) {
    if (q && !o.club.toLowerCase().includes(q) && !o.equipo.toLowerCase().includes(q))
      continue;
    if (!byClub.has(o.club)) byClub.set(o.club, []);
    byClub.get(o.club)!.push(o);
  }
  return Array.from(byClub.entries())
    .map(([club, teams]) => ({
      club,
      teams: teams.sort((a, b) => a.equipo.localeCompare(b.equipo)),
    }))
    .sort((a, b) => a.club.localeCompare(b.club));
}

export interface FcpImportResult {
  teamId: string;
  equipo: string;
  players: number;
}

/** Crea un equipo TACTIUM por cada equipo federativo elegido, con su vínculo y
 *  su plantilla real volcada (nombre + puntos vía RPC import_fcp_roster). */
export async function importFcpTeams(
  clubId: string | null,
  selected: FcpTeamOption[],
): Promise<FcpImportResult[]> {
  const sb = supabaseBrowser();
  const out: FcpImportResult[] = [];
  for (const t of selected) {
    const teamId = await createTeam({
      name: t.equipo,
      federation: FCP_FEDERATION_CODE,
      league: FCP_LEAGUE,
      category: t.category ?? undefined,
      gender: t.gender,
      clubId: clubId ?? undefined,
    });
    const { error: linkErr } = await sb
      .from("fcp_team_links")
      .insert({ fcp_id_equipo: t.id_equipo, team_id: teamId, club_id: clubId });
    if (linkErr) throw linkErr;
    const { data: added, error } = await sb.rpc("import_fcp_roster", {
      p_team_id: teamId,
      p_fcp_id_equipo: t.id_equipo,
    });
    if (error) throw error;
    out.push({ teamId, equipo: t.equipo, players: (added as number) ?? 0 });
  }
  return out;
}
