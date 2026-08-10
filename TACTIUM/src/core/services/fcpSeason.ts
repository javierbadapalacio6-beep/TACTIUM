// Preparar NUEVA temporada de la Federación para un equipo ya vinculado.
// El equipo de TACTIUM es permanente; cada temporada se reconcilia la plantilla
// con la de la liga nueva de la FCP: se añaden los nuevos, se DESACTIVAN (nunca
// se borran) los que ya no están y se reactivan los que vuelven. La identidad
// se resuelve por nombre normalizado, con confirmación del capitán (vista
// previa). Ver [[tactium_fcp_federation_integration]] y el diff en la UI.
import { supabase } from '@core/supabase/client';
import * as SeasonsApi from './seasons';
import * as MatchdaysApi from './matchdays';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;
const rawRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

// Normaliza un nombre para comparar entre temporadas: minúsculas, sin acentos,
// espacios colapsados.
const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function fcpDisplayName(r: {
  nombre_pila?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  nombre?: string | null;
}): string {
  const n = [r.nombre_pila, r.apellido1, r.apellido2]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return n || (r.nombre ?? 'Jugador');
}

/** id_equipo federativo vinculado a un equipo TACTIUM (null si no está vinculado). */
export async function getFcpIdEquipo(teamId: string): Promise<number | null> {
  const { data } = await rawFrom('fcp_team_links')
    .select('fcp_id_equipo')
    .eq('team_id', teamId)
    .maybeSingle();
  return data ? ((data as { fcp_id_equipo: number }).fcp_id_equipo ?? null) : null;
}

/** Grupo principal (liga regular) de un id_equipo federativo. Muchos equipos
 * aparecen en 2+ grupos (liga regular + playoff ORO/PLATA), así que un
 * `maybeSingle` fallaría; elegimos el grupo con MÁS partidos, que es la liga
 * regular (donde vive el calendario y la clasificación completa). */
export async function resolveMainGroup(
  fcpIdEquipo: number,
): Promise<{ id_grupo: string; equipo: string } | null> {
  const { data } = await rawFrom('fcp_clasificacion')
    .select('id_grupo, equipo')
    .eq('id_equipo', fcpIdEquipo);
  const rows = (data ?? []) as { id_grupo: string; equipo: string }[];
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  let best = rows[0];
  let bestCount = -1;
  for (const r of rows) {
    const { count } = await rawFrom('fcp_partidos')
      .select('id_partido', { count: 'exact', head: true })
      .eq('id_grupo', r.id_grupo);
    if ((count ?? 0) > bestCount) {
      bestCount = count ?? 0;
      best = r;
    }
  }
  return best;
}

export interface FcpStandingRow {
  posicion: number | null;
  equipo: string;
  id_equipo: number | null;
  puntos: number | null;
  sets_favor: number | null;
  sets_contra: number | null;
  pj: number; // partidos jugados (derivado de fcp_partidos)
  pg: number; // partidos ganados (derivado)
  isMe: boolean;
}

/** Clasificación del grupo del equipo (todos los rivales, con id_equipo para la ficha). */
export async function fetchFcpGroupStandings(
  fcpIdEquipo: number,
): Promise<{ grupo: string | null; rows: FcpStandingRow[] }> {
  const main = await resolveMainGroup(fcpIdEquipo);
  const grupo = main?.id_grupo ?? null;
  if (!grupo) return { grupo: null, rows: [] };
  const { data } = await rawFrom('fcp_clasificacion')
    .select('posicion, equipo, id_equipo, puntos, sets_favor, sets_contra')
    .eq('id_grupo', grupo)
    .order('posicion', { ascending: true });

  // PJ/PG derivados de fcp_partidos (el scrape de la matriz los deja en 0).
  const { data: partidos } = await rawFrom('fcp_partidos')
    .select('equipo_local, equipo_visit, ganador, estado')
    .eq('id_grupo', grupo);
  const stats = new Map<string, { pj: number; pg: number }>();
  for (const p of (partidos ?? []) as {
    equipo_local: string | null;
    equipo_visit: string | null;
    ganador: string | null;
    estado: string | null;
  }[]) {
    if (p.estado !== 'jugado') continue;
    const sides: [string | null, boolean][] = [
      [p.equipo_local, true],
      [p.equipo_visit, false],
    ];
    for (const [name, isLocal] of sides) {
      if (!name) continue;
      const s = stats.get(name) ?? { pj: 0, pg: 0 };
      s.pj += 1;
      if ((p.ganador === 'local' && isLocal) || (p.ganador === 'visitante' && !isLocal)) s.pg += 1;
      stats.set(name, s);
    }
  }

  const rows: FcpStandingRow[] = (
    (data ?? []) as Omit<FcpStandingRow, 'isMe' | 'pj' | 'pg'>[]
  ).map((r) => {
    const s = stats.get(r.equipo) ?? { pj: 0, pg: 0 };
    return { ...r, pj: s.pj, pg: s.pg, isMe: r.id_equipo === fcpIdEquipo };
  });
  const { data: g } = await rawFrom('fcp_grupos').select('nombre').eq('id_grupo', grupo).maybeSingle();
  return { grupo: g ? ((g as { nombre: string }).nombre ?? null) : null, rows };
}

export interface FcpScheduleRow {
  id_partido: string;
  jornada: number | null;
  equipo_local: string;
  equipo_visit: string;
  resultado: string | null; // "3/2"
  ganador: 'local' | 'visitante' | 'empate' | null;
  estado: string | null;
  fecha: string | null; // date ISO (puede ser null)
  hora: string | null;
  lugar: string | null;
  isMeLocal: boolean;
  isMeVisit: boolean;
}

/** Calendario del grupo del equipo (todas las jornadas, marcando las tuyas). */
export async function fetchFcpGroupSchedule(
  fcpIdEquipo: number,
): Promise<{ grupo: string | null; myName: string | null; rows: FcpScheduleRow[] }> {
  const main = await resolveMainGroup(fcpIdEquipo);
  const grupo = main?.id_grupo ?? null;
  const myName = main?.equipo ?? null;
  if (!grupo) return { grupo: null, myName, rows: [] };

  const { data } = await rawFrom('fcp_partidos')
    .select('id_partido, jornada, equipo_local, equipo_visit, resultado, ganador, estado, fecha, hora, lugar')
    .eq('id_grupo', grupo)
    .order('jornada', { ascending: true });

  const mine = norm(myName);
  const rows: FcpScheduleRow[] = (
    (data ?? []) as {
      id_partido: string;
      jornada: number | null;
      equipo_local: string | null;
      equipo_visit: string | null;
      resultado: string | null;
      ganador: string | null;
      estado: string | null;
      fecha: string | null;
      hora: string | null;
      lugar: string | null;
    }[]
  ).map((r) => ({
    id_partido: r.id_partido,
    jornada: r.jornada,
    equipo_local: r.equipo_local ?? '',
    equipo_visit: r.equipo_visit ?? '',
    resultado: r.resultado,
    ganador: (r.ganador as FcpScheduleRow['ganador']) ?? null,
    estado: r.estado,
    fecha: r.fecha,
    hora: r.hora,
    lugar: r.lugar,
    isMeLocal: !!mine && norm(r.equipo_local) === mine,
    isMeVisit: !!mine && norm(r.equipo_visit) === mine,
  }));

  const { data: g } = await rawFrom('fcp_grupos').select('nombre').eq('id_grupo', grupo).maybeSingle();
  return { grupo: g ? ((g as { nombre: string }).nombre ?? null) : null, myName, rows };
}

export interface FcpActaPartido {
  partido_num: number;
  local_j1: string | null;
  local_j2: string | null;
  visit_j1: string | null;
  visit_j2: string | null;
  // Puntos por jugador. Postgres numeric → llega como string por el cliente.
  local_j1_pts: number | string | null;
  local_j2_pts: number | string | null;
  visit_j1_pts: number | string | null;
  visit_j2_pts: number | string | null;
  sets_local: number | null;
  sets_visit: number | null;
  parciales: string | null; // "6/3 - 4/6 - 6/2"
  ganador: string | null; // 'local' | 'visitante'
}

/** Acta detallada de un enfrentamiento: los N partidos con sus 2 parejas y sus
 * parciales por set. Vacío si aún no se ha scrapeado (fcp_actas). */
export async function fetchFcpActa(idPartido: string): Promise<FcpActaPartido[]> {
  const { data } = await rawFrom('fcp_actas')
    .select(
      'partido_num, local_j1, local_j2, visit_j1, visit_j2, local_j1_pts, local_j2_pts, visit_j1_pts, visit_j2_pts, sets_local, sets_visit, parciales, ganador',
    )
    .eq('id_partido', idPartido)
    .order('partido_num', { ascending: true });
  return (data ?? []) as FcpActaPartido[];
}

export interface FcpMatchdayActa {
  idPartido: string;
  isHome: boolean; // ¿mi equipo es el local del acta? (para resaltar mi pareja)
  partidos: FcpActaPartido[];
}

/** Acta de una jornada de TACTIUM: usa el `fcp_id_partido` guardado en la
 * jornada durante el volcado. Devuelve null si la jornada no es federada o no
 * tiene acta todavía. `isHome` indica si mi equipo juega de local en el acta. */
export async function fetchActaForMatchday(matchdayId: string): Promise<FcpMatchdayActa | null> {
  const { data: md } = await rawFrom('matchdays')
    .select('fcp_id_partido, is_home')
    .eq('id', matchdayId)
    .maybeSingle();
  const idPartido = md ? (md as { fcp_id_partido: string | null }).fcp_id_partido : null;
  if (!idPartido) return null;
  const partidos = await fetchFcpActa(idPartido);
  if (partidos.length === 0) return null;
  return {
    idPartido,
    isHome: !!(md as { is_home: boolean | null }).is_home,
    partidos,
  };
}

export interface FcpRivalPlayer {
  name: string;
  puntos: number;
}
/** Plantilla de un equipo rival (para la ficha). */
export async function fetchFcpRivalRoster(rivalIdEquipo: number): Promise<FcpRivalPlayer[]> {
  const { data } = await rawFrom('fcp_jugadores')
    .select('nombre_pila, apellido1, apellido2, nombre, puntos')
    .eq('id_equipo', rivalIdEquipo)
    .order('puntos', { ascending: false });
  return ((data ?? []) as {
    nombre_pila: string | null;
    apellido1: string | null;
    apellido2: string | null;
    nombre: string | null;
    puntos: number | null;
  }[]).map((r) => ({ name: fcpDisplayName(r), puntos: r.puntos ?? 0 }));
}

/** Volcado de temporada (Nivel 1): crea/usa la temporada activa y vuelca el
 * calendario del grupo (jornadas con rival, resultado, local/visitante…). */
export async function importFcpSeason(
  teamId: string,
  fcpIdEquipo: number,
  seasonName?: string,
): Promise<{ season_id: string; created: number; updated: number }> {
  const { data, error } = await rawRpc('import_fcp_season', {
    p_team_id: teamId,
    p_fcp_id_equipo: fcpIdEquipo,
    p_season_name: seasonName ?? 'Liga Cántabra',
  });
  if (error) throw new Error(error.message);
  return (data as { season_id: string; created: number; updated: number }) ?? {
    season_id: '',
    created: 0,
    updated: 0,
  };
}

/**
 * ¿Es momento de "Preparar nueva temporada"? Para no tener el botón siempre.
 * Sí cuando: no hay temporada activa (entre temporadas), la activa está vacía
 * (recién creada, aún sin jornadas) o ya terminó (todas las jornadas jugadas o
 * pasada su fecha de fin). No mientras hay una temporada EN CURSO.
 */
export async function seasonUpdateAvailable(teamId: string): Promise<boolean> {
  try {
    const s = await SeasonsApi.fetchActiveSeason(teamId);
    if (!s) return true;
    const mds = await MatchdaysApi.fetchMatchdays(s.id);
    if (mds.length === 0) return true;
    if (mds.every((m) => m.outcome != null)) return true;
    if (s.end_date && new Date(s.end_date) < new Date()) return true;
    return false;
  } catch {
    return true; // ante la duda, no ocultar la opción
  }
}

export interface NewRosterPlayer {
  fcpId: string;
  name: string;
  puntos: number;
}
export interface CurrentPlayer {
  id: string;
  name: string;
  active: boolean;
  claimed: boolean; // tiene cuenta reclamada (user_id)
}

export interface SeasonDiff {
  toAdd: NewRosterPlayer[]; // nuevos a añadir
  continuing: CurrentPlayer[]; // siguen (activos y en la lista nueva)
  toReactivate: CurrentPlayer[]; // estaban desactivados y vuelven
  leaving: CurrentPlayer[]; // ya no están → se desactivan
  manual: CurrentPlayer[]; // añadidos a mano (no FCP) → intactos
}

/** Calcula el diff entre la plantilla actual del equipo y la de la temporada
 * nueva (equipo `newFcpIdEquipo` de la liga nueva). No cambia nada. */
export async function computeSeasonDiff(
  teamId: string,
  newFcpIdEquipo: number,
): Promise<SeasonDiff> {
  const { data: rosterRaw, error } = await rawFrom('fcp_jugadores')
    .select('id_jugador, nombre, nombre_pila, apellido1, apellido2, puntos')
    .eq('id_equipo', newFcpIdEquipo);
  if (error) throw new Error(error.message);
  const newList: NewRosterPlayer[] = (rosterRaw ?? []).map(
    (r: {
      id_jugador: string;
      nombre: string | null;
      nombre_pila: string | null;
      apellido1: string | null;
      apellido2: string | null;
      puntos: number | null;
    }) => ({ fcpId: r.id_jugador, name: fcpDisplayName(r), puntos: r.puntos ?? 0 }),
  );

  const { data: playersRaw, error: pe } = await rawFrom('players')
    .select('id, name, active, user_id')
    .eq('team_id', teamId);
  if (pe) throw new Error(pe.message);
  const players = (playersRaw ?? []) as {
    id: string;
    name: string;
    active: boolean;
    user_id: string | null;
  }[];

  const { data: linksRaw } = await rawFrom('fcp_player_links')
    .select('player_id')
    .eq('team_id', teamId);
  const linkedIds = new Set(
    ((linksRaw ?? []) as { player_id: string | null }[])
      .map((l) => l.player_id)
      .filter((x): x is string => !!x),
  );

  // Empareja cada jugador nuevo con uno actual por nombre normalizado.
  const consumed = new Set<string>();
  const toAdd: NewRosterPlayer[] = [];
  for (const n of newList) {
    const cur = players.find((p) => !consumed.has(p.id) && norm(p.name) === norm(n.name));
    if (!cur) {
      toAdd.push(n);
      continue;
    }
    consumed.add(cur.id);
  }

  const continuing: CurrentPlayer[] = [];
  const toReactivate: CurrentPlayer[] = [];
  const leaving: CurrentPlayer[] = [];
  const manual: CurrentPlayer[] = [];
  for (const p of players) {
    const cp: CurrentPlayer = {
      id: p.id,
      name: p.name,
      active: p.active,
      claimed: !!p.user_id,
    };
    if (!linkedIds.has(p.id)) {
      if (p.active) manual.push(cp); // manual → intacto
      continue;
    }
    if (consumed.has(p.id)) {
      if (p.active) continuing.push(cp);
      else toReactivate.push(cp);
    } else if (p.active) {
      leaving.push(cp); // vinculado FCP, activo, no está en la nueva → desactivar
    }
  }

  return { toAdd, continuing, toReactivate, leaving, manual };
}

/** Aplica la reconciliación (server-side): añade nuevos, desactiva a los que se
 * van, reactiva a los que vuelven, re-vincula al equipo de la temporada nueva y
 * actualiza categoría/grupo si cambió. */
export async function applySeasonUpdate(
  teamId: string,
  newFcpIdEquipo: number,
  diff: SeasonDiff,
  category?: string | null,
  group?: string | null,
): Promise<{ added: number; deactivated: number; reactivated: number }> {
  const { data, error } = await rawRpc('apply_fcp_season_update', {
    p_team_id: teamId,
    p_new_fcp_id_equipo: newFcpIdEquipo,
    p_add_fcp_ids: diff.toAdd.map((a) => a.fcpId),
    p_deactivate_ids: diff.leaving.map((l) => l.id),
    p_reactivate_ids: diff.toReactivate.map((r) => r.id),
    p_category: category ?? null,
    p_group: group ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as { added: number; deactivated: number; reactivated: number }) ?? {
    added: 0,
    deactivated: 0,
    reactivated: 0,
  };
}
