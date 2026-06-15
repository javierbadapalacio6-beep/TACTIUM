import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type TeamInvitation = Database['public']['Tables']['team_invitations']['Row'];
export type InvitableRole = Extract<
  Database['public']['Enums']['team_role'],
  'captain' | 'player'
>;

/**
 * Lista las invitaciones de un equipo. RLS solo deja ver al admin del team.
 */
export async function fetchTeamInvitations(
  teamId: string,
): Promise<TeamInvitation[]> {
  const { data, error } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Versión extendida con el perfil del usuario que canjeó cada código
 * (cuando `used_by` está poblado). Hace dos queries y mergea — no hay
 * FK declarada entre `team_invitations.used_by` y `profiles`, así que
 * PostgREST no puede hacer el join implícito.
 */
export interface TeamInvitationWithRedeemer extends TeamInvitation {
  redeemer: { id: string; full_name: string | null; email: string | null } | null;
}

export async function fetchTeamInvitationsWithRedeemers(
  teamId: string,
): Promise<TeamInvitationWithRedeemer[]> {
  const invitations = await fetchTeamInvitations(teamId);
  const userIds = Array.from(
    new Set(
      invitations
        .map((i) => i.used_by)
        .filter((u): u is string => u !== null),
    ),
  );
  if (userIds.length === 0) {
    return invitations.map((i) => ({ ...i, redeemer: null }));
  }
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  if (error) throw error;
  const byId = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );
  return invitations.map((i) => ({
    ...i,
    redeemer: i.used_by ? byId.get(i.used_by) ?? null : null,
  }));
}

/**
 * Crea una invitación. La BD genera el code y valida is_team_admin.
 */
export async function createInvitation(
  teamId: string,
  role: InvitableRole = 'captain',
): Promise<TeamInvitation> {
  const { data, error } = await supabase.rpc('create_team_invitation', {
    target_team: teamId,
    target_role: role,
  });
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la invitación');
  return data as unknown as TeamInvitation;
}

/**
 * Elimina una invitación. Solo admins del team (RLS).
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('team_invitations')
    .delete()
    .eq('id', invitationId);
  if (error) throw error;
}

/**
 * Canjea un code: añade al usuario al team_members y marca la invitación.
 */
export async function redeemInvitation(
  code: string,
): Promise<TeamInvitation> {
  const trimmed = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('redeem_team_invitation', {
    invitation_code: trimmed,
  });
  if (error) throw error;
  if (!data) throw new Error('No se pudo canjear el código');
  return data as unknown as TeamInvitation;
}

export function isInvitationActive(inv: TeamInvitation): boolean {
  return inv.used_at === null && new Date(inv.expires_at) > new Date();
}
