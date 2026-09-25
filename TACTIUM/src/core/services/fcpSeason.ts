// Preparar NUEVA temporada de la Federación para un equipo ya vinculado.
// El equipo de TACTIUM es permanente; cada temporada se reconcilia la plantilla
// con la de la liga nueva de la FCP: se añaden los nuevos, se DESACTIVAN (nunca
// se borran) los que ya no están y se reactivan los que vuelven. La identidad
// se resuelve por nombre normalizado, con confirmación del capitán (vista
// previa). Ver [[tactium_fcp_federation_integration]] y el diff en la UI.
import { supabase } from '@core/supabase/client';
import * as SeasonsApi from './seasons';
import * as MatchdaysApi from './matchdays';
import { fetchCurrentLiga } from './fcpBrowse';

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

/**
 * El mismo equipo, en la última temporada que SÍ tenga clasificación.
 *
 * Solo hace falta cuando el id apunta a una INSCRIPCIÓN: la liga que viene
 * trae equipos meses antes que grupos, así que ese id no está en ninguna
 * clasificación. El cruce va por NOMBRE + GÉNERO porque el `id_equipo` cambia
 * cada temporada —hasta dos veces al año, por los grupos de playoff— y es lo
 * único que se conserva entre una y otra.
 */
async function idEquipoTemporadaAnterior(fcpIdEquipo: number): Promise<number | null> {
  const { data: ins } = await rawFrom('fcp_inscripciones')
    .select('equipo, genero')
    .eq('id_equipo', fcpIdEquipo)
    .limit(1);
  const insc = ((ins ?? []) as { equipo: string | null; genero: string | null }[])[0];
  const nombre = (insc?.equipo ?? '').trim();
  if (!nombre) return null;
  const esFem = (insc?.genero ?? '').toUpperCase().startsWith('F');

  const { data: cl } = await rawFrom('fcp_clasificacion')
    .select('id_equipo, equipo, id_grupo')
    .ilike('equipo', nombre)
    .limit(500);
  const rows = ((cl ?? []) as {
    id_equipo: number | null;
    equipo: string | null;
    id_grupo: string | null;
  }[]).filter((r) => r.id_equipo != null && r.id_grupo && norm(r.equipo) === norm(nombre));
  if (rows.length === 0) return null;

  const { data: gr } = await rawFrom('fcp_grupos')
    .select('id_grupo, id_liga, genero')
    .in('id_grupo', [...new Set(rows.map((r) => r.id_grupo as string))]);
  const gById = new Map(
    ((gr ?? []) as { id_grupo: string; id_liga: number | null; genero: string | null }[]).map(
      (g) => [g.id_grupo, g],
    ),
  );

  let best: { id: number; liga: number } | null = null;
  for (const r of rows) {
    const g = gById.get(r.id_grupo as string);
    if (!g || g.id_liga == null) continue;
    // El género separa homónimos: "MEDIO CUDEYO A" existe masculino y femenino.
    if ((g.genero ?? '').toUpperCase().startsWith('F') !== esFem) continue;
    if (!best || g.id_liga > best.liga) best = { id: r.id_equipo as number, liga: g.id_liga };
  }
  return best?.id ?? null;
}

/** Grupo principal (liga regular) de un id_equipo federativo. Muchos equipos
 * aparecen en 2+ grupos (liga regular + playoff ORO/PLATA), así que un
 * `maybeSingle` fallaría; elegimos el grupo con MÁS partidos, que es la liga
 * regular (donde vive el calendario y la clasificación completa).
 *
 * Devuelve null si ese equipo no está en ninguna clasificación, y ese null
 * significa algo: quien lo llama con un id cualquiera —la ficha de un equipo
 * del buscador— lo usa para saber que es una INSCRIPCIÓN y enseñar la ficha de
 * inscrito. Para el grupo de MI equipo, que sí quiere caer a la temporada
 * anterior, está `resolveMainGroupOrPrevious`. */
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

/**
 * El grupo de MI equipo, con respaldo en la temporada anterior.
 *
 * Desde que «Preparar temporada» permite volcar la liga que viene, el vínculo
 * puede apuntar a una inscripción: una liga con equipos pero sin grupos, así
 * que sin clasificación. La temporada activa en TACTIUM sigue siendo la que
 * acaba —conserva sus jornadas y sus resultados, que viven aquí— y su tabla,
 * que se pide a la Federación, se quedaba en blanco de golpe.
 *
 * Solo para lo que es «mi equipo» (clasificación y cuadro de la temporada
 * activa). Un id suelto del buscador debe seguir dando null: ahí el null es la
 * señal de que ese equipo aún no juega nada.
 */
export async function resolveMainGroupOrPrevious(fcpIdEquipo: number): Promise<{
  id_grupo: string;
  equipo: string;
  /** El id que de verdad sale en esa clasificación: el de la temporada a la que
   *  pertenece la tabla, que NO es el del vínculo cuando hemos tirado de
   *  respaldo. Quien marca «este soy yo» tiene que comparar con este. */
  idEquipo: number;
} | null> {
  const propio = await resolveMainGroup(fcpIdEquipo);
  if (propio) return { ...propio, idEquipo: fcpIdEquipo };
  const anterior = await idEquipoTemporadaAnterior(fcpIdEquipo);
  if (anterior == null) return null;
  // `anterior` sale de la clasificación, así que aquí ya no hay más respaldo
  // que buscar: o tiene grupo o no lo tiene.
  const previo = await resolveMainGroup(anterior);
  return previo ? { ...previo, idEquipo: anterior } : null;
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
  const main = await resolveMainGroupOrPrevious(fcpIdEquipo);
  if (!main) return { grupo: null, rows: [] };
  const grupo = main.id_grupo;
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
    return { ...r, pj: s.pj, pg: s.pg, isMe: r.id_equipo === main.idEquipo };
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
  const main = await resolveMainGroupOrPrevious(fcpIdEquipo);
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

/**
 * Volcado de temporada (Nivel 1): vuelca el calendario del grupo (jornadas con
 * rival, resultado, local/visitante…) en la temporada que le corresponde.
 *
 * `new_season` dice si ha hecho una temporada nueva. La hace cuando el
 * calendario es de OTRO grupo federativo que el de la temporada activa: cierra
 * la vigente —como «cerrar temporada» en la app— y empieza otra. Antes metía
 * las jornadas nuevas en la temporada vieja, encajándolas por número, y se
 * llevaba por delante los resultados del año anterior. Ver la migración
 * `20260925_import_fcp_season_no_pisa`.
 */
export async function importFcpSeason(
  teamId: string,
  fcpIdEquipo: number,
  seasonName?: string,
): Promise<{ season_id: string; created: number; updated: number; new_season: boolean }> {
  const { data, error } = await rawRpc('import_fcp_season', {
    p_team_id: teamId,
    p_fcp_id_equipo: fcpIdEquipo,
    p_season_name: seasonName ?? 'Liga Cántabra',
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as {
    season_id?: string;
    created?: number;
    updated?: number;
    new_season?: boolean;
  };
  return {
    season_id: r.season_id ?? '',
    created: r.created ?? 0,
    updated: r.updated ?? 0,
    new_season: !!r.new_season,
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

// ── Estado de temporada respecto a la Federación ────────────────────────────
// El vínculo con la FCP CADUCA cada temporada: un mismo equipo cambia de
// `id_equipo` cada año (y hasta dos veces, porque los grupos de playoff usan
// otro id). Comprobado sobre los datos reales: 10 ids distintos para el mismo
// nombre en 5 temporadas. Por eso no se puede arrastrar el vínculo del año
// pasado: hay que volver a volcar cuando la Federación publica la liga nueva.
export interface FcpSeasonStatus {
  /** Temporada (id_liga) a la que está vinculado el equipo. */
  linkedLiga: number | null;
  /** Última temporada con datos publicados en la Federación. */
  latestLiga: number | null;
  /** Hay temporada nueva publicada y este equipo sigue en la anterior. */
  newSeasonPublished: boolean;
  /** Ventana de fichajes abierta. La normativa (IV.5) no la fija por fechas:
   *  «cada equipo podrá ir ampliando su plantilla hasta finalizada la PRIMERA
   *  VUELTA». Así que se calcula por jornadas jugadas, no por el calendario. */
  signingWindowOpen: boolean;
}

/** ¿Está el equipo en la temporada vigente de la Federación? */
export async function fcpSeasonStatus(teamId: string): Promise<FcpSeasonStatus> {
  const out: FcpSeasonStatus = {
    linkedLiga: null,
    latestLiga: null,
    newSeasonPublished: false,
    signingWindowOpen: false,
  };

  // Fichajes: abiertos mientras no se haya cerrado la primera vuelta.
  try {
    const season = await SeasonsApi.fetchActiveSeason(teamId);
    if (season) {
      const mds = await MatchdaysApi.fetchMatchdays(season.id);
      const played = mds.filter((m) => m.outcome != null).length;
      out.signingWindowOpen = mds.length > 0 && played < Math.ceil(mds.length / 2);
    }
  } catch {
    /* sin temporada activa: no molestamos con el aviso */
  }

  // Temporada vigente = la que tiene CALENDARIO, no la más nueva que exista.
  //
  // De esto sale el aviso «hay temporada nueva, vuelve a volcar». La Federación
  // abre las inscripciones de la temporada siguiente meses antes de publicar
  // ningún partido, así que con el criterio anterior (mayor id en la
  // clasificación) el aviso habría saltado a todos los clubes federados a mitad
  // de temporada, mandándoles re-volcar a una liga sin calendario. Ver
  // `fetchCurrentLiga`.
  out.latestLiga = await fetchCurrentLiga();

  const idEquipo = await getFcpIdEquipo(teamId);
  if (idEquipo == null || out.latestLiga == null) return out;

  // Temporada del equipo vinculado: la de su grupo en la clasificación.
  const { data: clRows } = await rawFrom('fcp_clasificacion')
    .select('id_grupo')
    .eq('id_equipo', idEquipo);
  const grupoIds = [
    ...new Set(
      ((clRows ?? []) as { id_grupo: string | null }[])
        .map((r) => r.id_grupo)
        .filter((x): x is string => !!x),
    ),
  ];
  if (grupoIds.length) {
    const { data: gr } = await rawFrom('fcp_grupos')
      .select('id_liga')
      .in('id_grupo', grupoIds);
    for (const g of (gr ?? []) as { id_liga: number | null }[]) {
      if (g.id_liga != null && (out.linkedLiga == null || g.id_liga > out.linkedLiga))
        out.linkedLiga = g.id_liga;
    }
  } else {
    // Sin clasificación: el vínculo apunta a una INSCRIPCIÓN. Desde que
    // «Preparar temporada» ofrece los equipos de la liga que viene, un equipo
    // puede quedar vinculado a una temporada que aún no tiene ni grupos, y por
    // ahí el aviso se quedaba mudo para siempre: `linkedLiga` salía null y
    // `newSeasonPublished` nunca se cumplía.
    const { data: ins } = await rawFrom('fcp_inscripciones')
      .select('id_liga')
      .eq('id_equipo', idEquipo)
      .limit(1);
    const insLiga = ((ins ?? []) as { id_liga: number | null }[])[0]?.id_liga ?? null;
    if (insLiga != null) {
      out.linkedLiga = insLiga;
      // Si esa liga YA tiene grupos publicados y nosotros seguimos sin salir en
      // su clasificación, es que el calendario llegó con otros identificadores
      // y el nuestro se quedó obsoleto: hay que volver a volcar. No damos por
      // hecho que la Federación conserve el id de la inscripción.
      const { count } = await rawFrom('fcp_grupos')
        .select('id_grupo', { count: 'exact', head: true })
        .eq('id_liga', insLiga);
      if ((count ?? 0) > 0) {
        out.newSeasonPublished = true;
        return out;
      }
    }
  }
  out.newSeasonPublished =
    out.linkedLiga != null && out.latestLiga != null && out.latestLiga > out.linkedLiga;
  return out;
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
