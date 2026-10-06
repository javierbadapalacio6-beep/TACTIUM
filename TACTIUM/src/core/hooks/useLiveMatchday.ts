import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@core/supabase/client';
import { fetchLiveState, type LiveMatchdayState } from '@core/services/live';

/**
 * Estado en vivo de una jornada + Realtime.
 *
 * Abre UN canal sobre `live_matches` y `match_results` de la jornada (la RLS
 * filtra al equipo) y relee `live_matchday_state` ante cualquier cambio, con
 * un pequeño debounce para no releer 5 veces seguidas. Mismo patrón que
 * `useMatchdayRealtime` (sufijo aleatorio en el topic por StrictMode).
 */
export function useLiveMatchday(matchdayId: string | null | undefined, enabled = true) {
  const [state, setState] = useState<LiveMatchdayState | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!matchdayId) return;
    try {
      const s = await fetchLiveState(matchdayId);
      if (alive.current) setState(s);
    } catch (e) {
      // Sin acceso o sin red: el marcador simplemente no se pinta.
      console.warn('live state', e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [matchdayId]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !matchdayId) return;
    setLoading(true);
    reload();
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(reload, 250);
    };
    const topic = `live:${matchdayId}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_matches', filter: `matchday_id=eq.${matchdayId}` },
        soon,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_results', filter: `matchday_id=eq.${matchdayId}` },
        soon,
      )
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [matchdayId, enabled, reload]);

  return { state, setState, loading, reload };
}

/** Reloj que avanza cada `ms` (para que el «La marca Fulano» caduque solo). */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
