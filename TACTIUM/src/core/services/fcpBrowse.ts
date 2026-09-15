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

/** La que debe salir elegida de entrada: la que se juega, no la más nueva. */
export const defaultYear = (years: FcpYear[]): FcpYear | null =>
  years.find((y) => y.conCalendario) ?? years[0] ?? null;

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
}

/** Clasificación de un grupo (PJ/PG derivados de fcp_partidos). */
export async function fetchGroupStandings(
  idGrupo: string,
): Promise<{ nombre: string | null; rows: FcpBrowseStanding[] }> {
  const { data } = await rawFrom('fcp_clasificacion')
    .select('posicion, equipo, id_equipo, puntos, sets_favor, sets_contra')
    .eq('id_grupo', idGrupo)
    .order('posicion', { ascending: true });

  const { data: partidos } = await rawFrom('fcp_partidos')
    .select('equipo_local, equipo_visit, ganador, estado, jornada')
    .eq('id_grupo', idGrupo)
    .order('jornada', { ascending: true });
  const stats = new Map<string, { pj: number; pg: number }>();
  // Resultados por equipo en orden cronológico → racha (últimos 5).
  const streak = new Map<string, ('V' | 'D')[]>();
  for (const p of (partidos ?? []) as {
    equipo_local: string | null;
    equipo_visit: string | null;
    ganador: string | null;
    estado: string | null;
    jornada: number | null;
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
    };
  });

  const { data: g } = await rawFrom('fcp_grupos')
    .select('nombre')
    .eq('id_grupo', idGrupo)
    .maybeSingle();
  return { nombre: g ? ((g as { nombre: string }).nombre ?? null) : null, rows };
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
}

/** Jornadas (calendario) de un grupo. */
export async function fetchGroupSchedule(idGrupo: string): Promise<FcpBrowseMatch[]> {
  const { data } = await rawFrom('fcp_partidos')
    .select('id_partido, jornada, equipo_local, equipo_visit, resultado, ganador, fecha, hora')
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
  }[]).map((r) => ({
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
  /** Jugadores ya dados de alta. Muchos equipos se apuntan antes de tener
   *  plantilla, así que el cero es información, no un fallo. */
  jugadores: number;
}

/**
 * Equipos apuntados a una categoría de la liga que aún no ha empezado.
 *
 * Esa liga no tiene clasificación ni calendario —el sorteo no está hecho—, así
 * que la pantalla de grupo no tenía nada que enseñar y salían dos pestañas
 * vacías. Esto es lo que sí existe.
 */
export async function fetchGroupInscritos(idGrupo: string): Promise<FcpInscritoEnGrupo[]> {
  const { data } = await rawFrom('fcp_inscripciones')
    .select('id_equipo, equipo, confirmado, sede, num')
    .eq('id_grupo', idGrupo)
    .order('num', { ascending: true });
  const rows = (data ?? []) as {
    id_equipo: number;
    equipo: string | null;
    confirmado: boolean | null;
    sede: string | null;
  }[];
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
    jugadores: cuenta.get(r.id_equipo) ?? 0,
  }));
}
