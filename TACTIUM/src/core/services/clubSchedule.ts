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

// Suma `n` días a una fecha 'YYYY-MM-DD'.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Partidos de la "jornada en juego": la ventana de ~1 semana desde el partido
 * de local más próximo. Evita mostrar todas las jornadas de la temporada
 * cuando el club tiene muchos equipos — solo el turno actual. Los partidos sin
 * fecha se incluyen siempre (aún por calendarizar). Comparación lexicográfica
 * de fechas ISO (válida para 'YYYY-MM-DD').
 */
export function currentRoundMatches(matches: ClubHomeMatch[]): ClubHomeMatch[] {
  const dated = matches
    .filter((m) => m.match_date)
    .sort((a, b) => (a.match_date! < b.match_date! ? -1 : 1));
  if (dated.length === 0) return matches;
  const d0 = dated[0].match_date!;
  const end = addDays(d0, 6);
  return matches.filter(
    (m) => !m.match_date || (m.match_date >= d0 && m.match_date <= end),
  );
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
