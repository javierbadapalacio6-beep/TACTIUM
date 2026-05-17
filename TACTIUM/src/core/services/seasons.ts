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
    // total_matchdays es ahora OPCIONAL. Algunas temporadas (ej. playoffs
    // que dependen del cuadro final) no saben el total hasta avanzar.
    // BD migrada para permitir null y sin default 18.
    total_matchdays?: number | null;
    active?: boolean;
  },
): Promise<Season> {
  const payload: SeasonInsert = {
    team_id: teamId,
    name: input.name,
    category: input.category ?? null,
    phase: input.phase ?? 'liga',
    total_matchdays: input.total_matchdays ?? null,
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

/**
 * Cierra (archiva) una temporada. La marca `active=false` y fija `end_date`
 * a hoy si todavía estaba null. Tras esto la temporada aparece en el
 * histórico y el unique index `one_active_season_per_team` libera el slot
 * para que el capitán pueda crear la siguiente fase (playoff tras liga,
 * por ejemplo) sin colisión.
 *
 * NO borra jornadas ni resultados — el histórico queda intacto para
 * consultarlo en read-only.
 */
export async function closeSeason(id: string): Promise<Season> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('seasons')
    .update({ active: false, end_date: today })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
