import { supabase } from '@core/supabase/client';
import { pairKey, type PairStatsMap } from '@core/utils/lineupGenerator';

/**
 * Llama a la RPC `team_pair_stats` (química por historial) y devuelve un mapa
 * pairKey -> { wins, played } listo para pasar al generador de alineaciones.
 *
 * No es crítico: si falla (sin jornadas cerradas, error de red), el caller
 * debería seguir generando solo con posición + puntos. Por eso devolvemos un
 * mapa vacío en lugar de propagar en algunos callers.
 */
export async function fetchPairStats(teamId: string): Promise<PairStatsMap> {
  const { data, error } = await supabase.rpc('team_pair_stats', {
    p_team_id: teamId,
  });
  if (error) throw error;
  const map: PairStatsMap = new Map();
  for (const row of data ?? []) {
    map.set(pairKey(row.player_a, row.player_b), {
      wins: row.wins,
      played: row.played,
    });
  }
  return map;
}
