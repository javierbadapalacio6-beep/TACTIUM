"use client";

import { useEffect, useRef } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

const DEBOUNCE_MS = 400;

/**
 * Disponibilidad de una jornada (y, con `scope: "poll"`, su encuesta de hora) en tiempo real, para la web
 * con sesión. Espejo de `useAvailabilityRealtime` de la app.
 *
 * Las tablas de votos y horas no tienen `matchday_id` y los DELETE no admiten filtro: llegan sin filtrar,
 * RLS deja pasar solo lo del equipo del usuario y el evento solo dispara una recarga (con debounce).
 * El enlace público (sin sesión) no usa esto: refresca cada 10 s con la RPC anónima.
 */
export function useAvailabilityRealtime(
  matchdayId: string | null | undefined,
  onChange: () => void,
  scope: "availability" | "poll" = "availability",
  enabled = true,
) {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !matchdayId) return;
    let sb;
    try {
      sb = supabaseBrowser();
    } catch {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), DEBOUNCE_MS);
    };
    const topic = `avail:${scope}:${matchdayId}:${Math.random().toString(36).slice(2, 8)}`;
    let channel = sb.channel(topic).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "availability", filter: `matchday_id=eq.${matchdayId}` },
      fire,
    );
    if (scope === "poll") {
      channel = channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "matchday_time_polls", filter: `matchday_id=eq.${matchdayId}` },
          fire,
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "matchday_time_poll_options" }, fire)
        .on("postgres_changes", { event: "*", schema: "public", table: "matchday_time_poll_votes" }, fire);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [matchdayId, scope, enabled]);
}
