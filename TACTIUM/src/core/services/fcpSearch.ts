// Búsqueda en la Federación Cántabra: equipos y jugadores (+ el buscador general
// que combina ambos con grupos). Read-only sobre las tablas fcp_* espejadas.
// Ver [[tactium_fcp_federation_integration]]. Los grupos se buscan con
// fetchFcpGroups de [[fcpBrowse]].
import { supabase } from '@core/supabase/client';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

/** Categoría corta desde un texto ("2ª CATEGORIA MASCULINA" → "2ª"). */
export const catShort = (s: string | null | undefined): string | null => {
  const m = (s ?? '').match(/(\d+)\s*ª/);
  return m ? `${m[1]}ª` : null;
};

// Limpia el término para usarlo en filtros PostgREST (`.or`/`.ilike` se rompen
// con comas, paréntesis o %).
const clean = (q: string) => q.replace(/[%,()]/g, ' ').trim();

const displayName = (r: {
  nombre_pila?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  nombre?: string | null;
}) =>
  [r.nombre_pila, r.apellido1, r.apellido2]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim() || (r.nombre ?? 'Jugador');

export interface FcpTeamResult {
  idEquipo: number;
  equipo: string;
  idGrupo: string; // grupo "principal" (liga regular) para abrir su ficha
  grupoNombre: string;
  genero: string; // 'M' | 'F'
  categoria: string | null;
  temporada: string | null;
}

export interface FcpTeamFilters {
  idLiga?: number | null;
  genero?: 'M' | 'F' | 'all';
  categoria?: string; // '2ª' | 'all'
  // Cuando NO hay término de búsqueda, acota a estos grupos (los del año que ya
  // cargó la pantalla, filtrados por género/categoría) → browse preciso por filtros.
  grupoIds?: string[];
  limit?: number;
}

/** Equipos por nombre. Dedup por id_equipo (grupo regular preferido). Filtra por
 *  año/género/categoría (género y categoría salen del grupo, no del equipo).
 *  Sin término y sin grupoIds devuelve vacío (no escaneamos toda la tabla). */
export async function searchFcpTeams(
  query: string,
  filters: FcpTeamFilters = {},
): Promise<FcpTeamResult[]> {
  const q = clean(query);
  const { idLiga, genero = 'all', categoria = 'all', grupoIds, limit = 40 } = filters;
  if (q.length < 2 && !(grupoIds && grupoIds.length)) return [];

  let sel = rawFrom('fcp_clasificacion').select('id_equipo, equipo, id_grupo, id_liga');
  if (q.length >= 2) sel = sel.ilike('equipo', `%${q}%`);
  else if (grupoIds && grupoIds.length) sel = sel.in('id_grupo', grupoIds);
  if (idLiga) sel = sel.eq('id_liga', idLiga);
  const { data: rows } = await sel.limit(600);
  const clasif = (rows ?? []) as {
    id_equipo: number | null;
    equipo: string;
    id_grupo: string;
    id_liga: number;
  }[];
  if (clasif.length === 0) return [];

  const neededGroupIds = [...new Set(clasif.map((r) => r.id_grupo))];
  const { data: gr } = await rawFrom('fcp_grupos')
    .select('id_grupo, nombre, genero, temporada')
    .in('id_grupo', neededGroupIds);
  const gmap = new Map(
    ((gr ?? []) as { id_grupo: string; nombre: string; genero: string; temporada: string }[]).map(
      (g) => [g.id_grupo, g],
    ),
  );

  // Dedup por id_equipo: preferimos el grupo de liga regular (id no 'fase…').
  const best = new Map<number, FcpTeamResult>();
  for (const r of clasif) {
    if (r.id_equipo == null) continue;
    const g = gmap.get(r.id_grupo);
    if (!g) continue;
    const isRegular = !/^fase/i.test(r.id_grupo);
    const prev = best.get(r.id_equipo);
    const prevRegular = prev ? !/^fase/i.test(prev.idGrupo) : false;
    if (prev && (prevRegular || !isRegular)) continue; // ya tenemos uno igual o mejor
    best.set(r.id_equipo, {
      idEquipo: r.id_equipo,
      equipo: r.equipo,
      idGrupo: r.id_grupo,
      grupoNombre: g.nombre,
      genero: g.genero,
      categoria: catShort(g.nombre),
      temporada: g.temporada ?? null,
    });
  }

  let out = [...best.values()];
  if (genero !== 'all') out = out.filter((t) => t.genero === genero);
  if (categoria && categoria !== 'all') out = out.filter((t) => t.categoria === categoria);
  out.sort((a, b) => a.equipo.localeCompare(b.equipo));
  return out.slice(0, limit);
}

export interface FcpPlayerResult {
  idJugador: string; // las rutas usan idJugador como string
  name: string;
  categoria: string | null;
  puntos: number | null;
  equipo: string | null;
}

export interface FcpPlayerFilters {
  categoria?: string; // '2ª' | 'all'
  // Acota a jugadores de estos equipos (p.ej. los de un grupo seleccionado).
  // Con idEquipos se permite buscar sin término (browse de la plantilla del grupo).
  idEquipos?: number[];
  limit?: number;
}

/** Jugadores por nombre (nombre completo o apellidos). Filtra por categoría y,
 *  opcionalmente, por equipos (para acotar a un grupo). */
export async function searchFcpPlayers(
  query: string,
  filters: FcpPlayerFilters = {},
): Promise<FcpPlayerResult[]> {
  const q = clean(query);
  const { categoria = 'all', idEquipos, limit = 40 } = filters;
  const hasScope = !!(idEquipos && idEquipos.length);
  if (q.length < 2 && !hasScope) return [];

  // El campo `nombre` viene como "APELLIDO1 APELLIDO2, NOMBRE", así que una
  // búsqueda de varias palabras ("javier bada") no casa contra un solo campo.
  // Partimos en palabras y exigimos que CADA una aparezca en algún campo
  // (encadenar .or() los combina con AND).
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  let sel = rawFrom('fcp_jugadores').select(
    'id_jugador, nombre, apellido1, apellido2, nombre_pila, categoria, puntos, nombre_equipo',
  );
  for (const tok of tokens) {
    sel = sel.or(
      `nombre.ilike.%${tok}%,apellido1.ilike.%${tok}%,apellido2.ilike.%${tok}%,nombre_pila.ilike.%${tok}%`,
    );
  }
  if (hasScope) sel = sel.in('id_equipo', idEquipos);
  const { data } = await sel.order('puntos', { ascending: false }).limit(300);

  // La tabla repite al MISMO jugador por temporada/equipo (id_jugador =
  // `fcp_{licencia}_{nombre}`, la licencia cambia cada año). Deduplicamos por
  // la parte del nombre y nos quedamos con la de más puntos (la más reciente).
  // La ficha reconstruye todos los años a partir del nombre, así que vale
  // cualquier id representativo.
  const seen = new Set<string>();
  const out: FcpPlayerResult[] = [];
  for (const r of (data ?? []) as {
    id_jugador: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    nombre_pila: string | null;
    categoria: string | null;
    puntos: number | null;
    nombre_equipo: string | null;
  }[]) {
    const key = String(r.id_jugador).replace(/^fcp_\d+_/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const cat = catShort(r.categoria);
    if (categoria && categoria !== 'all' && cat !== categoria) continue;
    out.push({
      idJugador: String(r.id_jugador),
      name: displayName(r),
      categoria: cat,
      puntos: r.puntos,
      equipo: r.nombre_equipo,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Auto-detección para inscripción a torneos ───────────────────────────────
// Cruza el nombre escrito con jugadores de la Federación para autocompletar los
// PUNTOS (fcp_jugadores.puntos) y el NIVEL (nº de la división en la que juega:
// 2ª→2, 4ª→4; menor = más nivel). Ver [[tactium_tournaments_fcp_autodetect_plan]].
export interface FcpPlayerMatch {
  idJugador: string;
  name: string;
  puntos: number | null;
  nivel: number | null; // nº de división (2ª→2). null si no se pudo derivar.
  categoriaDiv: string | null; // "2ª"
  equipo: string | null;
  genero: 'M' | 'F' | null;
}

/** Candidatos de la Federación que casan con un nombre, con puntos + nivel
 *  resueltos. Ordenados por puntos desc. Vacío si el nombre es muy corto o no
 *  hay coincidencias (jugador no federado → alta manual). */
export async function resolveFcpPlayer(
  name: string,
  opts: { genero?: 'M' | 'F' | null } = {},
): Promise<FcpPlayerMatch[]> {
  const q = clean(name);
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (q.length < 3 || tokens.length === 0) return [];

  let sel = rawFrom('fcp_jugadores').select(
    'id_jugador, nombre, apellido1, apellido2, nombre_pila, puntos, id_equipo, nombre_equipo',
  );
  for (const tok of tokens) {
    sel = sel.or(
      `nombre.ilike.%${tok}%,apellido1.ilike.%${tok}%,apellido2.ilike.%${tok}%,nombre_pila.ilike.%${tok}%`,
    );
  }
  const { data } = await sel.order('puntos', { ascending: false }).limit(80);
  const rows = (data ?? []) as {
    id_jugador: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    nombre_pila: string | null;
    puntos: number | null;
    id_equipo: number | null;
    nombre_equipo: string | null;
  }[];
  if (rows.length === 0) return [];

  // Dedup por persona (la licencia del id cambia por temporada). La 1ª fila de
  // cada persona = la de más puntos (vienen ordenadas). Acumulamos TODOS sus
  // id_equipo para derivar el nivel más alto entre sus divisiones.
  type Person = { rep: (typeof rows)[number]; equipos: Set<number> };
  const byPerson = new Map<string, Person>();
  for (const r of rows) {
    const key = String(r.id_jugador).replace(/^fcp_\d+_/, '');
    let e = byPerson.get(key);
    if (!e) {
      e = { rep: r, equipos: new Set() };
      byPerson.set(key, e);
    }
    if (r.id_equipo != null) e.equipos.add(r.id_equipo);
  }
  const people = [...byPerson.values()].slice(0, 6);

  // Resolver división(es) por id_equipo → nivel (nº) + género del grupo.
  const allEquipos = [...new Set(people.flatMap((p) => [...p.equipos]))];
  const divByEquipo = new Map<number, { nivel: number; cat: string; genero: string }>();
  if (allEquipos.length) {
    const { data: cl } = await rawFrom('fcp_clasificacion')
      .select('id_equipo, id_grupo')
      .in('id_equipo', allEquipos);
    const clRows = ((cl ?? []) as { id_equipo: number; id_grupo: string }[]).filter(
      (r) => !/^fase/i.test(r.id_grupo),
    );
    const grupoIds = [...new Set(clRows.map((r) => r.id_grupo))];
    const gMap = new Map<string, { nombre: string; genero: string }>();
    if (grupoIds.length) {
      const { data: gr } = await rawFrom('fcp_grupos')
        .select('id_grupo, nombre, genero')
        .in('id_grupo', grupoIds);
      for (const g of (gr ?? []) as { id_grupo: string; nombre: string; genero: string }[]) {
        gMap.set(g.id_grupo, { nombre: g.nombre, genero: g.genero });
      }
    }
    for (const r of clRows) {
      const g = gMap.get(r.id_grupo);
      if (!g) continue;
      const cat = catShort(g.nombre);
      const nivel = cat ? parseInt(cat, 10) : NaN;
      if (!Number.isFinite(nivel)) continue;
      const prev = divByEquipo.get(r.id_equipo);
      if (!prev || nivel < prev.nivel) divByEquipo.set(r.id_equipo, { nivel, cat: cat!, genero: g.genero });
    }
  }

  const out: FcpPlayerMatch[] = people.map((p) => {
    // nivel = división más ALTA (número menor) entre todos sus equipos.
    let best: { nivel: number; cat: string; genero: string } | null = null;
    for (const eq of p.equipos) {
      const d = divByEquipo.get(eq);
      if (d && (!best || d.nivel < best.nivel)) best = d;
    }
    return {
      idJugador: String(p.rep.id_jugador),
      name: displayName(p.rep),
      puntos: p.rep.puntos,
      nivel: best ? best.nivel : null,
      categoriaDiv: best ? best.cat : null,
      equipo: p.rep.nombre_equipo,
      genero: best ? (best.genero === 'F' ? 'F' : 'M') : null,
    };
  });

  const gf = opts.genero;
  return gf ? out.filter((m) => m.genero == null || m.genero === gf) : out;
}

/** id_equipo de los equipos de un grupo (para acotar jugadores por grupo). */
export async function fetchGroupTeamIds(idGrupo: string): Promise<number[]> {
  const { data } = await rawFrom('fcp_clasificacion').select('id_equipo').eq('id_grupo', idGrupo);
  return [
    ...new Set(
      ((data ?? []) as { id_equipo: number | null }[])
        .map((r) => r.id_equipo)
        .filter((x): x is number => x != null),
    ),
  ];
}

export interface FcpRankingRow {
  posicion: number;
  name: string;
  puntos: number | null;
}

/** Nombre de la lista de ranking en la FCP según género y categoría. Las listas
 *  generales usan "MASCULINO/FEMENINO"; las de división "MASCULINA/FEMENINA". */
export function rankingCategoria(genero: 'all' | 'M' | 'F', categoria: string): string {
  const f = genero === 'F';
  if (!categoria || categoria === 'all') return `RANKING LIGA ${f ? 'FEMENINO' : 'MASCULINO'}`;
  return `${categoria} CATEGORIA ${f ? 'FEMENINA' : 'MASCULINA'}`;
}

/** Ranking FCP (lista por género/categoría). Con término filtra por nombre. */
export async function fetchFcpRanking(opts: {
  genero: 'all' | 'M' | 'F';
  categoria: string;
  query?: string;
  limit?: number;
}): Promise<FcpRankingRow[]> {
  const { genero, categoria, query = '', limit = 150 } = opts;
  const cat = rankingCategoria(genero, categoria);
  let sel = rawFrom('fcp_rankings').select('posicion, nombre, puntos').eq('categoria', cat);
  const q = clean(query);
  if (q.length >= 2) sel = sel.ilike('nombre', `%${q}%`);
  const { data } = await sel.order('posicion', { ascending: true }).limit(limit);
  return ((data ?? []) as { posicion: number; nombre: string | null; puntos: number | string | null }[]).map(
    (r) => ({
      posicion: r.posicion,
      name: r.nombre ?? '—',
      puntos: r.puntos == null ? null : Number(r.puntos),
    }),
  );
}
