import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type MatchResult = Database['public']['Tables']['match_results']['Row'];

export async function fetchResults(matchdayId: string): Promise<MatchResult[]> {
  const { data, error } = await supabase
    .from('match_results')
    .select('*')
    .eq('matchday_id', matchdayId)
    .order('court_number', { ascending: true })
    .order('set_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSet(
  matchdayId: string,
  courtNumber: number,
  setNumber: number,
  us: number | null,
  them: number | null,
): Promise<MatchResult> {
  const { data, error } = await supabase
    .from('match_results')
    .upsert(
      {
        matchday_id: matchdayId,
        court_number: courtNumber,
        set_number: setNumber,
        us,
        them,
        forfeit: false,
      },
      { onConflict: 'matchday_id,court_number,set_number' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Marca una pista como W.O. (no presentado): inserta los `sets` esperados con
 * forfeit=true y us=them=null. Si forfeit=false, elimina las filas de la pista
 * para volver al estado "sin resultado".
 */
export async function setCourtForfeit(
  matchdayId: string,
  courtNumber: number,
  forfeit: boolean,
  sets = 3,
): Promise<void> {
  if (forfeit) {
    const rows = Array.from({ length: sets }, (_, i) => ({
      matchday_id: matchdayId,
      court_number: courtNumber,
      set_number: i + 1,
      us: null,
      them: null,
      forfeit: true,
    }));
    const { error } = await supabase
      .from('match_results')
      .upsert(rows, { onConflict: 'matchday_id,court_number,set_number' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('match_results')
      .delete()
      .eq('matchday_id', matchdayId)
      .eq('court_number', courtNumber);
    if (error) throw error;
  }
}
