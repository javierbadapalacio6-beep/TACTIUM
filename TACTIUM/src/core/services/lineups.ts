import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type LineupPair = Database['public']['Views']['lineup_pairs']['Row'];

/**
 * Devuelve las parejas de UNA variante concreta. La identidad de una
 * alineación es ahora `(variant_id, court_number)`, no
 * `(matchday_id, court_number)` — un matchday tiene N variantes.
 */
export async function fetchLineup(variantId: string): Promise<LineupPair[]> {
  const { data, error } = await supabase
    .from('lineup_pairs')
    .select('*')
    .eq('variant_id', variantId)
    .order('court_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Upsert de una pareja en (variant_id, court_number). El matchday_id se
 * sigue persistiendo por compatibilidad con código que filtra por
 * matchday + para mantener la integridad referencial.
 */
export async function setLineupPair(
  matchdayId: string,
  variantId: string,
  courtNumber: number,
  playerAId: string | null,
  playerBId: string | null,
) {
  const { data, error } = await supabase
    .from('lineups')
    .upsert(
      {
        matchday_id: matchdayId,
        variant_id: variantId,
        court_number: courtNumber,
        player_a_id: playerAId,
        player_b_id: playerBId,
      },
      { onConflict: 'variant_id,court_number' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clearLineupPair(
  variantId: string,
  courtNumber: number,
) {
  const { error } = await supabase
    .from('lineups')
    .delete()
    .eq('variant_id', variantId)
    .eq('court_number', courtNumber);
  if (error) throw error;
}
