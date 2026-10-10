import { supabaseAnon } from "@/lib/supabase/anon";
import { cleanToken } from "@/lib/seo/live";
import { longDate } from "@/lib/availability-text";

/** Cabecera del enlace de disponibilidad para metadatos y OG (anon, sin cookies). */
export interface AvailabilityHead {
  team_name: string;
  opponent: string;
  jornada_number: number | null;
  date: string | null;
  time: string | null;
  category: string | null;
  pending: number;
  yes: number;
}

export async function loadAvailabilityHead(token: string): Promise<AvailabilityHead | null> {
  const sb = supabaseAnon();
  if (!sb) return null;
  const { data, error } = await sb.rpc("public_availability_by_token", { p_token: cleanToken(token) });
  if (error || !data || (data as { valid?: boolean }).valid !== true) return null;
  const d = data as {
    team_name: string;
    opponent: string;
    jornada_number: number | null;
    match_date: string | null;
    match_time: string | null;
    category: string | null;
    counts: { yes: number; pending: number };
  };
  return {
    team_name: d.team_name,
    opponent: d.opponent,
    jornada_number: d.jornada_number,
    date: d.match_date,
    time: d.match_time,
    category: d.category,
    pending: d.counts?.pending ?? 0,
    yes: d.counts?.yes ?? 0,
  };
}

export function availabilityTitle(h: AvailabilityHead): string {
  return `¿Puedes jugar contra ${h.opponent}?${h.jornada_number != null ? ` · J${h.jornada_number}` : ""}`;
}

export function availabilityWhen(h: AvailabilityHead): string | null {
  const d = longDate(h.date);
  if (!d) return null;
  return h.time ? `${d} · ${h.time.slice(0, 5)}` : d;
}
