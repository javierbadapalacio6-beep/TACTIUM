"use client";

import { supabaseBrowser } from "./supabase/client";

/** Logo para las tarjetas de compartir: el del club del equipo si lo tiene y, si no, el del equipo (RPC `team_share_logo`). */
export async function fetchTeamShareLogo(teamId: string): Promise<string | null> {
  try {
    const rpc = supabaseBrowser().rpc.bind(supabaseBrowser()) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: unknown }>;
    const { data, error } = await rpc("team_share_logo", { p_team_id: teamId });
    return error ? null : (data ?? null);
  } catch {
    return null;
  }
}
