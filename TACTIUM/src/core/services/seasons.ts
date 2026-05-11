import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Season = Database['public']['Tables']['seasons']['Row'];
export type SeasonInsert = Database['public']['Tables']['seasons']['Insert'];
export type SeasonPhase = Database['public']['Enums']['season_phase'];

export async function fetchSeasons(teamId: string): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('team_id', teamId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSeasonById(id: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchActiveSeason(teamId: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('team_id', teamId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSeason(
  teamId: string,
  input: {
    name: string;
    category?: string;
    phase?: SeasonPhase;
    total_matchdays?: number;
    active?: boolean;
  },
): Promise<Season> {
  const payload: SeasonInsert = {
    team_id: teamId,
    name: input.name,
    category: input.category ?? null,
    phase: input.phase ?? 'liga',
    total_matchdays: input.total_matchdays ?? 18,
    active: input.active ?? false,
  };
  const { data, error } = await supabase
    .from('seasons')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
