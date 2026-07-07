import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

// Estadísticas de LIGA por jugador (F5a · plan de escalado). Sin tocar la
// BD: 4 consultas bulk sobre tablas/vistas existentes + cálculo puro en
// cliente. Los amistosos (casual_matches) se incorporarán en F5b cuando
// exista el RPC de lectura y el picker vincule user_id.

type Matchday = Database['public']['Tables']['matchdays']['Row'];
type MatchResult = Database['public']['Tables']['match_results']['Row'];
type LineupPair = Database['public']['Views']['lineup_pairs']['Row'];

export interface LeagueStatsBundle {
  matchdays: Matchday[];
  pairs: LineupPair[];
  results: MatchResult[];
}

/** Carga en bloque todo lo necesario para calcular stats de N temporadas. */
export async function fetchLeagueStatsBundle(
  seasonIds: string[],
): Promise<LeagueStatsBundle> {
  if (seasonIds.length === 0) return { matchdays: [], pairs: [], results: [] };

  const { data: matchdays, error: e1 } = await supabase
    .from('matchdays')
    .select('*')
    .in('season_id', seasonIds);
  if (e1) throw e1;
  const mdIds = (matchdays ?? []).map((m) => m.id);
  if (mdIds.length === 0) return { matchdays: [], pairs: [], results: [] };

  // Solo la variante ACTIVA de cada jornada es la alineación oficial.
  const { data: variants, error: e2 } = await supabase
    .from('lineup_variants')
    .select('id')
    .eq('is_active', true)
    .in('matchday_id', mdIds);
  if (e2) throw e2;
  const vIds = (variants ?? []).map((v) => v.id);

  const [pairsRes, resultsRes] = await Promise.all([
    vIds.length
      ? supabase.from('lineup_pairs').select('*').in('variant_id', vIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase.from('match_results').select('*').in('matchday_id', mdIds),
  ]);
  if (pairsRes.error) throw pairsRes.error;
  if (resultsRes.error) throw resultsRes.error;

  return {
    matchdays: matchdays ?? [],
    pairs: (pairsRes.data ?? []) as LineupPair[],
    results: resultsRes.data ?? [],
  };
}

// ── Cálculo puro ────────────────────────────────────────────────────

type CourtState = 'won' | 'lost' | 'undecided';

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
      ? { state: 'lost', setsUs: 0, setsThem: 0 }
      : { state: 'won', setsUs: 0, setsThem: 0 };
  }
  let setsUs = 0;
  let setsThem = 0;
  for (const r of rows) {
    if (r.us == null || r.them == null) continue;
    if (r.us > r.them) setsUs++;
    else if (r.them > r.us) setsThem++;
  }
  if (setsUs >= 2) return { state: 'won', setsUs, setsThem };
  if (setsThem >= 2) return { state: 'lost', setsUs, setsThem };
  return { state: 'undecided', setsUs, setsThem };
}

export interface PartnerStat {
  playerId: string;
  name: string;
  played: number;
  won: number;
}

export interface CourtStat {
  court: number;
  played: number;
  won: number;
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
  lastFive: ('W' | 'L')[];
}

export function computePlayerLeagueStats(
  playerId: string,
  bundle: LeagueStatsBundle,
): PlayerLeagueStats {
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
    const isA = p.player_a_id === playerId;
    const isB = p.player_b_id === playerId;
    if (!isA && !isB) continue;
    const md = mdById.get(p.matchday_id);
    if (!md) continue;
    const rows = resultsByKey.get(`${p.matchday_id}·${p.court_number}`) ?? [];
    const out = courtOutcome(rows);
    games.push({
      dateKey: `${md.match_date ?? '9999'}·${String(
        md.jornada_number ?? 0,
      ).padStart(3, '0')}`,
      court: p.court_number,
      state: out.state,
      setsUs: out.setsUs,
      setsThem: out.setsThem,
      partnerId: isA ? p.player_b_id : p.player_a_id,
      partnerName: isA ? p.player_b_name : p.player_a_name,
    });
  }

  games.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const decided = games.filter((g) => g.state !== 'undecided');

  let won = 0;
  let setsWon = 0;
  let setsLost = 0;
  const courtMap = new Map<number, CourtStat>();
  const partnerMap = new Map<string, PartnerStat>();
  let cur = 0;
  let best = 0;
  const seq: ('W' | 'L')[] = [];

  for (const g of decided) {
    const isWin = g.state === 'won';
    if (isWin) won++;
    setsWon += g.setsUs;
    setsLost += g.setsThem;
    seq.push(isWin ? 'W' : 'L');

    const c = courtMap.get(g.court) ?? { court: g.court, played: 0, won: 0 };
    c.played++;
    if (isWin) c.won++;
    courtMap.set(g.court, c);

    if (g.partnerId) {
      const ps = partnerMap.get(g.partnerId) ?? {
        playerId: g.partnerId,
        name: g.partnerName ?? '—',
        played: 0,
        won: 0,
      };
      ps.played++;
      if (isWin) ps.won++;
      partnerMap.set(g.partnerId, ps);
    }

    // Racha: se reinicia al cambiar el signo.
    if (isWin) cur = cur >= 0 ? cur + 1 : 1;
    else cur = cur <= 0 ? cur - 1 : -1;
    if (cur > best) best = cur;
  }

  const played = decided.length;
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
    setsWon,
    setsLost,
    byCourt: [...courtMap.values()].sort((a, b) => a.court - b.court),
    partners,
    bestPartner,
    currentStreak: cur,
    bestStreak: best,
    lastFive: seq.slice(-5),
  };
}
