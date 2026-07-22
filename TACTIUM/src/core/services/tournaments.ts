import { supabase } from '@core/supabase/client';

// Torneos del club (Fase 1: KO). Las tablas aún no están en los tipos
// generados → casts puntuales (mismo patrón que social.ts / clubSchedule.ts).

export type TournamentFormat = 'ko' | 'groups_ko' | 'round_robin' | 'americano';
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
  category: string | null;
  status: TournamentStatus;
  starts_on: string | null;
  signup_code: string | null;
  max_pairs: number | null;
  pair_based: boolean;
  created_at: string;
}

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
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
  category?: string | null;
  startsOn?: string | null;
  maxPairs?: number | null;
}): Promise<Tournament> {
  const payload = {
    club_id: input.clubId,
    name: input.name,
    format: input.format,
    category: input.category ?? null,
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

/** Inscripción pública por código (el que llama es el jugador 1). */
export async function signupByCode(input: {
  code: string;
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
  });
  if (error) throw new Error(error.message);
  return data as string;
}
