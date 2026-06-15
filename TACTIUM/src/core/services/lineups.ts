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

/**
 * Para cada matchday del listado, devuelve true si la variante activa
 * tiene TODAS las parejas (player_a y player_b no nulos) completas hasta
 * el nº de pistas pedido. Si el matchday no tiene variante activa o le
 * faltan parejas, devuelve false.
 *
 * Usado al cerrar temporada para contar jornadas "sin alineación" sin
 * tener que hacer N queries individuales (una por matchday).
 */
export async function fetchLineupCompletionByMatchdays(
  matchdayIds: string[],
  courts: number,
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const id of matchdayIds) result.set(id, false);
  if (matchdayIds.length === 0 || courts <= 0) return result;

  const { data: variants, error: vErr } = await supabase
    .from('lineup_variants')
    .select('id, matchday_id')
    .eq('is_active', true)
    .in('matchday_id', matchdayIds);
  if (vErr) throw vErr;
  const variantList = variants ?? [];
  if (variantList.length === 0) return result;

  const variantIds = variantList.map((v) => v.id);
  const { data: lineups, error: lErr } = await supabase
    .from('lineups')
    .select('variant_id')
    .in('variant_id', variantIds)
    .not('player_a_id', 'is', null)
    .not('player_b_id', 'is', null);
  if (lErr) throw lErr;

  const filledByVariant = new Map<string, number>();
  for (const l of lineups ?? []) {
    filledByVariant.set(
      l.variant_id,
      (filledByVariant.get(l.variant_id) ?? 0) + 1,
    );
  }
  for (const v of variantList) {
    const filled = filledByVariant.get(v.id) ?? 0;
    result.set(v.matchday_id, filled === courts);
  }
  return result;
}
