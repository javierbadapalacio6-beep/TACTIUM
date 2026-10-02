"use client";

/**
 * Estadísticas de LIGA por jugador + récord combinado (liga + amistosos).
 *
 * Copia de playerStats.ts de la app (`TACTIUM/src/core/services/playerStats.ts`:
 * `fetchLeagueStatsBundle` + `computePlayerLeagueStats`). Si cambia la regla
 * allí (W.O., mejor pareja, racha…), cámbiala aquí también.
 *
 * Diferencias con la app, a propósito:
 * - La web no tiene «equipo activo»: se parte del USUARIO, se buscan sus fichas
 *   (`players.user_id`) en todos sus equipos y se calculan juntas (por eso
 *   `computePlayerLeagueStats` acepta varios ids de ficha).
 * - Se devuelve además la lista de partidos decididos (`games`) para poder
 *   mezclarlos con los amistosos en el récord del perfil (`combineRecord`).
 *
 * Todo es lectura bajo RLS: el usuario ve las jornadas, alineaciones y
 * resultados de sus equipos.
 */

import { supabaseBrowser } from "./supabase/client";

/* ── Filas (mismas columnas que la app) ─────────────────────────── */
interface Matchday {
  id: string;
  match_date: string | null;
  jornada_number: number | null;
}
interface MatchResult {
  matchday_id: string;
  court_number: number;
  set_number: number;
  us: number | null;
  them: number | null;
  forfeit: boolean;
  forfeit_us: boolean;
}
/** Vista `lineup_pairs` (lineups + nombres de los jugadores). */
interface LineupPair {
  matchday_id: string | null;
  court_number: number | null;
  variant_id: string | null;
  player_a_id: string | null;
  player_a_name: string | null;
  player_b_id: string | null;
  player_b_name: string | null;
}

export interface LeagueStatsBundle {
  matchdays: Matchday[];
  pairs: LineupPair[];
  results: MatchResult[];
  /** Ficha → cuenta, para identificar a la pareja también en amistosos. */
  playerUser: Map<string, string | null>;
}

const empty = (): LeagueStatsBundle => ({
  matchdays: [],
  pairs: [],
  results: [],
  playerUser: new Map(),
});

/** Carga en bloque todo lo necesario para calcular stats de N temporadas. */
export async function fetchLeagueStatsBundle(
  seasonIds: string[],
): Promise<LeagueStatsBundle> {
  if (seasonIds.length === 0) return empty();
  const sb = supabaseBrowser();

  const { data: matchdays, error: e1 } = await sb
    .from("matchdays")
    .select("id, match_date, jornada_number")
    .in("season_id", seasonIds);
  if (e1) throw e1;
  const mdIds = (matchdays ?? []).map((m) => m.id as string);
  if (mdIds.length === 0) return empty();

  // Solo la variante ACTIVA de cada jornada es la alineación oficial.
  const { data: variants, error: e2 } = await sb
    .from("lineup_variants")
    .select("id")
    .eq("is_active", true)
    .in("matchday_id", mdIds);
  if (e2) throw e2;
  const vIds = (variants ?? []).map((v) => v.id as string);

  const [pairsRes, resultsRes] = await Promise.all([
    vIds.length
      ? sb
          .from("lineup_pairs")
          .select(
            "matchday_id, court_number, variant_id, player_a_id, player_a_name, player_b_id, player_b_name",
          )
          .in("variant_id", vIds)
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("match_results")
      .select("matchday_id, court_number, set_number, us, them, forfeit, forfeit_us")
      .in("matchday_id", mdIds),
  ]);
  if (pairsRes.error) throw pairsRes.error;
  if (resultsRes.error) throw resultsRes.error;

  return {
    matchdays: (matchdays ?? []) as Matchday[],
    pairs: (pairsRes.data ?? []) as LineupPair[],
    results: (resultsRes.data ?? []) as MatchResult[],
    playerUser: new Map(),
  };
}

/**
 * Lo que la web necesita para el récord de liga de un usuario: sus fichas en
 * todos sus equipos, las temporadas de esos equipos y el bundle. Sin fichas
 * (jugador solo de amistosos) devuelve vacío sin más consultas.
 */
export async function fetchMyLeagueStats(
  userId: string,
): Promise<PlayerLeagueStats | null> {
  const sb = supabaseBrowser();
  const { data: mine, error: e1 } = await sb
    .from("players")
    .select("id, team_id")
    .eq("user_id", userId);
  if (e1) throw e1;
  const playerIds = (mine ?? []).map((p) => p.id as string);
  const teamIds = [...new Set((mine ?? []).map((p) => p.team_id as string))];
  if (playerIds.length === 0) return null;

  const [{ data: seasons, error: e2 }, { data: roster, error: e3 }] =
    await Promise.all([
      sb.from("seasons").select("id").in("team_id", teamIds),
      sb.from("players").select("id, user_id").in("team_id", teamIds),
    ]);
  if (e2) throw e2;
  if (e3) throw e3;

  const bundle = await fetchLeagueStatsBundle(
    (seasons ?? []).map((s) => s.id as string),
  );
  bundle.playerUser = new Map(
    (roster ?? []).map((p) => [p.id as string, (p.user_id as string | null) ?? null]),
  );
  return computePlayerLeagueStats(playerIds, bundle);
}

// ── Cálculo puro ────────────────────────────────────────────────────

type CourtState = "won" | "lost" | "undecided";

/**
 * Resultado de una pista. Misma semántica que matchOutcome de
 * JornadaScreen: us/them ya vienen en NUESTRA perspectiva; W.O. con
 * forfeit_us=true significa que NO nos presentamos (derrota).
 */
function courtOutcome(
  rows: MatchResult[],
): { state: CourtState; setsUs: number; setsThem: number } {
  const fo = rows.find((r) => r.forfeit);
  if (fo) {
    return fo.forfeit_us
      ? { state: "lost", setsUs: 0, setsThem: 0 }
      : { state: "won", setsUs: 0, setsThem: 0 };
  }
  let setsUs = 0;
  let setsThem = 0;
  for (const r of rows) {
    if (r.us == null || r.them == null) continue;
    if (r.us > r.them) setsUs++;
    else if (r.them > r.us) setsThem++;
  }
  if (setsUs >= 2) return { state: "won", setsUs, setsThem };
  if (setsThem >= 2) return { state: "lost", setsUs, setsThem };
  return { state: "undecided", setsUs, setsThem };
}

export interface PartnerStat {
  /** Clave de identidad: `u:<user_id>` si tiene cuenta; si no, ficha o nombre. */
  key: string;
  name: string;
  played: number;
  won: number;
  /** Pista más repetida con esa pareja (solo liga; null en amistosos). */
  court: number | null;
}

export interface CourtStat {
  court: number;
  played: number;
  won: number;
}

/** Un partido decidido, listo para mezclar liga y amistosos. */
export interface RecordGame {
  /** Orden cronológico (fecha ISO + desempate). */
  sortKey: string;
  won: boolean;
  partnerKey: string | null;
  partnerName: string | null;
  /** Pista (solo liga). */
  court?: number | null;
}

export interface PlayerLeagueStats {
  played: number;
  won: number;
  lost: number;
  /** 0-100, null si no hay partidos decididos. */
  winRate: number | null;
  setsWon: number;
  setsLost: number;
  byCourt: CourtStat[];
  partners: PartnerStat[];
  bestPartner: PartnerStat | null;
  /** Positiva = victorias seguidas; negativa = derrotas seguidas. */
  currentStreak: number;
  bestStreak: number;
  /** Últimos partidos (cronológicos, máx. 5): 'W' | 'L'. */
  lastFive: ("W" | "L")[];
  /** Partidos decididos en orden cronológico (solo web). */
  games: RecordGame[];
}

export function computePlayerLeagueStats(
  playerIds: string | string[],
  bundle: LeagueStatsBundle,
): PlayerLeagueStats {
  const me = new Set(Array.isArray(playerIds) ? playerIds : [playerIds]);
  const mdById = new Map(bundle.matchdays.map((m) => [m.id, m]));
  const resultsByKey = new Map<string, MatchResult[]>();
  for (const r of bundle.results) {
    const k = `${r.matchday_id}·${r.court_number}`;
    const arr = resultsByKey.get(k);
    if (arr) arr.push(r);
    else resultsByKey.set(k, [r]);
  }

  // Partidos del jugador: pareja de la alineación oficial donde figura.
  const games: {
    dateKey: string;
    court: number;
    state: CourtState;
    setsUs: number;
    setsThem: number;
    partnerId: string | null;
    partnerName: string | null;
  }[] = [];

  for (const p of bundle.pairs) {
    if (!p.matchday_id || p.court_number == null) continue;
    const isA = !!p.player_a_id && me.has(p.player_a_id);
    const isB = !!p.player_b_id && me.has(p.player_b_id);
    if (!isA && !isB) continue;
    const md = mdById.get(p.matchday_id);
    if (!md) continue;
    const rows = resultsByKey.get(`${p.matchday_id}·${p.court_number}`) ?? [];
    const out = courtOutcome(rows);
    games.push({
      dateKey: `${md.match_date ?? "9999"}·${String(md.jornada_number ?? 0).padStart(3, "0")}`,
      court: p.court_number,
      state: out.state,
      setsUs: out.setsUs,
      setsThem: out.setsThem,
      partnerId: isA ? p.player_b_id : p.player_a_id,
      partnerName: isA ? p.player_b_name : p.player_a_name,
    });
  }

  games.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const decided = games.filter((g) => g.state !== "undecided");

  let setsWon = 0;
  let setsLost = 0;
  const courtMap = new Map<number, CourtStat>();
  const recordGames: RecordGame[] = [];

  for (const g of decided) {
    const isWin = g.state === "won";
    setsWon += g.setsUs;
    setsLost += g.setsThem;

    const c = courtMap.get(g.court) ?? { court: g.court, played: 0, won: 0 };
    c.played++;
    if (isWin) c.won++;
    courtMap.set(g.court, c);

    const partnerUser = g.partnerId ? bundle.playerUser.get(g.partnerId) : null;
    recordGames.push({
      sortKey: g.dateKey,
      won: isWin,
      partnerKey: g.partnerId
        ? partnerUser
          ? `u:${partnerUser}`
          : `p:${g.partnerId}`
        : null,
      partnerName: g.partnerName ?? (g.partnerId ? "—" : null),
      court: g.court,
    });
  }

  const rec = summarize(recordGames);
  return {
    ...rec,
    setsWon,
    setsLost,
    byCourt: [...courtMap.values()].sort((a, b) => a.court - b.court),
    games: recordGames,
  };
}

/* ── Récord (V-D, %, racha, últimos 5, mejor pareja) ───────────── */

export interface RecordSummary {
  played: number;
  won: number;
  lost: number;
  winRate: number | null;
  partners: PartnerStat[];
  bestPartner: PartnerStat | null;
  currentStreak: number;
  bestStreak: number;
  lastFive: ("W" | "L")[];
}

/** Mismas reglas que `computePlayerLeagueStats` de la app, sobre partidos ya decididos. */
export function summarize(games: RecordGame[]): RecordSummary {
  const sorted = games.slice().sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  let won = 0;
  let cur = 0;
  let best = 0;
  const seq: ("W" | "L")[] = [];
  const partnerMap = new Map<string, PartnerStat>();
  const partnerCourts = new Map<string, Map<number, number>>();

  for (const g of sorted) {
    if (g.won) won++;
    seq.push(g.won ? "W" : "L");
    if (g.partnerKey) {
      const ps = partnerMap.get(g.partnerKey) ?? {
        key: g.partnerKey,
        name: g.partnerName ?? "—",
        played: 0,
        won: 0,
        court: null,
      };
      ps.played++;
      if (g.won) ps.won++;
      partnerMap.set(g.partnerKey, ps);
      if (g.court != null) {
        const cm = partnerCourts.get(g.partnerKey) ?? new Map<number, number>();
        cm.set(g.court, (cm.get(g.court) ?? 0) + 1);
        partnerCourts.set(g.partnerKey, cm);
      }
    }
    // Racha: se reinicia al cambiar el signo.
    if (g.won) cur = cur >= 0 ? cur + 1 : 1;
    else cur = cur <= 0 ? cur - 1 : -1;
    if (cur > best) best = cur;
  }

  // Pista habitual con cada pareja: la más repetida (empate → la más baja).
  for (const [k, cm] of partnerCourts) {
    const ps = partnerMap.get(k);
    if (!ps) continue;
    ps.court = [...cm.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  }

  const played = sorted.length;
  const partners = [...partnerMap.values()].sort(
    (a, b) => b.won - a.won || b.played - a.played,
  );
  // Mejor compañero: mínimo 2 partidos juntos para que signifique algo.
  const bestPartner =
    partners.find((p) => p.played >= 2 && p.won / p.played >= 0.5) ?? null;

  return {
    played,
    won,
    lost: played - won,
    winRate: played > 0 ? Math.round((won / played) * 100) : null,
    partners,
    bestPartner,
    currentStreak: cur,
    bestStreak: best,
    lastFive: seq.slice(-5),
  };
}

/**
 * Liga + amistosos en un solo récord (mismas reglas que la app):
 * - V-D, %, racha y últimos 5 mezclan los dos en orden de fecha.
 * - Mejor pareja: la mejor de liga frente a la mejor de amistosos (agrupada
 *   por nombre del compañero); gana la de MÁS victorias (empate → liga).
 */
export function combineRecord(
  leagueGames: RecordGame[],
  casualGames: RecordGame[],
): RecordSummary {
  const all = summarize([...leagueGames, ...casualGames]);
  const lb = summarize(leagueGames).bestPartner;
  const cb = summarize(casualGames).bestPartner;
  const bestPartner = lb && cb ? (cb.won > lb.won ? cb : lb) : (lb ?? cb);
  return { ...all, bestPartner };
}
