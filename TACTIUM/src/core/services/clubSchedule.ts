import { supabase } from '@core/supabase/client';

// Horarios de local del club (feedback Smash 2026-07-21). El RPC
// `get_club_home_schedule` y la columna `teams.preferred_home_slots` aún no
// están en los tipos generados → casts puntuales (como social.ts).

export interface ClubHomeMatch {
  matchday_id: string;
  team_id: string;
  team_name: string;
  jornada_number: number | null;
  match_date: string | null; // 'YYYY-MM-DD'
  match_time: string | null; // 'HH:MM:SS'
  location: string | null; // pista/lugar
  opponent: string | null;
  status: string;
  preferred_home_slots: string[]; // franjas favoritas del equipo ('HH:MM')
}

type RpcResult = { data: unknown; error: { message: string } | null };

/** Partidos de LOCAL (no cerrados) de todos los equipos del club. */
export async function getClubHomeSchedule(
  clubId: string,
): Promise<ClubHomeMatch[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('get_club_home_schedule', {
    target_club: clubId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClubHomeMatch[]).map((m) => ({
    ...m,
    preferred_home_slots: m.preferred_home_slots ?? [],
  }));
}

/** Guarda las franjas favoritas de local de un equipo (array de 'HH:MM'). */
export async function setTeamPreferredSlots(
  teamId: string,
  slots: string[],
): Promise<void> {
  const from = supabase.from.bind(supabase) as unknown as (
    table: string,
  ) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await from('teams')
    .update({ preferred_home_slots: slots })
    .eq('id', teamId);
  if (error) throw new Error(error.message);
}
