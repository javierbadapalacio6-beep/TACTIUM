import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Matchday = Database['public']['Tables']['matchdays']['Row'];
export type MatchdayInsert = Database['public']['Tables']['matchdays']['Insert'];
export type MatchdayStatus = Database['public']['Enums']['matchday_status'];

export async function fetchMatchdays(seasonId: string): Promise<Matchday[]> {
  const { data, error } = await supabase
    .from('matchdays')
    .select('*')
    .eq('season_id', seasonId)
    .order('jornada_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchUpcomingMatchday(seasonId: string): Promise<Matchday | null> {
  // "Próxima" = no terminada, sin outcome y con fecha futura (o sin fecha
  // programada todavía). Las jornadas pasadas sin acta NO son candidatas:
  // pertenecen al filtro "Jugadas · pendiente acta".
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('matchdays')
    .select('*')
    .eq('season_id', seasonId)
    .neq('status', 'finished')
    .is('outcome', null)
    .or(`match_date.is.null,match_date.gte.${today}`)
    .order('match_date', { ascending: true, nullsFirst: false })
    .order('jornada_number', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMatchday(id: string): Promise<Matchday | null> {
  const { data, error } = await supabase
    .from('matchdays')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function closeMatchday(id: string): Promise<Matchday> {
  const { data, error } = await supabase.rpc('close_matchday', {
    target_matchday: id,
  });
  if (error) throw error;
  return data as Matchday;
}

/**
 * Cierre manual: el usuario decide el outcome (V/E/D) sin necesidad de
 * tener cargados los resultados set a set. Útil para jornadas retroactivas
 * donde solo se conoce el resultado final.
 *
 * Opcionalmente se puede pasar el marcador agregado de la jornada
 * (score_for / score_against = partidos ganados / perdidos).
 */
export async function forceCloseMatchday(
  id: string,
  outcome: 'win' | 'draw' | 'loss',
  scoreFor?: number | null,
  scoreAgainst?: number | null,
): Promise<Matchday> {
  const patch: Database['public']['Tables']['matchdays']['Update'] = {
    outcome,
    status: 'finished',
  };
  if (scoreFor !== undefined) patch.score_for = scoreFor;
  if (scoreAgainst !== undefined) patch.score_against = scoreAgainst;
  const { data, error } = await supabase
    .from('matchdays')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type MatchOutcome = Database['public']['Enums']['match_outcome'];

export async function updateMatchday(
  id: string,
  patch: {
    opponent?: string;
    match_date?: string | null;
    match_time?: string | null;
    is_home?: boolean;
    location?: string | null;
    outcome?: MatchOutcome | null;
  },
): Promise<Matchday> {
  const { data, error } = await supabase
    .from('matchdays')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Reordena jornada_number de toda la temporada por fecha asc (NULL al final).
 * Llamar tras crear/editar la fecha de una jornada para mantener J01..JNN
 * en orden cronológico aunque las fechas se introduzcan desordenadas.
 */
export async function renumberSeasonMatchdays(seasonId: string): Promise<void> {
  const { error } = await supabase.rpc('renumber_season_matchdays', {
    target_season: seasonId,
  });
  if (error) throw error;
}

export async function createMatchday(
  seasonId: string,
  input: {
    jornada_number: number;
    opponent: string;
    match_date?: string;
    match_time?: string;
    is_home?: boolean;
    location?: string;
  },
): Promise<Matchday> {
  const payload: MatchdayInsert = {
    season_id: seasonId,
    jornada_number: input.jornada_number,
    opponent: input.opponent,
    match_date: input.match_date ?? null,
    match_time: input.match_time ?? null,
    is_home: input.is_home ?? true,
    location: input.location ?? null,
  };
  const { data, error } = await supabase
    .from('matchdays')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
