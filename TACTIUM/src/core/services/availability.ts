import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Availability = Database['public']['Tables']['availability']['Row'];

export async function fetchAvailability(
  matchdayId: string,
): Promise<Availability[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('matchday_id', matchdayId);
  if (error) throw error;
  return data ?? [];
}

export async function setAvailability(
  matchdayId: string,
  playerId: string,
  available: boolean,
): Promise<Availability> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('availability')
    .upsert(
      {
        matchday_id: matchdayId,
        player_id: playerId,
        available,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'matchday_id,player_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
