import { useEffect, useRef } from 'react';

import { supabase } from '@core/supabase/client';

interface Options {
  matchdayId: string | null | undefined;
  /** Disparado (con debounce) cuando alguien responde o vota. El consumidor recarga. */
  onChange: () => void;
  /** `poll` añade la encuesta de hora (encuesta, horas y votos) a la disponibilidad. */
  scope?: 'availability' | 'poll';
  enabled?: boolean;
}

const DEBOUNCE_MS = 400;

/**
 * Disponibilidad de una jornada (y, con `scope: 'poll'`, su encuesta de hora) en tiempo real.
 *
 * Las tablas de votos y horas no tienen `matchday_id`, y los DELETE no admiten filtro, así que esas dos
 * llegan sin filtrar: RLS deja pasar solo lo del equipo del usuario y el evento solo dispara una recarga.
 * Varios eventos seguidos (p. ej. quitar una hora reescribe votos) se juntan en una sola recarga.
 */
export function useAvailabilityRealtime({
  matchdayId,
  onChange,
  scope = 'availability',
  enabled = true,
}: Options) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !matchdayId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), DEBOUNCE_MS);
    };
    // Sufijo aleatorio por mount (StrictMode): ver useMatchdayRealtime.
    const topic = `avail:${scope}:${matchdayId}:${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(topic).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'availability', filter: `matchday_id=eq.${matchdayId}` },
      fire,
    );
    if (scope === 'poll') {
      channel = channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matchday_time_polls', filter: `matchday_id=eq.${matchdayId}` },
          fire,
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_time_poll_options' }, fire)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matchday_time_poll_votes' }, fire);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [matchdayId, scope, enabled]);
}
