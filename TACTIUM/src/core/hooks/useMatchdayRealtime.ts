import { useEffect, useRef } from 'react';

import { supabase } from '@core/supabase/client';

interface UseMatchdayRealtimeOptions {
  matchdayId: string | null | undefined;
  // Disparado ante cualquier evento INSERT/UPDATE/DELETE en lineups,
  // lineup_variants, match_results o el propio matchday. El consumidor
  // decide qué refetchar (típicamente un refresh local de su state).
  onChange: () => void;
  // Permite desactivar puntualmente el canal (ej. cuando la pantalla
  // aún no tiene el matchdayId resuelto).
  enabled?: boolean;
}

// Suscribe un único canal Supabase Realtime para todas las tablas que
// pueden cambiar dentro del ciclo de vida de una jornada concreta. Cada
// pantalla relacionada (JornadaScreen, LineupScreen, ResultsScreen) lo
// usa con su propio refetch — el canal se abre al montar y se cierra al
// desmontar, así no quedan suscripciones colgando.
//
// Filtros aplicados:
//   · lineups        filter=matchday_id=eq.{id}
//   · lineup_variants filter=matchday_id=eq.{id}
//   · match_results  filter=matchday_id=eq.{id}
//   · matchdays      filter=id=eq.{id}  (el matchday propio: status/outcome)
//
// Mantenemos el callback en una ref para no tener que recrear el canal
// cada vez que el padre re-renderiza con una nueva referencia de función.
export function useMatchdayRealtime({
  matchdayId,
  onChange,
  enabled = true,
}: UseMatchdayRealtimeOptions) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !matchdayId) return;
    const fire = () => cbRef.current();
    // Sufijo único por mount: en dev con StrictMode el effect se ejecuta
    // dos veces (mount → cleanup → mount). Si reusamos el mismo topic
    // (`matchday:{id}`) el cliente Supabase devuelve la referencia previa
    // que sigue marcada como suscrita, y el segundo `.on(...)` lanza:
    //   "cannot add postgres_changes callbacks after subscribe()".
    // Un sufijo random evita la colisión.
    const topic = `matchday:${matchdayId}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lineups',
          filter: `matchday_id=eq.${matchdayId}`,
        },
        fire,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lineup_variants',
          filter: `matchday_id=eq.${matchdayId}`,
        },
        fire,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_results',
          filter: `matchday_id=eq.${matchdayId}`,
        },
        fire,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchdays',
          filter: `id=eq.${matchdayId}`,
        },
        fire,
      )
      .subscribe();
    return () => {
      // `removeChannel` libera la referencia interna del cliente (a
      // diferencia de `channel.unsubscribe()` que solo cierra el WS).
      // Sin esto, el array interno `supabase.realtime.channels` crece
      // con cada mount y eventualmente colisionan los nuevos.
      supabase.removeChannel(channel);
    };
  }, [matchdayId, enabled]);
}
