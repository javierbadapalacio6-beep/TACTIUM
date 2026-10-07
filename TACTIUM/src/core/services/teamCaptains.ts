import { supabase } from '@core/supabase/client';

/**
 * «El plan Capitán cubre al equipo»: hasta 3 capitanes por equipo
 * independiente comparten el Pro de una sola suscripción. Un plan cubre UN
 * solo equipo: el de quien paga o, si no es dueño de ninguno, aquel en el que
 * es capitán desde hace más tiempo.
 *
 * La sub de otro capitán no se puede leer (RLS), así que todo sale de la RPC
 * `team_captain_coverage` (SECURITY DEFINER). Ver la migración
 * `20261007b_captain_plan_covers_team.sql`.
 */

export const CAPTAIN_SEATS = 3;

export const CAPTAIN_LIMIT_MESSAGE =
  'Este equipo ya tiene 3 capitanes: el máximo con el plan. Quita a uno para añadir otro.';

export interface TeamCaptain {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  role: 'captain' | 'admin' | 'player';
  is_owner: boolean;
  is_payer: boolean;
}

export interface TeamCaptainCoverage {
  team_id: string;
  covered: boolean;
  payer_user_id: string | null;
  payer_name: string | null;
  period_end: string | null;
  captain_count: number;
  captain_limit: number;
  captains: TeamCaptain[];
}

// La RPC es nueva y aún no está en database.types: llamada sin tipar.
function rpc() {
  return supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Cobertura de los equipos independientes de los que soy miembro. Con
 * `teamId` solo ese equipo. Los equipos de club no salen (su Pro es del club).
 */
export async function fetchTeamCaptainCoverage(
  teamId?: string | null,
): Promise<TeamCaptainCoverage[]> {
  const { data, error } = await rpc()(
    'team_captain_coverage',
    teamId ? { p_team_id: teamId } : {},
  );
  if (error) throw new Error(error.message);
  return ((data ?? []) as TeamCaptainCoverage[]).map((r) => ({
    ...r,
    captains: Array.isArray(r.captains) ? r.captains : [],
  }));
}

/** Pasa a un capitán a jugador. Solo el dueño o quien paga el plan. */
export async function demoteTeamCaptain(teamId: string, userId: string): Promise<void> {
  const { error } = await rpc()('demote_team_captain', {
    p_team_id: teamId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

/** dd/mm/aaaa */
export function formatCoverDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** «Ana, Leti» con los nombres de pila; sin la persona indicada. */
export function captainFirstNames(
  captains: TeamCaptain[],
  excludeUserId?: string | null,
): string[] {
  return captains
    .filter((c) => c.user_id !== excludeUserId)
    .map((c) => (c.name ?? '').trim().split(/\s+/)[0])
    .filter(Boolean);
}
