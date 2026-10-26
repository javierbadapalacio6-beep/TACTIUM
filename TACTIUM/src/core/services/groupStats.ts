/**
 * Estadísticas de un grupo de la Federación, calculadas con las ACTAS (`fcp_actas`: los dos jugadores de cada
 * pareja, los sets y los parciales de cada partido). Sirve para: mejores parejas, mejores jugadores, rendimiento
 * por pista y local/visitante de un equipo frente a la media del grupo.
 */
import { supabase } from '@core/supabase/client';
import { makeTeamResolver } from './fcpBrowse';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

export interface ActaRow {
  id_partido: string | null;
  equipo_local: string | null;
  equipo_visit: string | null;
  partido_num: number | null;
  local_j1: string | null;
  local_j2: string | null;
  visit_j1: string | null;
  visit_j2: string | null;
  sets_local: number | null;
  sets_visit: number | null;
  parciales: string | null;
}

export async function fetchGroupActas(idGrupo: string): Promise<ActaRow[]> {
  const { data } = await rawFrom('fcp_actas')
    .select(
      'id_partido, equipo_local, equipo_visit, partido_num, local_j1, local_j2, visit_j1, visit_j2, sets_local, sets_visit, parciales',
    )
    .eq('id_grupo', idGrupo);
  return (data ?? []) as ActaRow[];
}

/** «GARTZEN OTAOLA» → «Gartzen Otaola». */
export function niceName(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 || !/^(de|la|el|del|y)$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function juegos(parciales: string | null | undefined): [number, number] {
  let a = 0;
  let b = 0;
  for (const m of (parciales ?? '').matchAll(/(\d+)\s*[/\-:]\s*(\d+)/g)) {
    a += Number(m[1]);
    b += Number(m[2]);
  }
  return [a, b];
}

export interface Record2 {
  pj: number;
  pg: number;
  sf: number;
  sc: number;
  jf: number;
  jc: number;
}
const zero = (): Record2 => ({ pj: 0, pg: 0, sf: 0, sc: 0, jf: 0, jc: 0 });
const add = (r: Record2, won: boolean, sf: number, sc: number, jf: number, jc: number) => {
  r.pj += 1;
  if (won) r.pg += 1;
  r.sf += sf;
  r.sc += sc;
  r.jf += jf;
  r.jc += jc;
};

export interface PairStat extends Record2 {
  team: string;
  a: string;
  b: string;
  /** Pistas en las que ha jugado (1 = la más fuerte). */
  courts: number[];
  /** Su registro en cada pista. */
  byCourt: Record<number, Record2>;
}
export interface PlayerStat extends Record2 {
  team: string;
  name: string;
}
export interface CourtStat extends Record2 {
  court: number;
}
export interface TeamSplit {
  home: Record2;
  away: Record2;
}

export interface GroupStats {
  pairs: PairStat[];
  players: PlayerStat[];
  /** Rendimiento por pista de cada equipo. */
  courtsByTeam: Map<string, CourtStat[]>;
  /** Media del grupo por pista (todos los equipos juntos). */
  courtsGroup: CourtStat[];
  splitByTeam: Map<string, TeamSplit>;
  /** Partidos (parejas) con acta. */
  total: number;
}

const rank = (a: Record2, b: Record2) =>
  b.pg / (b.pj || 1) - a.pg / (a.pj || 1) ||
  b.pg - a.pg ||
  b.sf - b.sc - (a.sf - a.sc) ||
  b.jf - b.jc - (a.jf - a.jc);

export function computeGroupStats(actas: ActaRow[], equipos: string[]): GroupStats {
  const resolve = makeTeamResolver(equipos);
  const pairs = new Map<string, PairStat>();
  const players = new Map<string, PlayerStat>();
  const courtsByTeam = new Map<string, Map<number, CourtStat>>();
  const courtsGroup = new Map<number, CourtStat>();
  const splitByTeam = new Map<string, TeamSplit>();
  let total = 0;

  const side = (
    team: string,
    j1: string | null,
    j2: string | null,
    court: number | null,
    home: boolean,
    won: boolean,
    sf: number,
    sc: number,
    jf: number,
    jc: number,
  ) => {
    const names = [j1, j2].filter((n): n is string => !!n && n.trim().length > 0).map((n) => n.trim());
    if (names.length === 2) {
      const sorted = [...names].sort();
      const key = `${team}|${sorted[0]}|${sorted[1]}`;
      let p = pairs.get(key);
      if (!p) pairs.set(key, (p = { ...zero(), team, a: sorted[0], b: sorted[1], courts: [], byCourt: {} }));
      add(p, won, sf, sc, jf, jc);
      if (court != null) {
        if (!p.courts.includes(court)) p.courts.push(court);
        add((p.byCourt[court] ??= zero()), won, sf, sc, jf, jc);
      }
    }
    for (const n of names) {
      const key = `${team}|${n}`;
      let pl = players.get(key);
      if (!pl) players.set(key, (pl = { ...zero(), team, name: n }));
      add(pl, won, sf, sc, jf, jc);
    }
    if (court != null) {
      let m = courtsByTeam.get(team);
      if (!m) courtsByTeam.set(team, (m = new Map()));
      let c = m.get(court);
      if (!c) m.set(court, (c = { ...zero(), court }));
      add(c, won, sf, sc, jf, jc);
      let g = courtsGroup.get(court);
      if (!g) courtsGroup.set(court, (g = { ...zero(), court }));
      add(g, won, sf, sc, jf, jc);
    }
    let sp = splitByTeam.get(team);
    if (!sp) splitByTeam.set(team, (sp = { home: zero(), away: zero() }));
    add(home ? sp.home : sp.away, won, sf, sc, jf, jc);
  };

  for (const a of actas) {
    if (a.sets_local == null || a.sets_visit == null) continue;
    const local = resolve(a.equipo_local);
    const visit = resolve(a.equipo_visit);
    if (!local || !visit) continue;
    total += 1;
    const [jl, jv] = juegos(a.parciales);
    const court = a.partido_num;
    const localWon = a.sets_local > a.sets_visit;
    side(local, a.local_j1, a.local_j2, court, true, localWon, a.sets_local, a.sets_visit, jl, jv);
    side(visit, a.visit_j1, a.visit_j2, court, false, !localWon && a.sets_visit > a.sets_local, a.sets_visit, a.sets_local, jv, jl);
  }

  const sortCourts = (m: Map<number, CourtStat>) => [...m.values()].sort((x, y) => x.court - y.court);
  return {
    pairs: [...pairs.values()].sort(rank),
    players: [...players.values()].sort(rank),
    courtsByTeam: new Map([...courtsByTeam].map(([k, v]) => [k, sortCourts(v)])),
    courtsGroup: sortCourts(courtsGroup),
    splitByTeam,
    total,
  };
}

// ─── Resultados por jornada, proyección y sugerencia de alineación ──────────────────────────────

export interface ResultRow {
  jornada: number | null;
  equipo_local: string | null;
  equipo_visit: string | null;
  resultado: string | null;
  estado: string | null;
}

export async function fetchGroupResults(idGrupo: string): Promise<ResultRow[]> {
  const { data } = await rawFrom('fcp_partidos')
    .select('jornada, equipo_local, equipo_visit, resultado, estado')
    .eq('id_grupo', idGrupo)
    .order('jornada', { ascending: true });
  return (data ?? []) as ResultRow[];
}

export interface FormEntry {
  jornada: number | null;
  rival: string;
  home: boolean;
  us: number;
  them: number;
  won: boolean;
}

/** Resultados ya jugados de un equipo, de más antiguo a más nuevo (tendencia). */
export function teamResults(rows: ResultRow[], team: string, equipos: string[]): FormEntry[] {
  const resolve = makeTeamResolver(equipos);
  const out: FormEntry[] = [];
  for (const r of rows) {
    const m = (r.resultado ?? '').match(/^s*(d+)s*[/-]s*(d+)s*$/);
    if (r.estado !== 'jugado' || !m) continue;
    const l = resolve(r.equipo_local);
    const v = resolve(r.equipo_visit);
    if (l !== team && v !== team) continue;
    const home = l === team;
    const us = Number(home ? m[1] : m[2]);
    const them = Number(home ? m[2] : m[1]);
    out.push({ jornada: r.jornada, rival: (home ? v : l) ?? '—', home, us, them, won: us > them });
  }
  return out;
}

export interface Projection {
  equipo: string;
  puntos: number;
  /** Puntos esperados al acabar, al ritmo actual. */
  proj: number;
}

/**
 * Proyección al ritmo actual: puntos por enfrentamiento × los que quedan. Un equipo sin enfrentamientos
 * toma la media del grupo. Orientativa: con pocas jornadas es muy sensible.
 */
export function projectTable(
  rows: { equipo: string; puntos: number; enf: number }[],
  totalEnf: number,
): Projection[] {
  const played = rows.filter((r) => r.enf > 0);
  const avg = played.length ? played.reduce((n, r) => n + r.puntos / r.enf, 0) / played.length : 0;
  return rows
    .map((r) => {
      const rate = r.enf > 0 ? r.puntos / r.enf : avg;
      return { equipo: r.equipo, puntos: r.puntos, proj: r.puntos + rate * Math.max(totalEnf - r.enf, 0) };
    })
    .sort((a, b) => b.proj - a.proj || b.puntos - a.puntos);
}

export interface Suggestion {
  court: number;
  pair: PairStat | null;
  /** Su registro en ESA pista. */
  rec: Record2 | null;
}

/**
 * Sugerencia de parejas con el historial del equipo: en cada pista, la pareja con mejor porcentaje en esa
 * pista, sin repetir jugadores. Solo orienta: no toca la alineación.
 */
export function suggestLineup(stats: GroupStats, team: string): Suggestion[] {
  const mine = stats.pairs.filter((p) => p.team === team);
  const courts = [...(stats.courtsByTeam.get(team) ?? [])].map((c) => c.court);
  const used = new Set<string>();
  const out: Suggestion[] = [];
  for (const court of courts) {
    const cands = mine
      .filter((p) => p.byCourt[court] && !used.has(p.a) && !used.has(p.b))
      .sort(
        (x, y) =>
          y.byCourt[court].pg / y.byCourt[court].pj - x.byCourt[court].pg / x.byCourt[court].pj ||
          y.byCourt[court].pj - x.byCourt[court].pj,
      );
    const best = cands[0] ?? null;
    if (best) {
      used.add(best.a);
      used.add(best.b);
    }
    out.push({ court, pair: best, rec: best ? best.byCourt[court] : null });
  }
  return out;
}
