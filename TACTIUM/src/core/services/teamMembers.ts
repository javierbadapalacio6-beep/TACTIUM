import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type TeamMember = Database['public']['Tables']['team_members']['Row'];
export type TeamRole = Database['public']['Enums']['team_role'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

export type TeamMemberWithProfile = TeamMember & {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
};

/**
 * Devuelve todas las membresías de equipo del usuario autenticado.
 * Una sola query para que el cliente pueda derivar el role activo
 * sin un round-trip por cada cambio de equipo.
 */
export async function fetchMyMemberships(): Promise<TeamMember[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Lista los miembros de un equipo enriquecidos con el perfil correspondiente.
 * Hacemos dos queries (members + profiles) en lugar de un join FK porque
 * `profiles.id → auth.users.id` no está expresado como FK en la PostgREST API
 * y ese embed devolvería null.
 */
export async function fetchTeamMembersWithProfiles(
  teamId: string,
): Promise<TeamMemberWithProfile[]> {
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  if (membersError) throw membersError;

  if (!members || members.length === 0) return [];

  const userIds = Array.from(new Set(members.map((m) => m.user_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', userIds);
  if (profilesError) throw profilesError;

  const byId = new Map<string, TeamMemberWithProfile['profile']>(
    (profiles ?? []).map((p) => [p.id, p]),
  );
  return members.map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null }));
}

export async function updateTeamMemberRole(
  memberId: string,
  role: TeamRole,
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}
