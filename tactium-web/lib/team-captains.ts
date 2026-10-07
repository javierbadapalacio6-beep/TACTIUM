"use client";

import { supabaseBrowser } from "./supabase/client";
import { fetchSubscription } from "./queries";

/**
 * «El plan Capitán cubre al equipo»: hasta 3 capitanes por equipo
 * independiente comparten el Pro de una sola suscripción. Un plan cubre UN
 * solo equipo: el de quien paga o, si no es dueño de ninguno, aquel en el que
 * es capitán desde hace más tiempo. Misma regla que la
 * app (`TACTIUM/src/core/services/teamCaptains.ts`).
 *
 * La sub de otro capitán no se puede leer (RLS): todo sale de la RPC
 * `team_captain_coverage` (SECURITY DEFINER). El límite de 3 lo pone un
 * trigger en `team_members`, tanto al canjear el código como al ascender.
 */

export const CAPTAIN_SEATS = 3;

export interface TeamCaptain {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  role: "captain" | "admin" | "player";
  is_owner: boolean;
  is_payer: boolean;
}

export interface TeamCaptainCoverage {
  team_id: string;
  covered: boolean;
  payer_user_id: string | null;
  payer_name: string | null;
  period_end: string | null;
  captain_count: number;
  captain_limit: number;
  captains: TeamCaptain[];
}

/** Cobertura de un equipo independiente en el que estoy. `null` si es de club o no estoy. */
export async function fetchTeamCaptainCoverage(teamId: string): Promise<TeamCaptainCoverage | null> {
  const { data, error } = await supabaseBrowser().rpc("team_captain_coverage", { p_team_id: teamId });
  if (error) throw error;
  const row = ((data ?? []) as TeamCaptainCoverage[])[0] ?? null;
  return row ? { ...row, captains: Array.isArray(row.captains) ? row.captains : [] } : null;
}

/** Pasa a un capitán a jugador. Solo el dueño o quien paga el plan. */
export async function demoteTeamCaptain(teamId: string, userId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("demote_team_captain", {
    p_team_id: teamId,
    p_user_id: userId,
  });
  if (error) throw error;
}

/** Cobertura de TODOS mis equipos independientes (para «Mi suscripción»). */
export async function fetchAllTeamCaptainCoverage(): Promise<TeamCaptainCoverage[]> {
  const { data, error } = await supabaseBrowser().rpc("team_captain_coverage", {});
  if (error) throw error;
  return ((data ?? []) as TeamCaptainCoverage[]).map((r) => ({
    ...r,
    captains: Array.isArray(r.captains) ? r.captains : [],
  }));
}

/**
 * ¿Tengo Pro para gestionar ESTE equipo? En un equipo independiente lo decide
 * la base (`fn_has_premium_access`): mi plan, o el plan Capitán que cubre este
 * equipo (uno por plan). Sin equipo independiente (`null`): cualquier
 * suscripción viva, como antes.
 */
export async function fetchProForTeam(teamId: string | null): Promise<boolean> {
  if (!teamId) return !!(await fetchSubscription().catch(() => null));
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;
  const { data, error } = await sb.rpc("fn_has_premium_access", {
    p_user_id: user.id,
    p_team_id: teamId,
  });
  if (error) return !!(await fetchSubscription().catch(() => null));
  return data === true;
}

/** dd/mm/aaaa */
export function formatCoverDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Nombres de pila de los capitanes, sin la persona indicada. */
export function captainFirstNames(captains: TeamCaptain[], excludeUserId?: string | null): string[] {
  return captains
    .filter((c) => c.user_id !== excludeUserId)
    .map((c) => (c.name ?? "").trim().split(/\s+/)[0])
    .filter(Boolean);
}
