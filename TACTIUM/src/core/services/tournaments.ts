import { supabase } from '@core/supabase/client';

// Torneos del club (Fase 1: KO). Las tablas aún no están en los tipos
// generados → casts puntuales (mismo patrón que social.ts / clubSchedule.ts).

export type TournamentFormat = 'ko' | 'groups_ko' | 'round_robin' | 'americano';
// Formato del PARTIDO (sets). Ver formatConfig.
export type MatchFormat = 'bo3_stb' | 'bo3_full' | 'bo1';

export const formatConfig = (
  f: string,
): { maxSets: number; setsToWin: number; thirdSuperTb: boolean; label: string } => {
  switch (f) {
    case 'bo3_full':
      return { maxSets: 3, setsToWin: 2, thirdSuperTb: false, label: 'Mejor de 3 sets' };
    case 'bo1':
      return { maxSets: 1, setsToWin: 1, thirdSuperTb: false, label: '1 set' };
    case 'bo3_stb':
    default:
      return {
        maxSets: 3,
        setsToWin: 2,
        thirdSuperTb: true,
        label: 'Mejor de 3 · super tie-break',
      };
  }
};
export type TournamentStatus =
  | 'draft'
  | 'open'
  | 'in_progress'
  | 'finished'
  | 'canceled';

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  starts_on: string | null;
  signup_code: string | null;
  max_pairs: number | null;
  pair_based: boolean;
  match_format: string;
  gender: string | null;
  genders: string[];
  category: string | null;
  categories: string[];
  created_at: string;
}

export type TournamentGender = 'masculino' | 'femenino' | 'mixto';

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  gender: string | null;
  category: string | null;
  pair_label: string | null;
  p1_name: string;
  p1_email: string | null;
  p1_phone: string | null;
  p1_user_id: string | null;
  p2_name: string | null;
  p2_email: string | null;
  p2_phone: string | null;
  p2_user_id: string | null;
  availability: string[];
  seed: number | null;
  seed_points: number | null;
  status: string;
  created_at: string;
}

type AnyFrom = (table: string) => any;
type RpcResult = { data: unknown; error: { message: string } | null };

const from = () => supabase.from.bind(supabase) as unknown as AnyFrom;

// Código de inscripción legible (sin caracteres ambiguos).
const genCode = (): string => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

export async function listTournaments(clubId: string): Promise<Tournament[]> {
  const { data, error } = await from()('tournaments')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tournament[];
}

export async function createTournament(input: {
  clubId: string;
  name: string;
  format: TournamentFormat;
  matchFormat?: MatchFormat;
  genders?: TournamentGender[];
  categories?: string[];
  startsOn?: string | null;
  maxPairs?: number | null;
}): Promise<Tournament> {
  const payload = {
    club_id: input.clubId,
    name: input.name,
    format: input.format,
    match_format: input.matchFormat ?? 'bo3_stb',
    genders: input.genders ?? [],
    categories: input.categories ?? [],
    starts_on: input.startsOn ?? null,
    max_pairs: input.maxPairs ?? null,
    // La inscripción queda abierta al crear el torneo (código compartible).
    status: 'open',
    signup_code: genCode(),
    pair_based: true,
  };
  const { data, error } = await from()('tournaments')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Tournament;
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await from()('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Tournament) ?? null;
}

export async function listRegistrations(
  tournamentId: string,
): Promise<TournamentRegistration[]> {
  const { data, error } = await from()('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TournamentRegistration[];
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  gender: string | null;
  category: string | null;
  bracket: string;
  round: number;
  slot: number;
  group_id: string | null;
  home_reg: string | null;
  away_reg: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_reg: string | null;
  status: string;
  scheduled_at: string | null;
  court: string | null;
  sets: number[][];
}

/** Alta manual de una pareja (por el club). Puntos opcionales para la siembra. */
export async function addRegistration(input: {
  tournamentId: string;
  gender?: string | null;
  category?: string | null;
  p1Name: string;
  p2Name?: string;
  p1Email?: string;
  p1Phone?: string;
  seedPoints?: number | null;
  availability?: string[];
}): Promise<void> {
  const { error } = await from()('tournament_registrations').insert({
    tournament_id: input.tournamentId,
    gender: input.gender ?? null,
    category: input.category ?? null,
    p1_name: input.p1Name.trim(),
    p2_name: input.p2Name?.trim() || null,
    p1_email: input.p1Email?.trim() || null,
    p1_phone: input.p1Phone?.trim() || null,
    seed_points: input.seedPoints ?? null,
    availability: input.availability ?? [],
  });
  if (error) throw new Error(error.message);
}

export async function deleteRegistration(id: string): Promise<void> {
  const { error } = await from()('tournament_registrations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listMatches(
  tournamentId: string,
): Promise<TournamentMatch[]> {
  const { data, error } = await from()('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('slot', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TournamentMatch[];
}

const nextPow2 = (n: number): number => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

// Orden de siembra estándar para un cuadro de tamaño `size` (potencia de 2):
// devuelve el nº de cabeza de serie por posición del cuadro (1-indexado).
const seedPositions = (size: number): number[] => {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const total = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(total - s);
    }
    seeds = next;
  }
  return seeds;
};

/**
 * Cierra la inscripción y genera el cuadro de eliminación directa: siembra por
 * puntos (desc, nulos al final), coloca cabezas de serie en el cuadro estándar,
 * da byes a los mejores y crea todas las rondas. Marca el torneo 'in_progress'.
 */
export async function generateKoBracket(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  const seeded = [...regs]
    .filter((r) => r.status !== 'withdrawn')
    .sort(
      (a, b) =>
        (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
        (a.created_at < b.created_at ? -1 : 1),
    );
  const N = seeded.length;
  if (N < 2) throw new Error('Hacen falta al menos 2 parejas para el cuadro.');

  const size = nextPow2(N);
  const positions = seedPositions(size);
  const posReg = positions.map((seed) => (seed <= N ? seeded[seed - 1] : null));
  const rounds = Math.round(Math.log2(size));

  // Persistimos el nº de cabeza de serie (para mostrarlo en el cuadro).
  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );

  type M = {
    round: number;
    slot: number;
    home_reg: string | null;
    away_reg: string | null;
    status: string;
    winner_reg: string | null;
  };
  const byRound: M[][] = [];

  const r1: M[] = [];
  for (let s = 0; s < size / 2; s++) {
    const home = posReg[2 * s];
    const away = posReg[2 * s + 1];
    const isBye = !home || !away;
    r1.push({
      round: 1,
      slot: s,
      home_reg: home?.id ?? null,
      away_reg: away?.id ?? null,
      status: isBye ? 'bye' : 'pending',
      winner_reg: isBye ? home?.id ?? away?.id ?? null : null,
    });
  }
  byRound.push(r1);
  for (let r = 2; r <= rounds; r++) {
    const arr: M[] = [];
    for (let s = 0; s < size / Math.pow(2, r); s++) {
      arr.push({ round: r, slot: s, home_reg: null, away_reg: null, status: 'pending', winner_reg: null });
    }
    byRound.push(arr);
  }
  // Propaga los byes de la ronda 1 a la ronda 2.
  if (rounds >= 2) {
    for (const m of r1) {
      if (m.status === 'bye' && m.winner_reg) {
        const nm = byRound[1][Math.floor(m.slot / 2)];
        if (m.slot % 2 === 0) nm.home_reg = m.winner_reg;
        else nm.away_reg = m.winner_reg;
      }
    }
  }

  const rows = byRound.flat().map((m) => ({
    tournament_id: tournament.id,
    gender,
    category,
    bracket: 'main',
    round: m.round,
    slot: m.slot,
    home_reg: m.home_reg,
    away_reg: m.away_reg,
    status: m.status,
    winner_reg: m.winner_reg,
  }));
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);

  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/**
 * Mete el resultado por SETS y hace avanzar al ganador. `sets` = array de
 * [gamesHome, gamesAway] por set jugado. La app cuenta sets ganados y decide el
 * ganador (primero en llegar a `setsToWin`). Guarda el detalle en `sets` y los
 * sets ganados en home_score/away_score.
 */
export async function setMatchResult(
  match: TournamentMatch,
  sets: number[][],
  setsToWin: number,
): Promise<void> {
  if (!match.home_reg || !match.away_reg) {
    throw new Error('Faltan las dos parejas en este partido.');
  }
  const clean = sets.filter(
    (s) => s.length === 2 && (s[0] !== 0 || s[1] !== 0),
  );
  let wonHome = 0;
  let wonAway = 0;
  for (const [h, a] of clean) {
    if (h === a) throw new Error('Un set no puede quedar empatado.');
    if (h > a) wonHome++;
    else wonAway++;
  }
  if (wonHome < setsToWin && wonAway < setsToWin) {
    throw new Error('Marcador incompleto: nadie ha ganado los sets necesarios.');
  }
  const winner = wonHome > wonAway ? match.home_reg : match.away_reg;
  const upd = await from()('tournament_matches')
    .update({
      sets: clean,
      home_score: wonHome,
      away_score: wonAway,
      winner_reg: winner,
      status: 'finished',
    })
    .eq('id', match.id);
  if (upd.error) throw new Error(upd.error.message);

  let q = from()('tournament_matches')
    .select('id')
    .eq('tournament_id', match.tournament_id)
    .eq('bracket', match.bracket)
    .eq('round', match.round + 1)
    .eq('slot', Math.floor(match.slot / 2));
  q = match.category == null ? q.is('category', null) : q.eq('category', match.category);
  q = match.gender == null ? q.is('gender', null) : q.eq('gender', match.gender);
  const { data: next } = await q.maybeSingle();

  if (next?.id) {
    await from()('tournament_matches')
      .update(match.slot % 2 === 0 ? { home_reg: winner } : { away_reg: winner })
      .eq('id', next.id);
  } else {
    // Era la final → torneo finalizado.
    await from()('tournaments')
      .update({ status: 'finished' })
      .eq('id', match.tournament_id);
  }
}

export interface TournamentLookup {
  id: string;
  name: string;
  genders: string[];
  categories: string[];
}

/** Busca un torneo por código (para mostrar nombre + categorías al apuntarse). */
export async function lookupTournament(
  code: string,
): Promise<TournamentLookup | null> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('tournament_lookup', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TournamentLookup[];
  return rows[0] ?? null;
}

/** Inscripción pública por código (el que llama es el jugador 1). */
export async function signupByCode(input: {
  code: string;
  gender?: string | null;
  category?: string | null;
  p1Name: string;
  p1Email?: string;
  p1Phone?: string;
  p2Name: string;
  p2Email?: string;
  p2Phone?: string;
  availability?: string[];
}): Promise<string> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('tournament_signup', {
    p_code: input.code.trim().toUpperCase(),
    p1_name: input.p1Name.trim(),
    p1_email: input.p1Email ?? null,
    p1_phone: input.p1Phone ?? null,
    p2_name: input.p2Name.trim(),
    p2_email: input.p2Email ?? null,
    p2_phone: input.p2Phone ?? null,
    p_availability: input.availability ?? [],
    p_category: input.category ?? null,
    p_gender: input.gender ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
