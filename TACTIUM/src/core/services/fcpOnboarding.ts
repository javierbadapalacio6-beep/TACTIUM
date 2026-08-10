// Onboarding de club federado (Federación Cántabra · FCantP).
// Lee el catálogo federativo espejado en las tablas fcp_* (que puebla el agente
// externo) y crea equipos TACTIUM con su plantilla real y sus vínculos.
// Ver TACTIUM-plan-federacion-cantabra.html (F1) y [[tactium_fcp_federation_integration]].
import { supabase } from '@core/supabase/client';
import { createTeam } from './teams';
import { importFcpSeason } from './fcpSeason';
import type { TeamGender } from '@core/data/federations';

export const FCP_FEDERATION_CODE = 'FCantP';
const FCP_LEAGUE = 'Liga Cántabra de Pádel';

// Las tablas fcp_* no están en los tipos generados → acceso sin tipar.
type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;
const rawRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export interface FcpTeamOption {
  id_equipo: number;
  id_liga: number | null; // liga/temporada a la que pertenece (para elegir la más nueva)
  equipo: string; // nombre del equipo federativo ("CENTRAL PADEL A")
  club: string; // prefijo de club derivado ("CENTRAL PADEL")
  grupo: string; // nombre del grupo federativo
  gender: TeamGender;
  category: string | null; // "1ª", "2ª"…
}
export interface FcpClubGroup {
  club: string;
  teams: FcpTeamOption[];
}

// Deriva el nombre de club quitando el patrocinador tras guion y el sufijo de
// equipo (letra A-F, opcional MASCULINO/FEMENINO, o número) del final.
function clubOf(equipo: string): string {
  let s = equipo.trim().replace(/\s+/g, ' ');
  s = s.replace(/\s*[-–]\s*[^-–]+$/, '').trim() || equipo.trim();
  s = s.replace(/\s+(MASCULINO|FEMENINO)?\s*([A-F]|\d{1,2})$/i, '').trim();
  return s || equipo.trim();
}
function genderOf(g: string | null): TeamGender {
  return (g ?? '').toUpperCase().startsWith('F') ? 'femenino' : 'masculino';
}
function categoryOf(grupo: string | null): string | null {
  const m = (grupo ?? '').match(/(\d+)\s*ª/);
  return m ? `${m[1]}ª` : null;
}

/** Busca clubes/equipos federativos por nombre (typeahead), agrupados por club.
 * Solo la temporada ACTUAL (mayor id_liga con datos) y su LIGA REGULAR: así el
 * mismo equipo no aparece repetido por cada año ni por sus fases de playoff. */
export async function searchFcpClubs(query: string): Promise<FcpClubGroup[]> {
  // Liga actual = la de mayor id con datos en la clasificación.
  const { data: maxRow } = await rawFrom('fcp_clasificacion')
    .select('id_liga')
    .order('id_liga', { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentLiga = maxRow ? (maxRow as { id_liga: number }).id_liga ?? null : null;
  if (currentLiga == null) return [];

  const { data: clasif, error } = await rawFrom('fcp_clasificacion')
    .select('id_equipo, equipo, id_grupo, id_liga')
    .eq('id_liga', currentLiga);
  if (error) throw new Error(error.message);
  const { data: grupos } = await rawFrom('fcp_grupos')
    .select('id_grupo, nombre, genero')
    .eq('id_liga', currentLiga);
  const gById = new Map(
    ((grupos ?? []) as { id_grupo: string; nombre: string; genero: string }[]).map((g) => [
      g.id_grupo,
      g,
    ]),
  );

  const seen = new Set<number>();
  const opts: FcpTeamOption[] = [];
  for (const row of (clasif ?? []) as {
    id_equipo: number | null;
    equipo: string | null;
    id_grupo: string | null;
    id_liga: number | null;
  }[]) {
    if (row.id_equipo == null || !row.equipo || seen.has(row.id_equipo)) continue;
    // Saltar grupos de playoff (fase): el equipo se importa por su liga regular.
    if (typeof row.id_grupo === 'string' && /^fase/i.test(row.id_grupo)) continue;
    seen.add(row.id_equipo);
    const g = row.id_grupo ? gById.get(row.id_grupo) : undefined;
    opts.push({
      id_equipo: row.id_equipo,
      id_liga: row.id_liga ?? null,
      equipo: row.equipo,
      club: clubOf(row.equipo),
      grupo: g?.nombre ?? '',
      gender: genderOf(g?.genero ?? null),
      category: categoryOf(g?.nombre ?? null),
    });
  }

  const q = query.trim().toLowerCase();
  const byClub = new Map<string, FcpTeamOption[]>();
  for (const o of opts) {
    if (q && !o.club.toLowerCase().includes(q) && !o.equipo.toLowerCase().includes(q)) continue;
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
 * su plantilla real volcada (nombre + puntos). */
export async function importFcpTeams(
  clubId: string | null,
  selected: FcpTeamOption[],
): Promise<FcpImportResult[]> {
  const out: FcpImportResult[] = [];
  for (const t of selected) {
    const team = await createTeam({
      name: t.equipo,
      federation: FCP_FEDERATION_CODE,
      league: FCP_LEAGUE,
      category: t.category ?? undefined,
      gender: t.gender,
      clubId: clubId ?? undefined,
    });
    await rawFrom('fcp_team_links').insert({
      fcp_id_equipo: t.id_equipo,
      team_id: team.id,
      club_id: clubId,
    });
    const { data: added, error } = await rawRpc('import_fcp_roster', {
      p_team_id: team.id,
      p_fcp_id_equipo: t.id_equipo,
    });
    if (error) throw new Error(error.message);
    // Vuelca también la temporada (calendario + resultados). No bloquea el
    // onboarding si falla; siempre se puede rehacer desde "🏆 Mi grupo".
    try {
      await importFcpSeason(team.id, t.id_equipo, FCP_LEAGUE);
    } catch {
      /* no bloqueante */
    }
    out.push({ teamId: team.id, equipo: t.equipo, players: (added as number) ?? 0 });
  }
  return out;
}

/** Re-sincroniza la plantilla de un equipo ya vinculado: añade solo los
 * jugadores federativos que aún no estén (no duplica ni borra). */
export async function resyncFcpRoster(teamId: string): Promise<number> {
  const { data: link, error } = await rawFrom('fcp_team_links')
    .select('fcp_id_equipo')
    .eq('team_id', teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!link) throw new Error('Este equipo no está vinculado a la Federación.');
  const { data: added, error: e2 } = await rawRpc('import_fcp_roster', {
    p_team_id: teamId,
    p_fcp_id_equipo: (link as { fcp_id_equipo: number }).fcp_id_equipo,
  });
  if (e2) throw new Error(e2.message);
  return (added as number) ?? 0;
}

/** ¿Un equipo TACTIUM está vinculado a la Federación Cántabra? */
export async function isFcpLinkedTeam(teamId: string): Promise<boolean> {
  const { data } = await rawFrom('fcp_team_links')
    .select('team_id')
    .eq('team_id', teamId)
    .maybeSingle();
  return !!data;
}
