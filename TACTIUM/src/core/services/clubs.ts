import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Club = Database['public']['Tables']['clubs']['Row'];
export type ClubInsert = Database['public']['Tables']['clubs']['Insert'];
export type ClubUpdate = Database['public']['Tables']['clubs']['Update'];
export type ClubMember = Database['public']['Tables']['club_members']['Row'];
export type ClubRole = Database['public']['Enums']['club_role'];

export async function fetchMyClubs(): Promise<Club[]> {
  // RLS: solo devuelve clubes donde el usuario es owner o club_admin.
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createClub(input: {
  name: string;
  federation?: string;
}): Promise<Club> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    throw new Error('No hay sesión activa. Cierra y vuelve a iniciar sesión.');
  }
  const payload: ClubInsert = {
    owner_id: session.user.id,
    name: input.name,
    federation: input.federation ?? null,
  };
  const { data, error } = await supabase
    .from('clubs')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClub(id: string, patch: ClubUpdate): Promise<Club> {
  const { data, error } = await supabase
    .from('clubs')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
