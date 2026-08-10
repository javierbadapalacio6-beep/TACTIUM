// Perfiles federativos (Federación Cántabra): detalle de un equipo (plantilla +
// estadísticas del grupo) y de un jugador (puntos + partidos jugados/ganados
// derivados de las actas). Ver [[tactium_fcp_federation_integration]].
import { supabase } from '@core/supabase/client';
import { resolveMainGroup } from './fcpSeason';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface JugRow {
  id_jugador: string;
  nombre_pila?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  nombre?: string | null;
  puntos?: number | null;
  categoria?: string | null;
  id_equipo?: number | null;
  nombre_equipo?: string | null;
}

function displayName(r: JugRow): string {
  const n = [r.nombre_pila, r.apellido1, r.apellido2]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return n || (r.nombre ?? 'Jugador');
}
// Nombre tal como aparece en el acta: "nombre_pila apellido1".
function actaName(r: JugRow): string {
  return `${(r.nombre_pila ?? '').trim()} ${(r.apellido1 ?? '').trim()}`.trim();
}
const pair = (a: string | null, b: string | null) =>
  [a, b].filter(Boolean).join(' / ') || '—';

// ─── EQUIPO ───────────────────────────────────────────────────────────────────

export interface FcpRosterPlayer {
  idJugador: string;
  name: string;
  puntos: number;
  categoria: string | null;
}
export interface FcpTeamProfile {
  idEquipo: number;
  equipo: string;
  grupo: string | null;
  posicion: number | null;
  puntos: number; // puntos de clasificación
  pj: number;
  pg: number;
  pp: number;
  setsFavor: number;
  setsContra: number;
  roster: FcpRosterPlayer[];
}

export async function fetchFcpTeamProfile(idEquipo: number): Promise<FcpTeamProfile | null> {
  const main = await resolveMainGroup(idEquipo);
  if (!main) return null;
  const grupoId = main.id_grupo;
  const equipo = main.equipo;

  const { data: cls } = await rawFrom('fcp_clasificacion')
    .select('posicion, puntos, sets_favor, sets_contra')
    .eq('id_equipo', idEquipo)
    .eq('id_grupo', grupoId)
    .maybeSingle();

  const { data: partidos } = await rawFrom('fcp_partidos')
    .select('equipo_local, equipo_visit, ganador, estado')
    .eq('id_grupo', grupoId);
  let pj = 0,
    pg = 0,
    pp = 0;
  for (const p of (partidos ?? []) as {
    equipo_local: string | null;
    equipo_visit: string | null;
    ganador: string | null;
    estado: string | null;
  }[]) {
    if (p.estado !== 'jugado') continue;
    const isLocal = p.equipo_local === equipo;
    const isVisit = p.equipo_visit === equipo;
    if (!isLocal && !isVisit) continue;
    pj += 1;
    const won =
      (p.ganador === 'local' && isLocal) || (p.ganador === 'visitante' && isVisit);
    if (won) pg += 1;
    else if (p.ganador === 'local' || p.ganador === 'visitante') pp += 1;
  }

  const { data: g } = await rawFrom('fcp_grupos')
    .select('nombre')
    .eq('id_grupo', grupoId)
    .maybeSingle();

  const { data: jug } = await rawFrom('fcp_jugadores')
    .select('id_jugador, nombre_pila, apellido1, apellido2, nombre, puntos, categoria')
    .eq('id_equipo', idEquipo)
    .order('puntos', { ascending: false, nullsFirst: false });
  const roster: FcpRosterPlayer[] = ((jug ?? []) as JugRow[]).map((r) => ({
    idJugador: r.id_jugador,
    name: displayName(r),
    puntos: r.puntos ?? 0,
    categoria: r.categoria ?? null,
  }));

  const c = cls as
    | { posicion: number | null; puntos: number | null; sets_favor: number | null; sets_contra: number | null }
    | null;
  return {
    idEquipo,
    equipo,
    grupo: g ? ((g as { nombre: string }).nombre ?? null) : null,
    posicion: c?.posicion ?? null,
    puntos: c?.puntos ?? 0,
    pj,
    pg,
    pp,
    setsFavor: c?.sets_favor ?? 0,
    setsContra: c?.sets_contra ?? 0,
    roster,
  };
}

// ─── JUGADOR ──────────────────────────────────────────────────────────────────

export interface FcpPlayerMatch {
  myPair: string;
  partner: string | null; // solo el COMPAÑERO (no el jugador que se está viendo)
  rivalPair: string;
  parciales: string | null;
  sets: string; // "2-0" en mi perspectiva
  won: boolean;
  jornada: number | null; // para ordenar cronológicamente (null en playoff)
  esPlayoff: boolean;
}
export interface FcpPlayerProfile {
  idJugador: string;
  name: string;
  equipo: string | null;
  categoria: string | null;
  puntos: number;
  pj: number;
  pg: number;
  pp: number;
  setsFor: number;
  setsAgainst: number;
  hasActaData: boolean; // false si su grupo aún no tiene actas scrapeadas
  matches: FcpPlayerMatch[];
}

export async function fetchFcpPlayerProfile(idJugador: string): Promise<FcpPlayerProfile | null> {
  const { data: jRaw } = await rawFrom('fcp_jugadores')
    .select('id_jugador, nombre_pila, apellido1, apellido2, nombre, puntos, categoria, id_equipo, nombre_equipo')
    .eq('id_jugador', idJugador)
    .maybeSingle();
  const j = jRaw as JugRow | null;
  if (!j) return null;

  const target = norm(actaName(j));
  const main = j.id_equipo != null ? await resolveMainGroup(j.id_equipo) : null;

  let pj = 0,
    pg = 0,
    pp = 0,
    setsFor = 0,
    setsAgainst = 0,
    hasActaData = false;
  const matches: FcpPlayerMatch[] = [];

  if (main) {
    const { data: actas } = await rawFrom('fcp_actas')
      .select('local_j1, local_j2, visit_j1, visit_j2, sets_local, sets_visit, parciales')
      .eq('id_grupo', main.id_grupo);
    const rows = (actas ?? []) as {
      local_j1: string | null;
      local_j2: string | null;
      visit_j1: string | null;
      visit_j2: string | null;
      sets_local: number | null;
      sets_visit: number | null;
      parciales: string | null;
    }[];
    hasActaData = rows.length > 0;
    for (const a of rows) {
      const localHas = norm(a.local_j1) === target || norm(a.local_j2) === target;
      const visitHas = norm(a.visit_j1) === target || norm(a.visit_j2) === target;
      if (!localHas && !visitHas) continue;
      pj += 1;
      const sl = a.sets_local ?? 0;
      const sv = a.sets_visit ?? 0;
      const mine = localHas ? sl : sv;
      const other = localHas ? sv : sl;
      setsFor += mine;
      setsAgainst += other;
      const won = mine > other;
      if (won) pg += 1;
      else pp += 1;
      matches.push({
        myPair: localHas ? pair(a.local_j1, a.local_j2) : pair(a.visit_j1, a.visit_j2),
        partner: null,
        rivalPair: localHas ? pair(a.visit_j1, a.visit_j2) : pair(a.local_j1, a.local_j2),
        parciales: a.parciales,
        sets: `${mine}-${other}`,
        won,
        jornada: null,
        esPlayoff: false,
      });
    }
  }

  return {
    idJugador,
    name: displayName(j),
    equipo: j.nombre_equipo ?? null,
    categoria: j.categoria ?? null,
    puntos: j.puntos ?? 0,
    pj,
    pg,
    pp,
    setsFor,
    setsAgainst,
    hasActaData,
    matches,
  };
}

// ─── HISTÓRICO POR AÑO ────────────────────────────────────────────────────────

export interface FcpYearStats {
  anio: number;
  categoria: string | null;
  pj: number;
  pg: number;
  pp: number;
  puntosFin: number | null;
  variacion: number; // suma de las variaciones de puntos del año
}
export interface FcpHistMatch {
  anio: number | null;
  jornada: string | null;
  fecha: string | null;
  categoria: string | null;
  gana: boolean;
  puntosVar: number | null;
  equipoJuega: string | null; // el equipo del jugador
  equipoRival: string | null; // equipo rival
  pareja: string | null; // compañero
  rivales: string | null; // pareja rival
  resultado: string | null;
  isLocal: boolean | null; // condición (derivada de fcp_partidos); null si no se pudo determinar
  esPlayoff: boolean; // tipo: liga vs playoff (derivado de la categoría)
}
export interface FcpPlayerHistory {
  years: FcpYearStats[]; // más reciente primero
  matches: FcpHistMatch[]; // todos los partidos (cronológico inverso)
}

const topKey = (m: Map<string, number>): string | null => {
  let best: string | null = null;
  let bestN = -1;
  m.forEach((n, k) => {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  });
  return best;
};

/** Trayectoria por año del jugador (todos los años que la Federación registra),
 * derivada de fcp_historico. Vacío si aún no se ha scrapeado su histórico. */
export async function fetchFcpPlayerHistory(idJugador: string): Promise<FcpPlayerHistory> {
  const { data: jRaw } = await rawFrom('fcp_jugadores')
    .select('nombre_pila, apellido1, apellido2, nombre')
    .eq('id_jugador', idJugador)
    .maybeSingle();
  const j = jRaw as JugRow | null;
  if (!j) return { years: [], matches: [] };
  const full = [j.nombre_pila, j.apellido1, j.apellido2].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
  if (!full) return { years: [], matches: [] };

  const { data: rk } = await rawFrom('fcp_rankings')
    .select('id_fcp')
    .not('id_fcp', 'is', null)
    .ilike('nombre', full)
    .limit(1)
    .maybeSingle();
  const idFcp = rk ? (rk as { id_fcp: number }).id_fcp : null;
  if (idFcp == null) return { years: [], matches: [] };

  const { data: rows } = await rawFrom('fcp_historico')
    .select('anio, jornada, fecha, categoria, gana, puntos_fin, puntos_var, equipo, equipo_rival, pareja, rivales, resultado')
    .eq('id_fcp', idFcp)
    .order('seq', { ascending: true });

  // Playoff = categorías con rango de posiciones ("5º al 8º", "23º - 24º") u ORO/PLATA.
  const esPlayoff = (cat: string | null) =>
    /\d+º\s*(al\b|-)/i.test(cat ?? '') || /\b(ORO|PLATA)\b/i.test(cat ?? '');

  type Acc = { pj: number; pg: number; cat: Map<string, number>; lastFin: number | null; varSum: number };
  const byYear = new Map<number, Acc>();
  const matches: FcpHistMatch[] = [];
  // La web de la FCP a veces lista cada partido duplicado → dedupe defensivo.
  const seenH = new Set<string>();
  for (const r of (rows ?? []) as {
    anio: number | null;
    jornada: string | null;
    fecha: string | null;
    categoria: string | null;
    gana: boolean | null;
    puntos_fin: number | null;
    puntos_var: number | null;
    equipo: string | null;
    equipo_rival: string | null;
    pareja: string | null;
    rivales: string | null;
    resultado: string | null;
  }[]) {
    const dk = [r.jornada, r.fecha, r.categoria, r.equipo, r.equipo_rival, r.rivales, r.resultado, r.gana].join('|');
    if (seenH.has(dk)) continue;
    seenH.add(dk);
    matches.push({
      anio: r.anio,
      jornada: r.jornada,
      fecha: r.fecha,
      categoria: r.categoria,
      gana: !!r.gana,
      puntosVar: r.puntos_var,
      equipoJuega: r.equipo,
      equipoRival: r.equipo_rival,
      pareja: r.pareja,
      rivales: r.rivales,
      resultado: r.resultado,
      isLocal: null,
      esPlayoff: esPlayoff(r.categoria),
    });
    if (r.anio == null) continue;
    let e = byYear.get(r.anio);
    if (!e) {
      e = { pj: 0, pg: 0, cat: new Map(), lastFin: null, varSum: 0 };
      byYear.set(r.anio, e);
    }
    e.pj += 1;
    if (r.gana) e.pg += 1;
    if (r.categoria) e.cat.set(r.categoria, (e.cat.get(r.categoria) ?? 0) + 1);
    if (r.puntos_fin != null) e.lastFin = r.puntos_fin;
    e.varSum += r.puntos_var ?? 0;
  }

  // Condición (local/visitante): no está en el histórico → se cruza con
  // fcp_partidos por (jornada + par de equipos).
  const equipos = [...new Set(matches.map((m) => m.equipoJuega).filter((x): x is string => !!x))];
  if (equipos.length) {
    const pairKey = (a: string, b: string, j: string | number | null) =>
      `${j ?? ''}|${[norm(a), norm(b)].sort().join('~')}`;
    const [loc, vis] = await Promise.all([
      rawFrom('fcp_partidos').select('jornada, equipo_local, equipo_visit').in('equipo_local', equipos),
      rawFrom('fcp_partidos').select('jornada, equipo_local, equipo_visit').in('equipo_visit', equipos),
    ]);
    const localOf = new Map<string, string>();
    for (const p of [...(loc.data ?? []), ...(vis.data ?? [])] as {
      jornada: number | null;
      equipo_local: string | null;
      equipo_visit: string | null;
    }[]) {
      if (!p.equipo_local || !p.equipo_visit) continue;
      localOf.set(pairKey(p.equipo_local, p.equipo_visit, p.jornada), p.equipo_local);
    }
    for (const m of matches) {
      if (!m.equipoJuega || !m.equipoRival) continue;
      const local = localOf.get(pairKey(m.equipoJuega, m.equipoRival, m.jornada));
      if (local != null) m.isLocal = norm(local) === norm(m.equipoJuega);
    }
  }

  const years: FcpYearStats[] = [...byYear.entries()]
    .map(([anio, e]) => ({
      anio,
      categoria: topKey(e.cat),
      pj: e.pj,
      pg: e.pg,
      pp: e.pj - e.pg,
      puntosFin: e.lastFin,
      variacion: e.varSum,
    }))
    .sort((a, b) => b.anio - a.anio);

  matches.reverse(); // más reciente primero
  return { years, matches };
}

// ─── TRAYECTORIA MULTI-AÑO (equipo · categoría · puntos por temporada) ─────────
// El histórico por jugador de la FCP solo da la temporada actual, pero
// fcp_jugadores tiene al jugador en cada liga scrapeada → reconstruimos su paso
// por años: en qué equipo jugó, categoría y puntos de esa temporada.

export interface FcpPlayerYearTeam {
  anio: string; // "2026"
  idLiga: number;
  equipo: string | null;
  categoria: string | null; // "2ª Masc"
  puntos: number;
}

const shortCatFromGroup = (nombre: string | null): string | null => {
  if (!nombre) return null;
  const m = nombre.match(/(\d+)\s*ª/);
  const g = /FEM/i.test(nombre) ? 'Fem' : /MASC/i.test(nombre) ? 'Masc' : '';
  const cat = m ? `${m[1]}ª` : '';
  return [cat, g].filter(Boolean).join(' ') || null;
};

export async function fetchFcpPlayerYears(idJugador: string): Promise<FcpPlayerYearTeam[]> {
  const { data: jRaw } = await rawFrom('fcp_jugadores')
    .select('nombre_pila, apellido1, apellido2')
    .eq('id_jugador', idJugador)
    .maybeSingle();
  const j = jRaw as JugRow | null;
  if (!j || !j.nombre_pila || !j.apellido1) return [];

  const { data: rowsRaw } = await rawFrom('fcp_jugadores')
    .select('id_liga, id_equipo, nombre_equipo, apellido2, puntos')
    .eq('nombre_pila', j.nombre_pila)
    .eq('apellido1', j.apellido1);
  const rows = ((rowsRaw ?? []) as {
    id_liga: number;
    id_equipo: number | null;
    nombre_equipo: string | null;
    apellido2: string | null;
    puntos: number | null;
  }[]).filter((r) => (r.apellido2 ?? '') === (j.apellido2 ?? ''));
  if (rows.length === 0) return [];

  // Año por liga.
  const { data: ligas } = await rawFrom('fcp_ligas').select('id_liga, temporada');
  const yearOf = new Map(
    ((ligas ?? []) as { id_liga: number; temporada: string | null }[]).map((l) => [
      l.id_liga,
      l.temporada ?? '',
    ]),
  );

  // Categoría del equipo por año: id_equipo → grupo regular → nombre → "Nª Gen".
  const equipos = [...new Set(rows.map((r) => r.id_equipo).filter((x): x is number => x != null))];
  const catByEquipo = new Map<number, string | null>();
  if (equipos.length) {
    const { data: cls } = await rawFrom('fcp_clasificacion')
      .select('id_equipo, id_grupo')
      .in('id_equipo', equipos);
    const grupoByEq = new Map<number, string>();
    for (const cRow of (cls ?? []) as { id_equipo: number; id_grupo: string }[]) {
      if (/^fase/i.test(cRow.id_grupo)) continue;
      if (!grupoByEq.has(cRow.id_equipo)) grupoByEq.set(cRow.id_equipo, cRow.id_grupo);
    }
    const grupos = [...new Set([...grupoByEq.values()])];
    const catByGrupo = new Map<string, string | null>();
    if (grupos.length) {
      const { data: gr } = await rawFrom('fcp_grupos').select('id_grupo, nombre').in('id_grupo', grupos);
      for (const g of (gr ?? []) as { id_grupo: string; nombre: string | null }[]) {
        catByGrupo.set(g.id_grupo, shortCatFromGroup(g.nombre));
      }
    }
    for (const [eq, grp] of grupoByEq) catByEquipo.set(eq, catByGrupo.get(grp) ?? null);
  }

  const byLiga = new Map<number, FcpPlayerYearTeam>();
  for (const r of rows) {
    const anio = yearOf.get(r.id_liga);
    if (!anio) continue;
    const cand: FcpPlayerYearTeam = {
      anio,
      idLiga: r.id_liga,
      equipo: r.nombre_equipo ?? null,
      categoria: r.id_equipo != null ? catByEquipo.get(r.id_equipo) ?? null : null,
      puntos: r.puntos ?? 0,
    };
    const cur = byLiga.get(r.id_liga);
    if (!cur || cand.puntos > cur.puntos) byLiga.set(r.id_liga, cand);
  }
  return [...byLiga.values()].sort((a, b) => b.anio.localeCompare(a.anio));
}

// Partidos individuales + stats de un jugador en un AÑO concreto, derivados de
// fcp_actas de esa liga (casando por nombre). Requiere que las actas de ese año
// estén scrapeadas; si no, devuelve vacío.
export interface FcpPlayerYearMatches {
  matches: FcpPlayerMatch[];
  pj: number;
  pg: number;
  pp: number;
  setsFor: number;
  setsAgainst: number;
  hasData: boolean; // ¿hay actas de ese año en general? (para distinguir "sin datos aún")
}

export async function fetchFcpPlayerYearMatches(
  idJugador: string,
  idLiga: number,
): Promise<FcpPlayerYearMatches> {
  const empty: FcpPlayerYearMatches = {
    matches: [],
    pj: 0,
    pg: 0,
    pp: 0,
    setsFor: 0,
    setsAgainst: 0,
    hasData: false,
  };
  const { data: jRaw } = await rawFrom('fcp_jugadores')
    .select('nombre_pila, apellido1')
    .eq('id_jugador', idJugador)
    .maybeSingle();
  const j = jRaw as JugRow | null;
  if (!j || !j.nombre_pila || !j.apellido1) return empty;
  const actaName = `${j.nombre_pila.trim()} ${j.apellido1.trim()}`;

  // ¿Hay actas de ese año? (una consulta ligera).
  const { data: any1 } = await rawFrom('fcp_actas').select('id_partido').eq('id_liga', idLiga).limit(1);
  const hasData = ((any1 ?? []) as unknown[]).length > 0;

  const cols =
    'id_partido, partido_num, local_j1, local_j2, visit_j1, visit_j2, sets_local, sets_visit, parciales';
  const bySlot = (col: string) =>
    rawFrom('fcp_actas').select(cols).eq('id_liga', idLiga).eq(col, actaName);
  const results = await Promise.all([
    bySlot('local_j1'),
    bySlot('local_j2'),
    bySlot('visit_j1'),
    bySlot('visit_j2'),
  ]);

  const seen = new Set<string>();
  const rows: {
    id_partido: string;
    partido_num: number;
    local_j1: string | null;
    local_j2: string | null;
    visit_j1: string | null;
    visit_j2: string | null;
    sets_local: number | null;
    sets_visit: number | null;
    parciales: string | null;
  }[] = [];
  for (const res of results) {
    for (const r of (res.data ?? []) as (typeof rows)[number][]) {
      const k = `${r.id_partido}|${r.partido_num}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(r);
    }
  }

  let pj = 0,
    pg = 0,
    setsFor = 0,
    setsAgainst = 0;
  const matches: FcpPlayerMatch[] = [];
  const baseIds: string[] = [];
  for (const a of rows) {
    const localHas = a.local_j1 === actaName || a.local_j2 === actaName;
    const sl = a.sets_local ?? 0;
    const sv = a.sets_visit ?? 0;
    const mine = localHas ? sl : sv;
    const other = localHas ? sv : sl;
    pj += 1;
    setsFor += mine;
    setsAgainst += other;
    const won = mine > other;
    if (won) pg += 1;
    const myPlayers = localHas ? [a.local_j1, a.local_j2] : [a.visit_j1, a.visit_j2];
    const partner = (myPlayers.find((x) => x && x !== actaName) ?? null) as string | null;
    baseIds.push(a.id_partido.replace(/_(ida|vuelta)$/i, ''));
    matches.push({
      myPair: localHas ? pair(a.local_j1, a.local_j2) : pair(a.visit_j1, a.visit_j2),
      partner,
      rivalPair: localHas ? pair(a.visit_j1, a.visit_j2) : pair(a.local_j1, a.local_j2),
      parciales: a.parciales,
      sets: `${mine}-${other}`,
      won,
      jornada: null,
      esPlayoff: /^fcp_playoff_/.test(a.id_partido),
    });
  }

  // Jornada de cada partido (desde fcp_partidos) para ordenar cronológicamente.
  const uniqIds = [...new Set(baseIds)];
  if (uniqIds.length) {
    const { data: parts } = await rawFrom('fcp_partidos').select('id_partido, jornada').in('id_partido', uniqIds);
    const jByPartido = new Map<string, number | null>(
      ((parts ?? []) as { id_partido: string; jornada: number | null }[]).map((p) => [p.id_partido, p.jornada]),
    );
    matches.forEach((m, i) => {
      m.jornada = jByPartido.get(baseIds[i]) ?? null;
    });
  }
  // Liga regular por jornada asc; el playoff (sin jornada) al final.
  matches.sort((a, b) => {
    const ja = a.jornada ?? 9999;
    const jb = b.jornada ?? 9999;
    if (ja !== jb) return ja - jb;
    return (a.esPlayoff ? 1 : 0) - (b.esPlayoff ? 1 : 0);
  });

  return { matches, pj, pg, pp: pj - pg, setsFor, setsAgainst, hasData };
}
