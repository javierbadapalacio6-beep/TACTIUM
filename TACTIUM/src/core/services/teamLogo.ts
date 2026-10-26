import { supabase } from '@core/supabase/client';

/**
 * Logo para las tarjetas de compartir: el del CLUB del equipo si lo tiene y, si no, el del equipo
 * (RPC `team_share_logo`: `clubs` no es legible para capitanes ni jugadores). null si falla o no hay.
 */
export async function fetchTeamShareLogo(teamId: string): Promise<string | null> {
  try {
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: unknown }>;
    const { data, error } = await rpc('team_share_logo', { p_team_id: teamId });
    return error ? null : (data ?? null);
  } catch {
    return null;
  }
}
