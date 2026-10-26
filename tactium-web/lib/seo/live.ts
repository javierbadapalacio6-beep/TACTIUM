import { supabaseAnon } from "@/lib/supabase/anon";

/** Cabecera del directo público para metadatos y OG (anon, sin cookies). */
export interface LiveHead {
  team_name: string;
  opponent: string;
  jornada_number: number | null;
  matchday_status: string;
  category: string | null;
  won: number;
  lost: number;
  live: number;
}

import { courtOutcome, liveCtx, type CourtLike, type StateLike } from "@/lib/live-core";

type Court = CourtLike;

export function cleanToken(raw: string): string {
  let t = raw;
  try {
    t = decodeURIComponent(raw);
  } catch {
    /* tal cual */
  }
  return t.trim().toLowerCase();
}

export async function loadLiveHead(token: string): Promise<LiveHead | null> {
  const sb = supabaseAnon();
  if (!sb) return null;
  const { data, error } = await sb.rpc("public_live_by_token", { p_token: cleanToken(token) });
  if (error || !data) return null;
  const d = data as Omit<LiveHead, "won" | "lost" | "live"> &
    Pick<StateLike, "match_date" | "match_time"> & { courts: Court[] };
  const ctx = liveCtx({ ...d, courts: d.courts ?? [] });
  let won = 0;
  let lost = 0;
  let live = 0;
  for (const c of d.courts ?? []) {
    const o = courtOutcome(c, ctx);
    if (o === "won") won++;
    else if (o === "lost") lost++;
    else if (o === "live") live++;
  }
  return {
    team_name: d.team_name,
    opponent: d.opponent,
    jornada_number: d.jornada_number,
    matchday_status: d.matchday_status,
    category: d.category,
    won,
    lost,
    live,
  };
}

export function liveTitle(h: LiveHead): string {
  return `Directo: ${h.team_name} vs ${h.opponent}${h.jornada_number != null ? ` · J${h.jornada_number}` : ""}`;
}
