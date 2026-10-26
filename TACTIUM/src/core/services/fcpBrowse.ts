// Navegación libre de la Federación Cántabra: años de liga → grupos (categoría/
// género) → clasificación + jornadas. Read-only, sobre las tablas fcp_* ya
// espejadas. Ver [[tactium_fcp_federation_integration]] (F3 "Federación navegable").
import { supabase } from '@core/supabase/client';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

export interface FcpYear {
  idLiga: number;
  temporada: string; // "2026"
  nombre: string;
  /** Tiene calendario: se está jugando o ya se jugó. Una liga en periodo de
   *  INSCRIPCIÓN trae equipos y categorías, pero ningún partido todavía. */
  conCalendario: boolean;
}

/**
 * Liga «en juego»: la más nueva que tenga CALENDARIO.
 *
 * Antes se cogía la de id más alto con datos, y eso se rompe justo cuando la
 * Federación abre las inscripciones de la temporada siguiente: la liga nueva
 * nace con sus equipos y sus categorías meses antes de que exista un solo
 * partido, así que la app se habría cambiado sola a la temporada que viene a
 * mitad de la que se está jugando. Un club que importase en enero se habría
 * traído los equipos del año siguiente.
 *
 * El calendario es la frontera: mientras no hay partidos, la liga está en
 * inscripción y la de verdad sigue siendo la anterior.
 */
export async function fetchCurrentLiga(): Promise<number | null> {
  if (ligaCache && Date.now() - ligaCache.at < LIGA_TTL_MS) return ligaCache.value;
  const { data } = await rawFrom('fcp_partidos')
    .select('id_liga')
    .order('id_liga', { ascending: false })
    .limit(1)
    .maybeSingle();
  const value = data ? ((data as { id_liga: number }).id_liga ?? null) : null;
  ligaCache = { at: Date.now(), value };
  return value;
}

// Se pregunta en cada búsqueda de jugador, o sea a cada tecleo, y la respuesta
// solo cambia cuando la Federación publica el calendario de la temporada
// siguiente: una vez al año. Una caché corta evita el viaje de ida y vuelta sin
// que el dato pueda quedarse rancio de forma apreciable.
let ligaCache: { at: number; value: number | null } | null = null;
const LIGA_TTL_MS = 5 * 60 * 1000;

/** Años/ligas con datos reales (los que tienen grupos scrapeados). */
export async function fetchFcpYears(): Promise<FcpYear[]> {
  const [current, { data: grupos }, { data: inscritas }, { data: ligas }] = await Promise.all([
    fetchCurrentLiga(),
    // El limit explícito importa: por defecto PostgREST corta en 1000 filas y
    // los grupos crecen ~130 por temporada, así que sin esto acabarían
    // desapareciendo temporadas viejas del selector sin avisar.
    rawFrom('fcp_grupos').select('id_liga').limit(20000),
    // Una liga EN INSCRIPCIÓN no tiene grupos todavía, pero sí equipos
    // apuntados: es información real y esconderla no ayuda a nadie. Lo que no
    // cambia es cuál sale elegida por defecto (ver `defaultYear`).
    rawFrom('fcp_inscripciones').select('id_liga').limit(20000),
    rawFrom('fcp_ligas').select('id_liga, temporada, nombre'),
  ]);
  const withData = new Set([
    ...((grupos ?? []) as { id_liga: number | null }[]).map((g) => g.id_liga),
    ...((inscritas ?? []) as { id_liga: number | null }[]).map((i) => i.id_liga),
  ]);
  return ((ligas ?? []) as { id_liga: number; temporada: string | null; nombre: string | null }[])
    .filter((l) => withData.has(l.id_liga))
    .map((l) => ({
      idLiga: l.id_liga,
      temporada: l.temporada ?? '',
      nombre: l.nombre ?? `Liga ${l.id_liga}`,
      // Las ligas van en orden cronológico, así que todo lo anterior o igual a
      // la que se juega ya tuvo calendario; lo posterior está en inscripción.
      conCalendario: current != null && l.id_liga <= current,
    }))
    .sort((a, b) => b.temporada.localeCompare(a.temporada));
}

/** La que debe salir elegida de entrada: la que está en INSCRIPCIÓN si la hay
 *  (entre el reparto de grupos y el calendario es lo que todo el mundo busca:
 *  contra quién juega y dónde) y, si no, la que se juega. Igual que la web. */
export const defaultYear = (years: FcpYear[]): FcpYear | null =>
  years.find((y) => !y.conCalendario) ?? years.find((y) => y.conCalendario) ?? years[0] ?? null;

export interface FcpGroupItem {
  idGrupo: string;
  nombre: string;
  genero: string; // 'M' | 'F'
  esPlayoff: boolean;
}

/** Grupos de un año, ordenados (regular primero) y con género. */
export async function fetchFcpGroups(idLiga: number): Promise<FcpGroupItem[]> {
  const { data } = await rawFrom('fcp_grupos')
    .select('id_grupo, nombre, genero')
    .eq('id_liga', idLiga);

  // En una liga que aún no ha empezado no hay grupos: el sorteo no está hecho.
  // Lo que sí hay son CATEGORÍAS, que es donde se inscriben los equipos, y
  // sirven igual para filtrar. Se sacan de las inscripciones.
  if (!data || data.length === 0) {
    const { data: insc } = await rawFrom('fcp_inscripciones')
      .select('id_grupo, grupo_nombre, genero')
      .eq('id_liga', idLiga)
      .limit(5000);
    const vistos = new Map<string, FcpGroupItem>();
    for (const r of (insc ?? []) as {
      id_grupo: string;
      grupo_nombre: string | null;
      genero: string | null;
    }[]) {
      if (vistos.has(r.id_grupo)) continue;
      vistos.set(r.id_grupo, {
        idGrupo: r.id_grupo,
        nombre: r.grupo_nombre ?? r.id_grupo,
        genero: r.genero ?? 'M',
        esPlayoff: false,
      });
    }
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  return ((data ?? []) as { id_grupo: string; nombre: string | null; genero: string | null }[])
    .map((g) => ({
      idGrupo: g.id_grupo,
      nombre: g.nombre ?? g.id_grupo,
      genero: g.genero ?? 'M',
      esPlayoff: /^fase/i.test(g.id_grupo) || /ORO|PLATA|PLAY\s*OFF/i.test(g.nombre ?? ''),
    }))
    .sort((a, b) => {
      if (a.esPlayoff !== b.esPlayoff) return a.esPlayoff ? 1 : -1;
      return a.nombre.localeCompare(b.nombre);
    });
}

export interface FcpBrowseStanding {
  posicion: number | null;
  equipo: string;
  idEquipo: number | null;
  puntos: number | null;
  setsFavor: number | null;
  setsContra: number | null;
  pj: number;
  pg: number;
  /** Racha reciente (hasta 5 resultados, del más antiguo al más nuevo). */
  form: ('V' | 'D')[];
  /** Tabla completa de la Federación, calculada con las actas: enfrentamientos, partidos, sets y juegos. */
  stats: GroupTeamStats;
}

export interface GroupTeamStats {
  /** Enfrentamientos disputados (encuentros entre equipos). */
  enf: number;
  /** Partidos (parejas) disputados y ganados. */
  pj: number;
  pg: number;
  sf: number;
  sc: number;
  jf: number;
  jc: number;
}

const EMPTY_STATS: GroupTeamStats = { enf: 0, pj: 0, pg: 0, sf: 0, sc: 0, jf: 0, jc: 0 };

/** «6/4 - 3/6 - 10/8» → juegos de cada lado (suma de los parciales). */
function juegosDe(parciales: string | null | undefined): [number, number] {
  let a = 0;
  let b = 0;
  for (const m of (parciales ?? '').matchAll(/(d+)s*[/-:]s*(d+)/g)) {
    a += Number(m[1]);
    b += Number(m[2]);
  }
  return [a, b];
}

/**
 * Un equipo que cambia de nombre (patrocinador) deja su fila vieja en la clasificación con el mismo id: sale
 * duplicado y el grupo parece tener un equipo de más. Se queda la fila cuyo nombre aparece en los partidos.
 */
function dedupeClasif<T extends { equipo: string; id_equipo: number | null }>(
  rows: T[],
  partidos: { equipo_local: string | null; equipo_visit: string | null }[],
): T[] {
  const names = new Set<string>();
  for (const p of partidos) {
    if (p.equipo_local) names.add(p.equipo_local);
    if (p.equipo_visit) names.add(p.equipo_visit);
  }
  return rows.filter(
    (r) => r.id_equipo == null || names.size === 0 || names.has(r.equipo) || !rows.some((o) => o !== r && o.id_equipo === r.id_equipo && names.has(o.equipo)),
  );
}

type OverlayPartido = {
  id_partido: string;
  estado: string | null;
  resultado: string | null;
  ganador: string | null;
};

/**
 * Lo que la Federación aún no ha subido pero TACTIUM ya sabe (acta cerrada por el capitán): se rellena el
 * partido con nuestro marcador para poder deducir la clasificación. Solo se ve lo de tus equipos (RLS) y
 * solo donde la Federación no tiene resultado: en cuanto lo sube, manda el suyo.
 */
async function overlayOwnResults(partidos: OverlayPartido[] | null): Promise<void> {
  const pend = (partidos ?? []).filter((p) => p.estado !== 'jugado' && !p.resultado);
  if (pend.length === 0) return;
  const { data } = await rawFrom('matchdays')
    .select('fcp_id_partido, is_home, score_for, score_against')
    .in('fcp_id_partido', pend.map((p) => p.id_partido))
    .eq('status', 'finished');
  for (const m of (data ?? []) as {
    fcp_id_partido: string;
    is_home: boolean;
    score_for: number | null;
    score_against: number | null;
  }[]) {
    if (m.score_for == null || m.score_against == null) continue;
    const p = pend.find((x) => x.id_partido === m.fcp_id_partido);
    if (!p) continue;
    const l = m.is_home ? m.score_for : m.score_against;
    const v = m.is_home ? m.score_against : m.score_for;
    p.estado = 'jugado';
    p.resultado = `${l}-${v}`;
    p.ganador = l > v ? 'local' : v > l ? 'visitante' : null;
  }
}

/** Clasificación de un grupo (PJ/PG derivados de fcp_partidos). */
export async function fetchGroupStandings(
  idGrupo: string,
): Promise<{ nombre: string | null; genero: string | null; rows: FcpBrowseStanding[]; provisional: boolean }> {
  const { data: rawClasif } = await rawFrom('fcp_clasificacion')
    .select('posicion, equipo, id_equipo, puntos, sets_favor, sets_contra')
    .eq('id_grupo', idGrupo)
    .order('posicion', { ascending: true });

  const { data: partidos } = await rawFrom('fcp_partidos')
    .select('id_partido, equipo_local, equipo_visit, ganador, estado, jornada, resultado, tipo')
    .eq('id_grupo', idGrupo)
    .order('jornada', { ascending: true });
  await overlayOwnResults(partidos as OverlayPartido[] | null);
  const data = dedupeClasif((rawClasif ?? []) as { equipo: string; id_equipo: number | null }[], (partidos ?? []) as { equipo_local: string | null; equipo_visit: string | null }[]);
  // Sets de cada pareja (actas): con ellos se calcula la clasificación provisional.
  const { data: actasRows } = await rawFrom('fcp_actas')
    .select('equipo_local, equipo_visit, sets_local, sets_visit, parciales')
    .eq('id_grupo', idGrupo);
  const resolve = makeTeamResolver(((data ?? []) as { equipo: string }[]).map((x) => x.equipo));
  const stats = new Map<string, { pj: number; pg: number }>();
  // Resultados por equipo en orden cronológico → racha (últimos 5).
  const streak = new Map<string, ('V' | 'D')[]>();
  for (const p of remapTeams((partidos ?? []) as {
    equipo_local: string | null;
    equipo_visit: string | null;
    ganador: string | null;
    estado: string | null;
    jornada: number | null;
    resultado: string | null;
    tipo: string | null;
  }[], resolve)) {
    if (p.estado !== 'jugado') continue;
    const sides: [string | null, boolean][] = [
      [p.equipo_local, true],
      [p.equipo_visit, false],
    ];
    for (const [name, isLocal] of sides) {
      if (!name) continue;
      const s = stats.get(name) ?? { pj: 0, pg: 0 };
      s.pj += 1;
      const won = (p.ganador === 'local' && isLocal) || (p.ganador === 'visitante' && !isLocal);
      const decided = p.ganador === 'local' || p.ganador === 'visitante';
      if (won) s.pg += 1;
      stats.set(name, s);
      if (decided) {
        const f = streak.get(name) ?? [];
        f.push(won ? 'V' : 'D');
        streak.set(name, f);
      }
    }
  }

  const rows: FcpBrowseStanding[] = (
    (data ?? []) as {
      posicion: number | null;
      equipo: string;
      id_equipo: number | null;
      puntos: number | null;
      sets_favor: number | null;
      sets_contra: number | null;
    }[]
  ).map((r) => {
    const s = stats.get(r.equipo) ?? { pj: 0, pg: 0 };
    return {
      posicion: r.posicion,
      equipo: r.equipo,
      idEquipo: r.id_equipo,
      puntos: r.puntos,
      setsFavor: r.sets_favor,
      setsContra: r.sets_contra,
      pj: s.pj,
      pg: s.pg,
      form: (streak.get(r.equipo) ?? []).slice(-5),
      stats: EMPTY_STATS,
    };
  });

  // ── Clasificación PROVISIONAL ─────────────────────────────────────────────
  // La de la Federación tarda en actualizarse. Mientras vaya por detrás de lo ya jugado, se calcula con
  // los resultados y las actas (2 puntos por victoria, 1 por empate) y se marca como provisional: en
  // cuanto la Federación la suba, manda la suya.
  const calc = provisionalCalc(
    rows.map((x) => x.equipo),
    remapTeams((partidos ?? []) as PartidoCalc[], resolve),
    remapTeams((actasRows ?? []) as ActaCalc[], resolve),
  );
  const offTotal = rows.reduce((n, x) => n + (x.puntos ?? 0), 0);
  const calcTotal = [...calc.values()].reduce((n, x) => n + x.puntos, 0);
  let provisional = false;
  if (calcTotal > offTotal) {
    provisional = true;
    for (const x of rows) {
      const c = calc.get(x.equipo);
      x.puntos = c?.puntos ?? 0;
      x.setsFavor = c?.sf ?? 0;
      x.setsContra = c?.sc ?? 0;
    }
    // Desempate como la Federación: puntos, average de sets y average de juegos (suma de los parciales).
    const gd = new Map<string, number>();
    for (const a of remapTeams((actasRows ?? []) as (ActaCalc & { parciales: string | null })[], resolve)) {
      const [jl, jv] = juegosDe(a.parciales);
      if (a.equipo_local) gd.set(a.equipo_local, (gd.get(a.equipo_local) ?? 0) + jl - jv);
      if (a.equipo_visit) gd.set(a.equipo_visit, (gd.get(a.equipo_visit) ?? 0) + jv - jl);
    }
    rows.sort(
      (a, b) =>
        (b.puntos ?? 0) - (a.puntos ?? 0) ||
        (b.setsFavor ?? 0) - (b.setsContra ?? 0) - ((a.setsFavor ?? 0) - (a.setsContra ?? 0)) ||
        (gd.get(b.equipo) ?? 0) - (gd.get(a.equipo) ?? 0) ||
        a.equipo.localeCompare(b.equipo),
    );
    rows.forEach((x, i) => {
      x.posicion = i + 1;
    });
  }

  // Tabla completa (como la Federación): enfrentamientos, partidos, sets y juegos, con las actas.
  const tstats = new Map<string, GroupTeamStats>();
  const st = (e: string) => {
    let v = tstats.get(e);
    if (!v) tstats.set(e, (v = { ...EMPTY_STATS }));
    return v;
  };
  for (const a of remapTeams((actasRows ?? []) as (ActaCalc & { parciales: string | null })[], resolve)) {
    if (!a.equipo_local || !a.equipo_visit || a.sets_local == null || a.sets_visit == null) continue;
    const [jl, jv] = juegosDe(a.parciales);
    const l = st(a.equipo_local);
    const v = st(a.equipo_visit);
    l.pj += 1; v.pj += 1;
    if (a.sets_local > a.sets_visit) l.pg += 1;
    else if (a.sets_visit > a.sets_local) v.pg += 1;
    l.sf += a.sets_local; l.sc += a.sets_visit; l.jf += jl; l.jc += jv;
    v.sf += a.sets_visit; v.sc += a.sets_local; v.jf += jv; v.jc += jl;
  }
  for (const x of rows) x.stats = { ...(tstats.get(x.equipo) ?? EMPTY_STATS), enf: x.pj };

  const { data: g } = await rawFrom('fcp_grupos')
    .select('nombre, genero')
    .eq('id_grupo', idGrupo)
    .maybeSingle();
  const gi = g as { nombre: string | null; genero: string | null } | null;
  return { nombre: gi?.nombre ?? null, genero: gi?.genero ?? null, rows, provisional };
}


/** Clave de comparación de un nombre de equipo: mayúsculas, sin tildes ni signos. */
function teamNameKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * En los partidos el equipo lleva el patrocinador («G6 C-HIJAS DE ANA») y en la clasificación no («G6 C»).
 * Devuelve una función que lleva el nombre del partido al de la clasificación: mismo nombre, o el de la
 * clasificación como inicio del otro (palabra entera). Gana el nombre más largo que encaje.
 */
export function makeTeamResolver(equipos: string[]) {
  const keys = equipos.map((e) => ({ e, k: teamNameKey(e) })).sort((a, b) => b.k.length - a.k.length);
  const cache = new Map<string, string>();
  return (name: string | null): string | null => {
    if (!name) return name;
    const hit = cache.get(name);
    if (hit !== undefined) return hit;
    const k = teamNameKey(name);
    const found = keys.find((x) => k === x.k || k.startsWith(x.k + ' '));
    const out = found ? found.e : name;
    cache.set(name, out);
    return out;
  };
}

function remapTeams<T extends { equipo_local: string | null; equipo_visit: string | null }>(
  arr: T[],
  resolve: (n: string | null) => string | null,
): T[] {
  return arr.map((p) => ({ ...p, equipo_local: resolve(p.equipo_local), equipo_visit: resolve(p.equipo_visit) }));
}

type PartidoCalc = {
  equipo_local: string | null;
  equipo_visit: string | null;
  estado: string | null;
  resultado: string | null;
  tipo: string | null;
};
type ActaCalc = {
  equipo_local: string | null;
  equipo_visit: string | null;
  sets_local: number | null;
  sets_visit: number | null;
};

/** Resultado «a/b» o «a-b» → [a, b]. */
export function parseMarcador(resultado: string | null | undefined): [number, number] | null {
  const m = (resultado ?? '').match(/^\s*(\d+)\s*[/\-]\s*(\d+)\s*$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Puntos / partidos / sets de cada equipo a partir de lo jugado (fase regular). */
function provisionalCalc(equipos: string[], partidos: PartidoCalc[], actas: ActaCalc[]) {
  const m = new Map<string, { puntos: number; pf: number; pc: number; sf: number; sc: number }>();
  for (const e of equipos) m.set(e, { puntos: 0, pf: 0, pc: 0, sf: 0, sc: 0 });
  for (const p of partidos) {
    if (p.estado !== 'jugado' || (p.tipo && /play/i.test(p.tipo))) continue;
    const sc = parseMarcador(p.resultado);
    const l = p.equipo_local ? m.get(p.equipo_local) : undefined;
    const v = p.equipo_visit ? m.get(p.equipo_visit) : undefined;
    if (!sc || !l || !v) continue;
    l.pf += sc[0];
    l.pc += sc[1];
    v.pf += sc[1];
    v.pc += sc[0];
    // Puntos de la Federación (comprobado en la liga 2026/27): con 5 parejas, victoria = 1; con 4 parejas, victoria = 2 y empate = 1.
    const win = (sc[0] + sc[1]) % 2 === 1 ? 1 : 2;
    if (sc[0] > sc[1]) l.puntos += win;
    else if (sc[1] > sc[0]) v.puntos += win;
    else {
      l.puntos += 1;
      v.puntos += 1;
    }
  }
  for (const a of actas) {
    const l = a.equipo_local ? m.get(a.equipo_local) : undefined;
    const v = a.equipo_visit ? m.get(a.equipo_visit) : undefined;
    if (l) {
      l.sf += a.sets_local ?? 0;
      l.sc += a.sets_visit ?? 0;
    }
    if (v) {
      v.sf += a.sets_visit ?? 0;
      v.sc += a.sets_local ?? 0;
    }
  }
  return m;
}

export interface FcpBrowseMatch {
  idPartido: string;
  jornada: number | null;
  local: string;
  visit: string;
  resultado: string | null;
  ganador: string | null;
  fecha: string | null;
  hora: string | null;
  /** Tandas de la Federación («2-2»). */
  tandas: string | null;
  /** Sede, sacada del texto de la Federación («24 Oct 11:00 Tandas:2-2  Move and go Santander»). */
  sede: string | null;
}

/** La sede es lo que sigue a «Tandas:x-y» en el texto de la Federación. */
function sedeDeRango(rango: string | null): string | null {
  const m = (rango ?? '').match(/Tandas:\s*\S+\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/** Jornadas (calendario) de un grupo. */
export async function fetchGroupSchedule(idGrupo: string): Promise<FcpBrowseMatch[]> {
  const { data } = await rawFrom('fcp_partidos')
    .select('id_partido, jornada, equipo_local, equipo_visit, resultado, ganador, fecha, hora, orden_tandas, fecha_rango')
    .eq('id_grupo', idGrupo)
    .order('jornada', { ascending: true });
  return ((data ?? []) as {
    id_partido: string;
    jornada: number | null;
    equipo_local: string | null;
    equipo_visit: string | null;
    resultado: string | null;
    ganador: string | null;
    fecha: string | null;
    hora: string | null;
    orden_tandas: string | null;
    fecha_rango: string | null;
  }[]).map((r) => ({
    tandas: r.orden_tandas,
    sede: sedeDeRango(r.fecha_rango),
    idPartido: r.id_partido,
    jornada: r.jornada,
    local: r.equipo_local ?? '',
    visit: r.equipo_visit ?? '',
    resultado: r.resultado,
    ganador: r.ganador,
    fecha: r.fecha,
    hora: r.hora,
  }));
}

// ─── META DE GRUPOS (para la lista de "Explorar") ──────────────────────────────
// Enriquece cada grupo con nº de equipos, progreso de jornadas y estado, en dos
// consultas por lote (no N+1). `live` (EN JUEGO) sólo se marca si el grupo tiene
// un partido HOY sin resultado — señal honesta, no un "en curso" genérico.

export type FcpGroupState = 'finalizada' | 'en_curso' | 'sin_datos';

export interface FcpGroupMeta {
  equiposCount: number;
  jornadaActual: number; // última jornada con algún partido jugado
  jornadaTotal: number; // jornadas programadas
  estado: FcpGroupState;
  live: boolean;
}

const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Meta de varios grupos a la vez. Devuelve un mapa idGrupo → meta. */
export async function fetchFcpGroupMetas(
  idGrupos: string[],
): Promise<Map<string, FcpGroupMeta>> {
  const out = new Map<string, FcpGroupMeta>();
  if (idGrupos.length === 0) return out;

  const [{ data: cls }, { data: parts }] = await Promise.all([
    rawFrom('fcp_clasificacion').select('id_grupo').in('id_grupo', idGrupos),
    rawFrom('fcp_partidos')
      .select('id_grupo, jornada, estado, fecha')
      .in('id_grupo', idGrupos),
  ]);

  const counts = new Map<string, number>();
  for (const r of (cls ?? []) as { id_grupo: string }[]) {
    counts.set(r.id_grupo, (counts.get(r.id_grupo) ?? 0) + 1);
  }

  const today = todayISO();
  type Agg = { total: number; actual: number; live: boolean };
  const agg = new Map<string, Agg>();
  for (const p of (parts ?? []) as {
    id_grupo: string;
    jornada: number | null;
    estado: string | null;
    fecha: string | null;
  }[]) {
    const a = agg.get(p.id_grupo) ?? { total: 0, actual: 0, live: false };
    const j = p.jornada ?? 0;
    if (j > a.total) a.total = j;
    if (p.estado === 'jugado' && j > a.actual) a.actual = j;
    if (p.estado !== 'jugado' && (p.fecha ?? '').slice(0, 10) === today) a.live = true;
    agg.set(p.id_grupo, a);
  }

  for (const id of idGrupos) {
    const a = agg.get(id) ?? { total: 0, actual: 0, live: false };
    const estado: FcpGroupState =
      a.total > 0 && a.actual >= a.total
        ? 'finalizada'
        : a.actual > 0
        ? 'en_curso'
        : 'sin_datos';
    out.set(id, {
      equiposCount: counts.get(id) ?? 0,
      jornadaActual: a.actual,
      jornadaTotal: a.total,
      estado,
      live: a.live,
    });
  }
  return out;
}

// ─── Nombre de la temporada ──────────────────────────────────────────────────
// La FCP mezcla dos formas de nombrar sus ligas: las de años anteriores llevan
// un año suelto («2026») y la nueva un curso («2026/2027»). Pero la liga se
// juega de otoño a primavera, así que ese año suelto es el año en que ACABA: lo
// que la Federación llama «2026» es la temporada 2025/2026 — los partidos con
// fecha de esa liga caen en abril y mayo de 2026.
//
// Sin traducir, en la app convivirían «2026» y «2026/2027» como si fueran
// consecutivas, cuando en realidad significan lo mismo en dos idiomas. Aquí se
// pasa todo a curso para que se lean igual. Es solo presentación: el valor
// guardado sigue siendo el de la Federación, que es el que ordena y hace de
// clave.

/** Temporada como la nombran los clubes: «2026» → «2025/2026». */
export const seasonLabel = (temporada: string | null | undefined): string => {
  const t = (temporada ?? '').trim();
  const rango = t.match(/^(\d{4})\s*[/-]\s*(\d{2,4})$/);
  if (rango) {
    const fin = rango[2].length === 2 ? `20${rango[2]}` : rango[2];
    return `${rango[1]}/${fin}`;
  }
  const anio = t.match(/^(\d{4})$/);
  if (anio) return `${Number(anio[1]) - 1}/${anio[1]}`;
  return t;
};

/** La misma, en corto para chips y listas: «2025/2026» → «25/26». */
export const seasonShort = (temporada: string | null | undefined): string => {
  const full = seasonLabel(temporada);
  const m = full.match(/^(\d{4})\/(\d{4})$/);
  return m ? `${m[1].slice(2)}/${m[2].slice(2)}` : full;
};

// ─── Categoría en periodo de inscripción ─────────────────────────────────────

export interface FcpInscritoEnGrupo {
  idEquipo: number;
  equipo: string;
  confirmado: boolean;
  sede: string | null;
  /** Sede en corto («SMASH», «GO FIT»), como la escribe el PDF de la FCP. */
  sedeCorta: string | null;
  /** Grupo dentro de la categoría ('A' | 'B' | …). Null hasta que la
   *  Federación publica la distribución. */
  subgrupo: string | null;
  /** Jugadores ya dados de alta. Muchos equipos se apuntan antes de tener
   *  plantilla, así que el cero es información, no un fallo. */
  jugadores: number;
}

/**
 * Equipos apuntados a una categoría de la liga que aún no ha empezado.
 *
 * Esa liga no tiene clasificación ni calendario —no hay partidos—, así que la
 * pantalla de grupo no tenía nada que enseñar y salían dos pestañas vacías.
 * Esto es lo que sí existe. Cuando la Federación reparte la categoría en
 * grupos (`subgrupo`), las filas que se quedaron sin él son inscripciones
 * viejas que ya no publica y se descartan.
 */
export async function fetchGroupInscritos(idGrupo: string): Promise<FcpInscritoEnGrupo[]> {
  const { data } = await rawFrom('fcp_inscripciones')
    .select('id_equipo, equipo, confirmado, sede, sede_corta, subgrupo, num')
    .eq('id_grupo', idGrupo)
    .order('num', { ascending: true });
  const todas = (data ?? []) as {
    id_equipo: number;
    equipo: string | null;
    confirmado: boolean | null;
    sede: string | null;
    sede_corta: string | null;
    subgrupo: string | null;
  }[];
  const conSubgrupos = todas.some((r) => !!r.subgrupo);
  const rows = conSubgrupos ? todas.filter((r) => !!r.subgrupo) : todas;
  if (rows.length === 0) return [];

  // Cuántos jugadores tiene ya cada uno. Una sola consulta para toda la lista.
  const { data: jug } = await rawFrom('fcp_jugadores')
    .select('id_equipo')
    .in('id_equipo', rows.map((r) => r.id_equipo))
    .limit(5000);
  const cuenta = new Map<number, number>();
  for (const j of (jug ?? []) as { id_equipo: number }[]) {
    cuenta.set(j.id_equipo, (cuenta.get(j.id_equipo) ?? 0) + 1);
  }

  return rows.map((r) => ({
    idEquipo: r.id_equipo,
    equipo: r.equipo ?? '—',
    confirmado: !!r.confirmado,
    sede: r.sede,
    sedeCorta: r.sede_corta ?? null,
    subgrupo: r.subgrupo ?? null,
    jugadores: cuenta.get(r.id_equipo) ?? 0,
  }));
}
