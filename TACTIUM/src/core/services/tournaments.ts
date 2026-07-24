import { supabase } from '@core/supabase/client';

// Torneos del club (Fase 1: KO). Las tablas aún no están en los tipos
// generados → casts puntuales (mismo patrón que social.ts / clubSchedule.ts).

export type TournamentFormat =
  | 'ko'
  | 'groups_ko'
  | 'round_robin'
  | 'americano'
  | 'mexicano';
export const isSocialFormat = (f: string) => f === 'americano' || f === 'mexicano';
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
  group_no: number | null;
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
  // Enriquecidos en listRegistrations desde profiles (foto del jugador si la puso).
  p1_avatar?: string | null;
  p2_avatar?: string | null;
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
    pair_based: !isSocialFormat(input.format),
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
  const regs = (data ?? []) as TournamentRegistration[];
  // Enriquecer con la foto de perfil de los jugadores vinculados (si la tienen).
  const ids = Array.from(
    new Set(
      regs
        .flatMap((r) => [r.p1_user_id, r.p2_user_id])
        .filter((x): x is string => !!x),
    ),
  );
  if (ids.length) {
    const { data: profs } = await from()('profiles')
      .select('id, avatar_url')
      .in('id', ids);
    const byId = new Map<string, string | null>(
      ((profs ?? []) as { id: string; avatar_url: string | null }[]).map((p) => [
        p.id,
        p.avatar_url,
      ]),
    );
    for (const r of regs) {
      r.p1_avatar = r.p1_user_id ? byId.get(r.p1_user_id) ?? null : null;
      r.p2_avatar = r.p2_user_id ? byId.get(r.p2_user_id) ?? null : null;
    }
  }
  return regs;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  gender: string | null;
  category: string | null;
  group_no: number | null;
  bracket: string;
  round: number;
  slot: number;
  group_id: string | null;
  home_reg: string | null;
  away_reg: string | null;
  home_reg2: string | null; // 2º jugador del equipo local (americano/mexicano)
  away_reg2: string | null;
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

// ¿Ya hay partidos generados en esta división? (guard anti-duplicado).
async function hasDivisionMatches(
  tournamentId: string,
  gender: string | null,
  category: string | null,
  onlyKo = false,
): Promise<boolean> {
  let q = from()('tournament_matches')
    .select('id')
    .eq('tournament_id', tournamentId);
  q = gender == null ? q.is('gender', null) : q.eq('gender', gender);
  q = category == null ? q.is('category', null) : q.eq('category', category);
  if (onlyKo) q = q.neq('bracket', 'grp');
  const { data } = await q.limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

// Filas de un cuadro KO a partir de parejas YA sembradas (orden = siembra).
function koMatchRows(
  tournamentId: string,
  seeded: TournamentRegistration[],
  bracket: string,
  gender: string | null,
  category: string | null,
): Record<string, unknown>[] {
  const N = seeded.length;
  const size = nextPow2(N);
  const positions = seedPositions(size);
  const posReg = positions.map((seed) => (seed <= N ? seeded[seed - 1] : null));
  const rounds = Math.round(Math.log2(size));
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
  if (rounds >= 2) {
    for (const m of r1) {
      if (m.status === 'bye' && m.winner_reg) {
        const nm = byRound[1][Math.floor(m.slot / 2)];
        if (m.slot % 2 === 0) nm.home_reg = m.winner_reg;
        else nm.away_reg = m.winner_reg;
      }
    }
  }
  return byRound.flat().map((m) => ({
    tournament_id: tournamentId,
    gender,
    category,
    bracket,
    round: m.round,
    slot: m.slot,
    home_reg: m.home_reg,
    away_reg: m.away_reg,
    status: m.status,
    winner_reg: m.winner_reg,
  }));
}

/** Cierra la inscripción y genera el cuadro KO de una división (cabezas por puntos). */
export async function generateKoBracket(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Esta división ya está generada.');
  const seeded = [...regs]
    .filter((r) => r.status !== 'withdrawn')
    .sort(
      (a, b) =>
        (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
        (a.created_at < b.created_at ? -1 : 1),
    );
  if (seeded.length < 2) throw new Error('Hacen falta al menos 2 parejas para el cuadro.');
  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );
  const rows = koMatchRows(tournament.id, seeded, 'main', gender, category);
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

// Etiqueta de cuadro por posición de grupo (oro/plata/bronce…).
export const POS_BRACKETS = ['gold', 'silver', 'bronze'];
export const posBracket = (p: number): string => POS_BRACKETS[p - 1] ?? `pos${p}`;
export const BRACKET_LABEL: Record<string, string> = {
  main: 'Cuadro',
  gold: 'Oro',
  silver: 'Plata',
  bronze: 'Bronce',
};
export const groupName = (n: number): string => String.fromCharCode(65 + n); // A, B, C…

/** Genera la fase de GRUPOS (liguillas) de una división. Reparto serpiente por siembra. */
export async function generateGroups(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null,
  category: string | null,
  groupSize: number,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Esta división ya está generada.');
  const seeded = [...regs]
    .filter((r) => r.status !== 'withdrawn')
    .sort(
      (a, b) =>
        (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
        (a.created_at < b.created_at ? -1 : 1),
    );
  const N = seeded.length;
  if (N < 4) throw new Error('Para grupos hacen falta al menos 4 parejas.');
  const G = Math.max(2, Math.ceil(N / groupSize));

  // Reparto serpiente: distribuye las cabezas de serie entre los grupos.
  const groups: TournamentRegistration[][] = Array.from({ length: G }, () => []);
  seeded.forEach((r, i) => {
    const row = Math.floor(i / G);
    const pos = i % G;
    const g = row % 2 === 0 ? pos : G - 1 - pos;
    groups[g].push(r);
  });

  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );
  await Promise.all(
    groups.flatMap((grp, gi) =>
      grp.map((r) =>
        from()('tournament_registrations').update({ group_no: gi }).eq('id', r.id),
      ),
    ),
  );

  const rows: Record<string, unknown>[] = [];
  let slot = 0;
  groups.forEach((grp, gi) => {
    for (let i = 0; i < grp.length; i++) {
      for (let j = i + 1; j < grp.length; j++) {
        rows.push({
          tournament_id: tournament.id,
          gender,
          category,
          bracket: 'grp',
          group_no: gi,
          round: 1,
          slot: slot++,
          home_reg: grp[i].id,
          away_reg: grp[j].id,
          status: 'pending',
        });
      }
    }
  });
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/**
 * Con los grupos terminados, genera las ELIMINATORIAS por posición: el 1º de
 * cada grupo → cuadro ORO, el 2º → PLATA, el 3º → BRONCE, etc.
 */
export async function generateKnockoutFromGroups(
  tournament: Tournament,
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
  gender: string | null,
  category: string | null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category, true))
    throw new Error('Las eliminatorias ya están generadas.');
  const groupNos = Array.from(
    new Set(regs.filter((r) => r.group_no != null).map((r) => r.group_no as number)),
  ).sort((a, b) => a - b);
  if (groupNos.length === 0) throw new Error('No hay grupos.');

  const standingsByGroup = new Map<number, StandingRow[]>();
  let maxPos = 0;
  for (const gn of groupNos) {
    const gRegs = regs.filter((r) => r.group_no === gn);
    const gMatches = matches.filter((m) => m.bracket === 'grp' && m.group_no === gn);
    const st = computeStandings(gRegs, gMatches);
    standingsByGroup.set(gn, st);
    maxPos = Math.max(maxPos, st.length);
  }

  const regById = new Map(regs.map((r) => [r.id, r]));
  const rows: Record<string, unknown>[] = [];
  for (let p = 1; p <= maxPos; p++) {
    // Clasificados en la posición p de cada grupo, ordenados por su rendimiento.
    const quals = groupNos
      .map((gn) => standingsByGroup.get(gn)![p - 1])
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
          b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst),
      )
      .map((s) => regById.get(s.regId))
      .filter((r): r is TournamentRegistration => !!r);
    if (quals.length >= 2) {
      rows.push(...koMatchRows(tournament.id, quals, posBracket(p), gender, category));
    }
  }
  if (rows.length === 0) throw new Error('No hay suficientes clasificados.');
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Genera una LIGA (todos contra todos) para una división: crea C(N,2) partidos.
 * No hay cuadro; la clasificación sale de los resultados (computeStandings).
 */
export async function generateRoundRobin(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Esta división ya está generada.');
  const active = regs.filter((r) => r.status !== 'withdrawn');
  if (active.length < 2) throw new Error('Hacen falta al menos 2 parejas.');
  const seeded = [...active].sort(
    (a, b) =>
      (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
      (a.created_at < b.created_at ? -1 : 1),
  );
  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );
  const rows: Record<string, unknown>[] = [];
  let slot = 0;
  for (let i = 0; i < seeded.length; i++) {
    for (let j = i + 1; j < seeded.length; j++) {
      rows.push({
        tournament_id: tournament.id,
        gender,
        category,
        bracket: 'rr',
        round: 1,
        slot: slot++,
        home_reg: seeded[i].id,
        away_reg: seeded[j].id,
        status: 'pending',
      });
    }
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

export interface StandingRow {
  regId: string;
  name: string;
  seed: number | null;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
}

/** Clasificación de una liga/grupo a partir de los partidos jugados. */
export function computeStandings(
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
): StandingRow[] {
  const nameOf = (r: TournamentRegistration) =>
    `${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}`;
  const byId = new Map<string, StandingRow>();
  for (const r of regs) {
    byId.set(r.id, {
      regId: r.id,
      name: nameOf(r),
      seed: r.seed,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== 'finished' || !m.home_reg || !m.away_reg) continue;
    const H = byId.get(m.home_reg);
    const A = byId.get(m.away_reg);
    if (!H || !A) continue;
    H.played++;
    A.played++;
    H.setsFor += m.home_score ?? 0;
    H.setsAgainst += m.away_score ?? 0;
    A.setsFor += m.away_score ?? 0;
    A.setsAgainst += m.home_score ?? 0;
    for (const s of m.sets ?? []) {
      H.gamesFor += s[0] ?? 0;
      H.gamesAgainst += s[1] ?? 0;
      A.gamesFor += s[1] ?? 0;
      A.gamesAgainst += s[0] ?? 0;
    }
    if (m.winner_reg === m.home_reg) {
      H.won++;
      A.lost++;
      H.points += 2;
      A.points += 1;
    } else {
      A.won++;
      H.lost++;
      A.points += 2;
      H.points += 1;
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      b.points - a.points ||
      b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
      b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst) ||
      b.won - a.won,
  );
}

// ── Americano / Mexicano (jugadores individuales, ranking por puntos) ────────

export interface PlayerStanding {
  regId: string;
  name: string;
  played: number;
  won: number;
  points: number;
}

/** Ranking individual: puntos = suma de lo que anota tu equipo en cada partido. */
export function computeIndividualStandings(
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
): PlayerStanding[] {
  const byId = new Map<string, PlayerStanding>();
  for (const r of regs)
    byId.set(r.id, { regId: r.id, name: r.p1_name, played: 0, won: 0, points: 0 });
  const add = (id: string | null, pts: number, win: boolean) => {
    if (!id) return;
    const p = byId.get(id);
    if (!p) return;
    p.played++;
    p.points += pts;
    if (win) p.won++;
  };
  for (const m of matches) {
    if (m.status !== 'finished') continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const homeWin = hs > as;
    add(m.home_reg, hs, homeWin);
    add(m.home_reg2, hs, homeWin);
    add(m.away_reg, as, !homeWin);
    add(m.away_reg2, as, !homeWin);
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.points - a.points || b.won - a.won,
  );
}

const rotateArr = <T,>(arr: T[], by: number): T[] => {
  const n = arr.length;
  if (n === 0) return arr;
  const k = ((by % n) + n) % n;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

/** AMERICANO: rondas rotando compañeros (pistas de 4). Jugadores múltiplo de 4. */
export async function generateAmericano(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null,
  category: string | null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Este americano ya está generado.');
  const players = regs
    .filter((r) => r.status !== 'withdrawn')
    .sort(
      (a, b) =>
        (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
        (a.created_at < b.created_at ? -1 : 1),
    )
    .map((r) => r.id);
  const N = players.length;
  if (N < 4 || N % 4 !== 0)
    throw new Error('Para el americano hacen falta jugadores múltiplo de 4 (4, 8, 12…).');
  await Promise.all(
    players.map((id, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', id),
    ),
  );
  const rounds = N - 1;
  const courts = N / 4;
  const rows: Record<string, unknown>[] = [];
  let slot = 0;
  for (let r = 0; r < rounds; r++) {
    const arr = [players[0], ...rotateArr(players.slice(1), r)];
    for (let ct = 0; ct < courts; ct++) {
      const [a, b, cc, d] = arr.slice(ct * 4, ct * 4 + 4);
      const teams =
        r % 3 === 0 ? [[a, b], [cc, d]] : r % 3 === 1 ? [[a, cc], [b, d]] : [[a, d], [b, cc]];
      rows.push({
        tournament_id: tournament.id,
        gender,
        category,
        bracket: 'amer',
        round: r + 1,
        slot: slot++,
        home_reg: teams[0][0],
        home_reg2: teams[0][1],
        away_reg: teams[1][0],
        away_reg2: teams[1][1],
        status: 'pending',
      });
    }
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/** MEXICANO: genera la SIGUIENTE ronda emparejando por la clasificación actual. */
export async function generateMexicanoRound(
  tournament: Tournament,
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
  gender: string | null,
  category: string | null,
): Promise<void> {
  const players = regs.filter((r) => r.status !== 'withdrawn');
  const N = players.length;
  if (N < 4 || N % 4 !== 0)
    throw new Error('Para el mexicano hacen falta jugadores múltiplo de 4 (4, 8, 12…).');

  const existingRounds = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  if (existingRounds > 0) {
    const lastRound = matches.filter((m) => m.round === existingRounds);
    if (!lastRound.every((m) => m.status === 'finished'))
      throw new Error('Termina la ronda actual antes de generar la siguiente.');
  }
  const nextRound = existingRounds + 1;

  let ordered: string[];
  if (existingRounds === 0) {
    ordered = [...players]
      .sort(
        (a, b) =>
          (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
          (a.created_at < b.created_at ? -1 : 1),
      )
      .map((r) => r.id);
    await Promise.all(
      ordered.map((id, i) =>
        from()('tournament_registrations').update({ seed: i + 1 }).eq('id', id),
      ),
    );
  } else {
    ordered = computeIndividualStandings(players, matches).map((s) => s.regId);
  }

  const rows: Record<string, unknown>[] = [];
  const baseSlot = matches.length;
  for (let ct = 0; ct < N / 4; ct++) {
    const [a, b, cc, d] = ordered.slice(ct * 4, ct * 4 + 4);
    rows.push({
      tournament_id: tournament.id,
      gender,
      category,
      bracket: 'mex',
      round: nextRound,
      slot: baseSlot + ct,
      home_reg: a,
      home_reg2: d,
      away_reg: b,
      away_reg2: cc,
      status: 'pending',
    });
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/** Resultado social (puntos por equipo; sin sets, sin avance de cuadro). */
export async function setSocialResult(
  match: TournamentMatch,
  homePoints: number,
  awayPoints: number,
): Promise<void> {
  const winner = homePoints >= awayPoints ? match.home_reg : match.away_reg;
  const { error } = await from()('tournament_matches')
    .update({
      home_score: homePoints,
      away_score: awayPoints,
      winner_reg: winner,
      status: 'finished',
    })
    .eq('id', match.id);
  if (error) throw new Error(error.message);
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
  advance: boolean = true,
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
  if (!advance) return; // liga/grupo: no hay avance de cuadro.

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
  pair_based: boolean;
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
