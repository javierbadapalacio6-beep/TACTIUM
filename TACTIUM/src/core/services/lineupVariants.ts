import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type LineupVariant =
  Database['public']['Tables']['lineup_variants']['Row'];
export type LineupVariantInsert =
  Database['public']['Tables']['lineup_variants']['Insert'];

/**
 * Devuelve la variante marcada como oficial de una jornada. Las pantallas
 * Jornada/Results siempre leen de aquí — la variante activa es la única
 * que cuenta para el acta. Devuelve null si la jornada no tiene variantes
 * (no debería pasar gracias al trigger `matchday_create_default_variant`).
 */
export async function fetchActiveVariant(
  matchdayId: string,
): Promise<LineupVariant | null> {
  const { data, error } = await supabase
    .from('lineup_variants')
    .select('*')
    .eq('matchday_id', matchdayId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Devuelve las variantes de una jornada ordenadas por fecha de creación.
 * El trigger de matchday garantiza que siempre exista al menos una
 * "Variante 1" activa.
 */
export async function listVariants(
  matchdayId: string,
): Promise<LineupVariant[]> {
  const { data, error } = await supabase
    .from('lineup_variants')
    .select('*')
    .eq('matchday_id', matchdayId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea una variante nueva. El trigger `enforce_max_lineup_variants`
 * lanza error si ya hay 5 en esa jornada.
 */
export async function createVariant(
  matchdayId: string,
  label: string,
): Promise<LineupVariant> {
  const { data, error } = await supabase
    .from('lineup_variants')
    .insert({ matchday_id: matchdayId, label })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVariantLabel(
  id: string,
  label: string,
): Promise<LineupVariant> {
  const { data, error } = await supabase
    .from('lineup_variants')
    .update({ label })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * No deja eliminar la variante activa: hay que marcar otra como activa
 * primero. Esa regla la enforza el cliente; a nivel BD se permite y la
 * jornada quedaría sin variante activa, lo cual romperia la lectura.
 */
export async function deleteVariant(id: string): Promise<void> {
  const { error } = await supabase
    .from('lineup_variants')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Marca una variante como oficial (activa). Atómico: la RPC desactiva
 * el resto de variantes de la misma jornada en la misma transacción.
 */
export async function setActiveVariant(id: string): Promise<LineupVariant> {
  const { data, error } = await supabase.rpc('set_active_lineup_variant', {
    p_variant_id: id,
  });
  if (error) throw error;
  return data as LineupVariant;
}

/**
 * Copia las parejas de una variante a otra. Borra primero las parejas
 * existentes en target y luego inserta las nuevas. Útil al "duplicar".
 */
export async function cloneVariantPairs(
  sourceId: string,
  targetId: string,
): Promise<void> {
  const { error } = await supabase.rpc('clone_lineup_variant_pairs', {
    p_source_variant_id: sourceId,
    p_target_variant_id: targetId,
  });
  if (error) throw error;
}

/**
 * Renumera las variantes con label por defecto ("Variante N") en orden
 * cronológico para que sean 1, 2, 3… sin huecos. Variantes con label
 * personalizado se respetan. Útil tras un delete para evitar gaps tipo
 * [Variante 1, Variante 3] que confundirían al usuario.
 *
 * Aprovecha el orden de created_at: como vamos del más antiguo al más
 * nuevo, cualquier rename hacia un número menor no choca con el unique
 * (matchday_id, label) porque el dueño anterior ya fue renombrado.
 */
export async function renumberDefaultVariants(matchdayId: string): Promise<void> {
  const vars = await listVariants(matchdayId);
  const defaultPattern = /^Variante \d+$/;
  let counter = 1;
  for (const v of vars) {
    if (!defaultPattern.test(v.label)) continue;
    const expected = `Variante ${counter}`;
    if (v.label !== expected) {
      await updateVariantLabel(v.id, expected);
    }
    counter += 1;
  }
}

/**
 * Atajo: crea una variante nueva y, si se pasa `cloneFromId`, copia las
 * parejas de la variante origen.
 */
export async function createVariantWithClone(
  matchdayId: string,
  label: string,
  cloneFromId?: string,
): Promise<LineupVariant> {
  const created = await createVariant(matchdayId, label);
  if (cloneFromId) {
    try {
      await cloneVariantPairs(cloneFromId, created.id);
    } catch (e) {
      // Si falla el clone, dejamos la variante creada vacía pero no
      // borramos para no perder el progreso del usuario.
      console.warn('cloneVariantPairs failed', e);
      throw e;
    }
  }
  return created;
}
