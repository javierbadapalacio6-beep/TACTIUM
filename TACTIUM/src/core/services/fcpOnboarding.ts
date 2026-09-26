// Onboarding de club federado (Federación Cántabra · FCantP).
// Lee el catálogo federativo espejado en las tablas fcp_* (que puebla el agente
// externo) y crea equipos TACTIUM con su plantilla real y sus vínculos.
// Ver TACTIUM-plan-federacion-cantabra.html (F1) y [[tactium_fcp_federation_integration]].
import { supabase } from '@core/supabase/client';
import { createTeam, updateTeam } from './teams';
import { importFcpSeason } from './fcpSeason';
import { fetchCurrentLiga } from './fcpBrowse';
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
// equipo del final: letra (CUALQUIERA, no solo A-F: un club grande llega a la G,
// la H o la I y esos equipos se quedaban fuera de su propio club), número, o
// número romano. Opcionalmente precedido de MASCULINO/FEMENINO.
function clubOf(equipo: string): string {
  let s = equipo.trim().replace(/\s+/g, ' ');
  // 1) Patrocinador tras guion: "CENTRAL PADEL B - ESTELA".
  s = s.replace(/\s*[-–]\s*[^-–]+$/, '').trim() || s;
  // 2) Patrocinador tras "Gº"/"GRUPO" (sin guion): la Federación lo escribe de
  //    las dos maneras — "A.D.R.M. A  Gº PATATAS REGATO PUENTE".
  s = s.replace(/\s+(G[º°]\.?|GRUPO)\s+.+$/i, '').trim() || s;
  // 3) Restos de separador al final.
  s = s.replace(/[\s\-–]+$/, '').trim() || equipo.trim();
  // 4) Sufijo de equipo.
  s = s
    .replace(/\s+(MASCULINO|FEMENINO)?\s*([A-ZÑ]|\d{1,2}|I{2,3}|IV|VI{0,3}|IX|XI{0,2})$/i, '')
    .trim();
  return s || equipo.trim();
}

// Filas de la clasificación que NO son equipos (huecos del cuadro).
const NON_TEAM_ROW = /^(exento|eliminatoria|bye|descansa|vacante|fase\b)/i;

// Palabras que NO identifican a un club por sí solas: si dos nombres solo
// comparten esto, no son el mismo club.
const GENERIC_CLUB_WORDS = new Set([
  'PADEL', 'CLUB', 'CP', 'CD', 'AD', 'CDE', 'ESCUELA', 'INDOOR', 'SPORT',
  'SPORTS', 'DEPORTIVO', 'POLIDEPORTIVO', 'CENTRO', 'COMPLEJO', 'DE', 'LA',
  'EL', 'LOS', 'LAS', 'DEL', 'TEAM',
]);

const clubTokens = (name: string): string[] => {
  const all = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  // Quita la forma jurídica inicial ("C.D.", "C.P.", "S.T.C."): son iniciales
  // sueltas y no distinguen un club de otro, así "C.D. LA PLAYUCA ASTILLERO A"
  // y "LA PLAYUCA ASTILLERO C" caen en el mismo. Si TODO el nombre son
  // iniciales ("A.D.R.M."), ahí sí son su identidad y se quedan.
  let i = 0;
  while (i < all.length && all[i].length === 1) i++;
  return i < all.length ? all.slice(i) : all;
};

/** Prefijo común de dos nombres de club, si de verdad los identifica: al menos
 *  2 palabras, y alguna de 3+ letras que no sea genérica. Lo de las 3+ letras
 *  no es capricho: media Cantabria empieza por "C.D." / "C.D.E." / "C.P.", y
 *  sin ese filtro C.D. SALAS, C.D. LA PLAYUCA y C.D. PADEL SANTANDER acababan
 *  en el mismo saco (comprobado contra los datos reales de la FCP). */
function commonClubPrefix(a: string[], b: string[]): string[] | null {
  const pre: string[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    pre.push(a[i]);
  }
  if (pre.length < 2) return null;
  if (!pre.some((w) => w.length >= 3 && !GENERIC_CLUB_WORDS.has(w))) return null;
  return pre;
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
  // Liga actual = la que se está jugando, NO la más nueva que exista.
  //
  // Antes se cogía la de mayor id en la clasificación, y eso se rompe en cuanto
  // la Federación abre las inscripciones de la temporada siguiente: esa liga
  // nace con sus equipos meses antes de tener un solo partido, así que un club
  // que importase a mitad de temporada se habría traído los equipos del año
  // que viene, con sus letras y categorías nuevas. Ver `fetchCurrentLiga`.
  const currentLiga = await fetchCurrentLiga();
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
    // "EXENTO", "Eliminatoria"… son huecos del cuadro, no equipos.
    if (NON_TEAM_ROW.test(row.equipo.trim())) continue;
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

  // Un mismo club aparece en la Federación con nombres distintos ("ES MAS
  // PADEL", "ES MAS PADEL SANTANDER", "ES MAS PADEL CLUB") y así sus equipos
  // salían en grupos separados y no se podían importar de una vez. Fundimos los
  // nombres que comparten un prefijo que de verdad los identifica.
  const names = [...new Set(opts.map((o) => o.club))];
  const tokensOf = new Map(names.map((n) => [n, clubTokens(n)]));
  // Nombre canónico de cada uno (arranca en sí mismo y se va acortando).
  const canon = new Map(names.map((n) => [n, tokensOf.get(n)!]));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const pre = commonClubPrefix(canon.get(names[i])!, canon.get(names[j])!);
      if (!pre) continue;
      // Los dos (y cualquiera que ya apuntara a ellos) pasan al prefijo común.
      const a = canon.get(names[i])!.join(' ');
      const b = canon.get(names[j])!.join(' ');
      for (const n of names) {
        const cur = canon.get(n)!.join(' ');
        if (cur === a || cur === b) canon.set(n, pre);
      }
    }
  }
  const labelOf = new Map<string, string>();
  for (const n of names) {
    const key = canon.get(n)!.join(' ');
    // Etiqueta = el nombre real más corto de los que se han fundido (así se ve
    // "ES MAS PADEL" y no una reconstrucción en mayúsculas sin acentos).
    const prev = labelOf.get(key);
    if (!prev || n.length < prev.length) labelOf.set(key, n);
  }

  const q = query.trim().toLowerCase();
  const byClub = new Map<string, FcpTeamOption[]>();
  for (const o of opts) {
    const key = canon.get(o.club)!.join(' ');
    const label = labelOf.get(key) ?? o.club;
    if (
      q &&
      !label.toLowerCase().includes(q) &&
      !o.club.toLowerCase().includes(q) &&
      !o.equipo.toLowerCase().includes(q)
    )
      continue;
    if (!byClub.has(label)) byClub.set(label, []);
    byClub.get(label)!.push(o);
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

/** Equipo del club (o independiente) que AÚN NO está vinculado a la Federación:
 *  candidato a ser "sustituido" por un equipo federado al importar, en vez de
 *  duplicarlo. */
export interface UnlinkedTeam {
  id: string;
  name: string;
  gender: string | null;
  category: string | null;
  group: string | null;
}

/** Equipos del usuario (del club, o independientes si clubId=null) que todavía
 *  NO tienen vínculo con la Federación. Se usan para ofrecer "sustituir" al
 *  importar y no duplicar lo creado a mano. */
export async function fetchUnlinkedClubTeams(
  clubId: string | null,
): Promise<UnlinkedTeam[]> {
  let q = rawFrom('teams').select('id, name, gender, category, group_name, club_id');
  q = clubId ? q.eq('club_id', clubId) : q.is('club_id', null);
  const { data: teams, error } = await q;
  if (error) throw new Error(error.message);
  const list = (teams ?? []) as {
    id: string;
    name: string;
    gender: string | null;
    category: string | null;
    group_name: string | null;
  }[];
  if (!list.length) return [];
  const { data: links } = await rawFrom('fcp_team_links')
    .select('team_id')
    .in('team_id', list.map((t) => t.id));
  const linked = new Set(((links ?? []) as { team_id: string }[]).map((l) => l.team_id));
  return list
    .filter((t) => !linked.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      gender: t.gender,
      category: t.category,
      group: t.group_name,
    }));
}

/** ¿El club (o el usuario independiente) tiene ALGÚN equipo REALMENTE vinculado
 *  a la Federación? Se mira por `fcp_team_links`, NO por el campo `federation`:
 *  un equipo creado a mano en un club federado hereda federation='FCantP' pero
 *  no está importado, y no debe contar como "ya importado". */
export async function hasFcpLinkedTeams(clubId: string | null): Promise<boolean> {
  let q = rawFrom('fcp_team_links').select('team_id');
  q = clubId ? q.eq('club_id', clubId) : q.is('club_id', null);
  const { data } = await q;
  return ((data ?? []) as unknown[]).length > 0;
}

/** Crea (o REUTILIZA) un equipo TACTIUM por cada equipo federativo elegido, con
 * su vínculo y su plantilla real volcada (nombre + puntos).
 *
 * `reuse` mapea `fcp_id_equipo → id de un equipo YA creado a mano` que el usuario
 * ha decidido sustituir: en vez de crear otro, se vincula ese equipo, se
 * actualizan sus datos a los oficiales y se le vuelca la plantilla. Además hay
 * idempotencia: si un equipo federado YA está vinculado, se reutiliza (no
 * duplica al reimportar). */
/**
 * Modo de importación:
 *  · 'owned'  → equipos DEL club: `club_id`, plantilla + calendario. Gestión
 *               completa y consumen cuota del plan.
 *  · 'venue'  → equipos INVITADOS: juegan en sus pistas pero no son suyos.
 *               Se guarda `venue_club_id` (permiso solo de horario), se vuelca
 *               el CALENDARIO pero NO la plantilla — son jugadores de otro
 *               club y sus datos no pintan nada en la cuenta de este.
 */
export type FcpImportMode = 'owned' | 'venue';

/**
 * Equipo YA vinculado a este id federado que sea MÍO en el sentido que toca:
 * del club que importa, invitado de su sede, o el equipo suelto del capitán.
 * Devuelve null si no hay ninguno. La RLS ya limita lo que se puede ver, esto
 * además evita reutilizar el equipo de otro club.
 */
async function findMyLinkedTeam(
  fcpIdEquipo: number,
  clubId: string | null,
  guest: boolean,
): Promise<string | null> {
  const { data: links } = await rawFrom('fcp_team_links')
    .select('team_id')
    .eq('fcp_id_equipo', fcpIdEquipo)
    .limit(200);
  const ids = ((links ?? []) as { team_id: string | null }[])
    .map((l) => l.team_id)
    .filter((x): x is string => !!x);
  if (ids.length === 0) return null;

  const { data: teams } = await rawFrom('teams')
    .select('id, club_id, venue_club_id')
    .in('id', ids);
  const rows = (teams ?? []) as {
    id: string;
    club_id: string | null;
    venue_club_id: string | null;
  }[];

  const mine = rows.find((t) => {
    if (guest) return t.venue_club_id === clubId;
    if (clubId) return t.club_id === clubId;
    return t.club_id === null && t.venue_club_id === null;
  });
  return mine?.id ?? null;
}

export async function importFcpTeams(
  clubId: string | null,
  selected: FcpTeamOption[],
  reuse: Record<number, string> = {},
  mode: FcpImportMode = 'owned',
): Promise<FcpImportResult[]> {
  const out: FcpImportResult[] = [];
  const guest = mode === 'venue';
  for (const t of selected) {
    const canonical = {
      name: t.equipo,
      federation: FCP_FEDERATION_CODE,
      league: FCP_LEAGUE,
      category: t.category ?? null,
      gender: t.gender,
    };

    // 1) ¿YO ya tengo un equipo vinculado a este id_equipo federado? → reutilízalo
    //    (idempotencia: reimportar no duplica). Refresca sus datos oficiales.
    //    OJO: el mismo equipo federado lo pueden importar VARIOS clubes, así que
    //    la búsqueda no puede ser global — devolvía varias filas (reventaba con
    //    «cannot coerce the result to a single JSON object») y, peor, podía
    //    devolver el equipo de otro club y acabar editándoselo.
    const mineTeamId = await findMyLinkedTeam(t.id_equipo, clubId, guest);

    let teamId: string;
    if (mineTeamId) {
      teamId = mineTeamId;
      await updateTeam(teamId, canonical);
      if (guest) await rawFrom('teams').update({ venue_club_id: clubId }).eq('id', teamId);
    } else if (guest) {
      // Invitado: sin club_id (no consume cuota) y con la sede apuntada.
      const team = await createTeam({
        name: t.equipo,
        federation: FCP_FEDERATION_CODE,
        league: FCP_LEAGUE,
        category: t.category ?? undefined,
        gender: t.gender,
      });
      teamId = team.id;
      await rawFrom('teams').update({ venue_club_id: clubId }).eq('id', teamId);
      await rawFrom('fcp_team_links').insert({
        fcp_id_equipo: t.id_equipo,
        team_id: teamId,
        club_id: null,
      });
    } else if (reuse[t.id_equipo]) {
      // 2) El usuario decidió sustituir un equipo suyo creado a mano.
      teamId = reuse[t.id_equipo];
      await updateTeam(teamId, { ...canonical, club_id: clubId ?? null });
      // Un equipo tiene UN vínculo. Si ya lo tenía (p. ej. «Preparar
      // temporada» lo apuntó a la inscripción del año que viene), sustituir
      // por el id de la liga en curso dejaba DOS filas y `getFcpIdEquipo`
      // (maybeSingle) fallaba: la clasificación desaparecía.
      await rawFrom('fcp_team_links').delete().eq('team_id', teamId);
      await rawFrom('fcp_team_links').insert({
        fcp_id_equipo: t.id_equipo,
        team_id: teamId,
        club_id: clubId,
      });
    } else {
      // 3) Sin coincidencia: crea uno nuevo.
      const team = await createTeam({
        name: t.equipo,
        federation: FCP_FEDERATION_CODE,
        league: FCP_LEAGUE,
        category: t.category ?? undefined,
        gender: t.gender,
        clubId: clubId ?? undefined,
      });
      teamId = team.id;
      await rawFrom('fcp_team_links').insert({
        fcp_id_equipo: t.id_equipo,
        team_id: teamId,
        club_id: clubId,
      });
    }

    // La plantilla SOLO para equipos propios: en un invitado estaríamos
    // metiendo los datos de jugadores de otro club en esta cuenta.
    let added: unknown = 0;
    if (!guest) {
      const res = await rawRpc('import_fcp_roster', {
        p_team_id: teamId,
        p_fcp_id_equipo: t.id_equipo,
      });
      if (res.error) throw new Error(res.error.message);
      added = res.data;
    }
    // Vuelca también la temporada (calendario + resultados). No bloquea el
    // onboarding si falla; siempre se puede rehacer desde "🏆 Mi grupo".
    try {
      await importFcpSeason(teamId, t.id_equipo, FCP_LEAGUE);
    } catch {
      /* no bloqueante */
    }
    out.push({ teamId, equipo: t.equipo, players: (added as number) ?? 0 });
  }
  return out;
}

/** Re-sincroniza la plantilla de un equipo ya vinculado: añade solo los
 * jugadores federativos que aún no estén (no duplica ni borra). */
export async function resyncFcpRoster(teamId: string): Promise<number> {
  const { data: links, error } = await rawFrom('fcp_team_links')
    .select('fcp_id_equipo')
    .eq('team_id', teamId)
    .limit(1);
  if (error) throw new Error(error.message);
  const link = ((links ?? []) as { fcp_id_equipo: number }[])[0];
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
    .limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}
