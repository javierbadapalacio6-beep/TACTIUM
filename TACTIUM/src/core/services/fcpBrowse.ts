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
}

/** Años/ligas con datos reales (los que tienen grupos scrapeados). */
export async function fetchFcpYears(): Promise<FcpYear[]> {
  const { data: grupos } = await rawFrom('fcp_grupos').select('id_liga');
  const withData = new Set(((grupos ?? []) as { id_liga: number | null }[]).map((g) => g.id_liga));
  const { data: ligas } = await rawFrom('fcp_ligas').select('id_liga, temporada, nombre');
  return ((ligas ?? []) as { id_liga: number; temporada: string | null; nombre: string | null }[])
    .filter((l) => withData.has(l.id_liga))
    .map((l) => ({
      idLiga: l.id_liga,
      temporada: l.temporada ?? '',
      nombre: l.nombre ?? `Liga ${l.id_liga}`,
    }))
    .sort((a, b) => b.temporada.localeCompare(a.temporada));
}

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
