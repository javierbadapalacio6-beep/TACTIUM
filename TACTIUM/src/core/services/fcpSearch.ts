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
  puntos: number | null; // puntos de LIGA (fcp_jugadores.puntos)
  // Nivel que cuenta para las reglas de torneo: el MEJOR de liga y circuito
  // (número menor = categoría más alta). null si no se pudo derivar ninguno.
  nivel: number | null;
  categoriaDiv: string | null; // "2ª" — la del nivel que manda
  nivelLiga: number | null; // división de liga en la que juega
  nivelCircuito: number | null; // categoría del ranking de circuito FCP
  origenNivel: 'liga' | 'circuito' | 'ambos' | null;
  equipo: string | null;
  genero: 'M' | 'F' | null;
}

// ── Categoría de CIRCUITO ───────────────────────────────────────────────────
// Un jugador tiene DOS categorías en la FCP: la de liga (la división de su
// equipo) y la del circuito (las listas "2ª CATEGORIA MASCULINA" de
// `fcp_rankings`). Para las reglas de un torneo vale LA MEJOR de las dos.
// El cruce va por NOMBRE porque `fcp_jugadores` no guarda el `id_fcp` estable
// del ranking. Solo cuentan las listas numeradas (las de veteranos/menores no
// casan con el patrón "Nª CATEGORIA").
const CIRCUITO_CAT_RE = /(\d+)\s*ª\s*CATEGORIA\s*(MASCULINA|FEMENINA)?/i;

/** Nombre a tokens comparables (sin acentos, mayúsculas, sin comas). */
const nameTokens = (s: string): string[] =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 3);

/** ¿Dos nombres son la misma persona? Pide 2-3 tokens comunes (nombre y
 *  apellidos vienen en orden distinto según la tabla). */
const sameName = (a: string[], b: string[]): boolean => {
  if (a.length === 0 || b.length === 0) return false;
  const overlap = a.filter((t) => b.includes(t)).length;
  return overlap >= 2 && overlap >= Math.min(3, Math.min(a.length, b.length));
};

interface CircuitRow {
  idJugador: string;
  name: string;
  tokens: string[];
  nivel: number;
  genero: 'M' | 'F' | null;
}

/** "GONZALEZ PEREZ, Ana Maria" → "Ana Maria Gonzalez Perez". El ranking trae el
 *  nombre en un solo campo y con el orden invertido. */
const prettyRankingName = (raw: string): string => {
  const s = raw.trim().replace(/\s+/g, ' ');
  const i = s.indexOf(',');
  const full = i >= 0 ? `${s.slice(i + 1).trim()} ${s.slice(0, i).trim()}` : s;
  return full
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim();
};

/** Personas del ranking de circuito que casan con los tokens buscados, ya
 *  agrupadas por persona y con su MEJOR categoría (nº menor). */
async function fetchCircuitRows(tokens: string[]): Promise<CircuitRow[]> {
  if (tokens.length === 0) return [];
  let sel = rawFrom('fcp_rankings')
    .select('id_jugador, nombre, categoria')
    .ilike('categoria', '%CATEGORIA%');
  for (const tok of tokens) sel = sel.ilike('nombre', `%${tok}%`);
  const { data } = await sel.limit(120);
  const byPerson = new Map<string, CircuitRow>();
  for (const r of (data ?? []) as {
    id_jugador: string;
    nombre: string | null;
    categoria: string | null;
  }[]) {
    const m = (r.categoria ?? '').match(CIRCUITO_CAT_RE);
    if (!m) continue;
    const nivel = parseInt(m[1], 10);
    if (!Number.isFinite(nivel)) continue;
    const toks = nameTokens(r.nombre ?? '');
    if (toks.length === 0) continue;
    const key = [...toks].sort().join(' ');
    const prev = byPerson.get(key);
    // Un jugador puede estar en varias listas: nos quedamos con la mejor.
    if (prev && prev.nivel <= nivel) continue;
    byPerson.set(key, {
      idJugador: String(r.id_jugador),
      name: prettyRankingName(r.nombre ?? ''),
      tokens: toks,
      nivel,
      genero: m[2] ? (m[2].toUpperCase().startsWith('F') ? 'F' : 'M') : null,
    });
  }
  return [...byPerson.values()];
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
  // La liga y el circuito se piden a la vez (tablas distintas, sin dependencia).
  const [{ data }, circuitRows] = await Promise.all([
    sel.order('puntos', { ascending: false }).limit(80),
    fetchCircuitRows(tokens),
  ]);
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
  // Ojo: `rows` vacío NO es "sin resultados" — puede ser alguien que solo juega
  // el circuito. Seguimos: los candidatos de circuito se añaden más abajo.

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

  // Resolver división(es) por id_equipo → nivel (nº) + género + TEMPORADA
  // (id_liga) del grupo, para poder quedarnos con la última temporada jugada.
  const allEquipos = [...new Set(people.flatMap((p) => [...p.equipos]))];
  const divByEquipo = new Map<
    number,
    { nivel: number; cat: string; genero: string; idLiga: number }
  >();
  if (allEquipos.length) {
    const { data: cl } = await rawFrom('fcp_clasificacion')
      .select('id_equipo, id_grupo')
      .in('id_equipo', allEquipos);
    const clRows = ((cl ?? []) as { id_equipo: number; id_grupo: string }[]).filter(
      (r) => !/^fase/i.test(r.id_grupo),
    );
    const grupoIds = [...new Set(clRows.map((r) => r.id_grupo))];
    const gMap = new Map<string, { nombre: string; genero: string; idLiga: number }>();
    if (grupoIds.length) {
      const { data: gr } = await rawFrom('fcp_grupos')
        .select('id_grupo, nombre, genero, id_liga')
        .in('id_grupo', grupoIds);
      for (const g of (gr ?? []) as {
        id_grupo: string;
        nombre: string;
        genero: string;
        id_liga: number | null;
      }[]) {
        gMap.set(g.id_grupo, { nombre: g.nombre, genero: g.genero, idLiga: g.id_liga ?? 0 });
      }
    }
    for (const r of clRows) {
      const g = gMap.get(r.id_grupo);
      if (!g) continue;
      const cat = catShort(g.nombre);
      const nivel = cat ? parseInt(cat, 10) : NaN;
      if (!Number.isFinite(nivel)) continue;
      const prev = divByEquipo.get(r.id_equipo);
      // Un equipo regular pertenece a una liga; conservamos su temporada.
      if (!prev || g.idLiga > prev.idLiga)
        divByEquipo.set(r.id_equipo, { nivel, cat: cat!, genero: g.genero, idLiga: g.idLiga });
    }
  }

  // Filas del circuito que ya se han fundido con un jugador de liga (para no
  // ofrecer a la misma persona dos veces).
  const usedCircuit = new Set<string>();

  const out: FcpPlayerMatch[] = people.map((p) => {
    // nivel = división de su ÚLTIMA temporada (id_liga más alto); a igualdad de
    // temporada, la mejor división (número menor).
    let best: { nivel: number; cat: string; genero: string; idLiga: number } | null = null;
    for (const eq of p.equipos) {
      const d = divByEquipo.get(eq);
      if (!d) continue;
      if (
        !best ||
        d.idLiga > best.idLiga ||
        (d.idLiga === best.idLiga && d.nivel < best.nivel)
      )
        best = d;
    }
    const name = displayName(p.rep);
    const genero: 'M' | 'F' | null = best ? (best.genero === 'F' ? 'F' : 'M') : null;
    const nivelLiga = best ? best.nivel : null;
    // Circuito: mejor categoría (nº menor) entre las listas donde aparece.
    const myTokens = nameTokens(name);
    let nivelCircuito: number | null = null;
    for (const cr of circuitRows) {
      if (genero && cr.genero && cr.genero !== genero) continue;
      if (!sameName(myTokens, cr.tokens)) continue;
      usedCircuit.add(cr.idJugador);
      if (nivelCircuito == null || cr.nivel < nivelCircuito) nivelCircuito = cr.nivel;
    }
    // Manda la MEJOR de las dos categorías (número menor).
    const nivel =
      nivelLiga == null
        ? nivelCircuito
        : nivelCircuito == null
          ? nivelLiga
          : Math.min(nivelLiga, nivelCircuito);
    const origenNivel: FcpPlayerMatch['origenNivel'] =
      nivel == null
        ? null
        : nivelLiga === nivelCircuito
          ? 'ambos'
          : nivel === nivelCircuito
            ? 'circuito'
            : 'liga';
    return {
      idJugador: String(p.rep.id_jugador),
      name,
      puntos: p.rep.puntos,
      nivel,
      categoriaDiv: nivel != null ? `${nivel}ª` : null,
      nivelLiga,
      nivelCircuito,
      origenNivel,
      equipo: p.rep.nombre_equipo,
      genero,
    };
  });

  // Quien SOLO juega circuito no está en `fcp_jugadores` (esa tabla son las
  // plantillas de los equipos de liga): lo añadimos desde el ranking. No tiene
  // puntos de LIGA, que son los que cuentan → 0, pero sí categoría.
  for (const cr of circuitRows) {
    if (usedCircuit.has(cr.idJugador)) continue;
    if (out.length >= 8) break;
    out.push({
      idJugador: cr.idJugador,
      name: cr.name,
      puntos: 0,
      nivel: cr.nivel,
      categoriaDiv: `${cr.nivel}ª`,
      nivelLiga: null,
      nivelCircuito: cr.nivel,
      origenNivel: 'circuito',
      equipo: null,
      genero: cr.genero,
    });
  }

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
