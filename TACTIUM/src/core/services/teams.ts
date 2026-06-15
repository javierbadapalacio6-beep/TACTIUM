import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Team = Database['public']['Tables']['teams']['Row'];
export type TeamInsert = Database['public']['Tables']['teams']['Insert'];
export type TeamUpdate = Database['public']['Tables']['teams']['Update'];
export type TeamGender = Database['public']['Enums']['team_gender'];

/**
 * Marca un equipo de club como CUBIERTO por el plan (permanente). El RPC
 * `cover_team` valida que el caller es el gestor del club y que quedan plazas
 * según el tier; si no, lanza error. Idempotente.
 */
export async function coverTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc('cover_team', { p_team_id: teamId });
  if (error) throw error;
}

/**
 * Borra un equipo y su árbol en cascada (jugadores, temporadas, jornadas,
 * alineaciones, actas, miembros, invitaciones). Vía RPC `delete_team` que
 * valida propiedad. Irreversible.
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_team', { p_team_id: teamId });
  if (error) throw error;
}

/**
 * Devuelve todos los equipos visibles para el usuario.
 * RLS garantiza que solo aparecen los equipos donde es miembro directo
 * (team_members) o club_admin del club al que pertenece el equipo.
 */
export async function fetchMyTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * @deprecated usar fetchMyTeams() y elegir el equipo activo en el cliente.
 * Se mantiene por compatibilidad mientras la UI todavía no expone selector.
 */
export async function fetchMyPrimaryTeam(): Promise<Team | null> {
  const teams = await fetchMyTeams();
  return teams[0] ?? null;
}

export async function createTeam(input: {
  name: string;
  federation?: string;
  league?: string;
  category?: string;
  group?: string;
  gender?: TeamGender;
  clubId?: string;
}): Promise<Team> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    throw new Error(
      'No hay sesión activa. Cierra y vuelve a iniciar sesión.',
    );
  }

  const payload: TeamInsert = {
    owner_id: session.user.id,
    name: input.name,
    federation: input.federation || null,
    league: input.league || null,
    category: input.category || null,
    group_name: input.group || null,
    gender: input.gender ?? 'masculino',
    club_id: input.clubId ?? null,
  };

  const { data, error } = await supabase
    .from('teams')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTeam(id: string, patch: TeamUpdate): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
