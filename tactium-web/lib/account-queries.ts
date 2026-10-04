"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Consultas del bloque «Perfil y cuenta» (ajustes, mi suscripción, mis
 * números, inicio sin equipo). Van aparte de `lib/queries.ts` para no pisar
 * a otros bloques: son pocas y todas leen tablas o RPCs que ya existen.
 */

/* ── Avisos (profiles.notifications_enabled) ───────────────────────
   El mismo interruptor que la app. El backend (send-push y el cron de
   recordatorios) ya filtra por él. */
export async function fetchNotificationsEnabled(): Promise<boolean> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return true;
  const { data, error } = await sb
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as { notifications_enabled?: boolean } | null)?.notifications_enabled ?? true;
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Inicia sesión.");
  const { error } = await sb
    .from("profiles")
    .update({ notifications_enabled: enabled })
    .eq("id", user.id);
  if (error) throw error;
}

/* ── ¿El equipo tiene Pro? (para el jugador, sin decir quién paga) ──
   Equipo de club: sub del club viva + equipo cubierto (el jugador puede
   leer la sub de su club). Equipo independiente: la sub del capitán no se
   puede leer, así que se pregunta a `fn_has_premium_access` (SECURITY
   DEFINER) por el dueño del equipo. `null` = no se sabe. */
export async function fetchTeamPro(teamId: string): Promise<boolean | null> {
  const sb = supabaseBrowser();
  const { data: team, error } = await sb
    .from("teams")
    .select("id, owner_id, club_id, covered")
    .eq("id", teamId)
    .maybeSingle();
  if (error || !team) return null;
  const t = team as { id: string; owner_id: string; club_id: string | null; covered: boolean | null };
  if (t.club_id) {
    const { data: sub } = await sb
      .from("subscriptions")
      .select("id")
      .eq("subject_type", "club")
      .eq("subject_id", t.club_id)
      .in("status", ["trialing", "active", "grace_period"])
      .gt("current_period_end", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    return !!sub && !!t.covered;
  }
  const { data, error: rpcErr } = await sb.rpc("fn_has_premium_access", {
    p_user_id: t.owner_id,
    p_team_id: t.id,
  });
  if (rpcErr) return null;
  return data === true;
}

/* ── Suscripción del club (resumen en «Mi suscripción») ─────────── */
export interface ClubSubSummary {
  planTier: string;
  status: string;
  billingPeriod: string | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export async function fetchClubSubscription(clubId: string): Promise<ClubSubSummary | null> {
  const { data, error } = await supabaseBrowser()
    .from("subscriptions")
    .select("plan_tier, status, billing_period, current_period_end, cancel_at_period_end")
    .eq("subject_type", "club")
    .eq("subject_id", clubId)
    .in("status", ["trialing", "active", "grace_period"])
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    planTier: data.plan_tier,
    status: data.status,
    billingPeriod: data.billing_period,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  };
}

/** Equipos del club cubiertos por el plan (para «8 de 10»). */
export async function fetchClubCoveredCount(clubId: string): Promise<number> {
  const { count, error } = await supabaseBrowser()
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("covered", true);
  if (error) return 0;
  return count ?? 0;
}

/** Prueba SIN tarjeta de la base (`trial_*`) del propio usuario, si la hay. */
export async function fetchMyDbTrialEnd(): Promise<string | null> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("subscriptions")
    .select("current_period_end")
    .eq("subject_type", "user")
    .eq("subject_id", user.id)
    .eq("status", "trialing")
    .like("product_id", "trial_%")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { current_period_end?: string } | null)?.current_period_end ?? null;
}

/** ¿Hay una suscripción de TIENDA viva pagada por mí? (aviso al borrar). */
export async function fetchMyStoreSubscription(): Promise<"ios" | "android" | null> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("subscriptions")
    .select("platform, product_id")
    .eq("payer_user_id", user.id)
    .in("status", ["trialing", "active", "grace_period"])
    .in("platform", ["ios", "android"])
    .gt("current_period_end", new Date().toISOString())
    .limit(5);
  const row = ((data ?? []) as { platform: string; product_id: string | null }[]).find(
    (r) => !(r.product_id ?? "").startsWith("trial_"),
  );
  return row ? (row.platform as "ios" | "android") : null;
}

/* ── Códigos de partido (amistosos) ─────────────────────────────── */
export interface ClaimableParticipant {
  participant_id: string;
  name: string;
  side: number;
  played_on: string | null;
}

export async function getClaimableParticipants(code: string): Promise<ClaimableParticipant[]> {
  const { data, error } = await supabaseBrowser().rpc("get_claimable_participants", {
    p_code: code.trim(),
  });
  if (error) throw error;
  return (data ?? []) as ClaimableParticipant[];
}

export async function claimCasualParticipant(code: string, participantId: string): Promise<boolean> {
  const { data, error } = await supabaseBrowser().rpc("claim_casual_participant", {
    p_code: code.trim(),
    p_participant_id: participantId,
  });
  if (error) throw error;
  return data === true;
}

/** A cuántos sigues (para el paso «Seguir a 3 personas»). */
export async function fetchFollowingCount(userId: string): Promise<number> {
  const { data, error } = await supabaseBrowser().rpc("get_public_user_profile", {
    target: userId,
  });
  if (error) return 0;
  const p = (Array.isArray(data) ? data[0] : data) as { following_count?: number } | null;
  return Number(p?.following_count ?? 0);
}

/* ── Ranking interno de la plantilla (Mis números › Plantilla) ───── */
export interface RankRow {
  playerId: string;
  name: string;
  userId: string | null;
  played: number;
  won: number;
  lost: number;
  winRate: number | null;
  currentStreak: number;
}

/** Ranking por % de victorias de liga del equipo (todas sus temporadas). */
export async function fetchTeamRanking(teamId: string): Promise<RankRow[]> {
  const { fetchLeagueStatsBundle, computePlayerLeagueStats } = await import("./player-stats");
  const sb = supabaseBrowser();
  const [{ data: seasons, error: e1 }, { data: roster, error: e2 }] = await Promise.all([
    sb.from("seasons").select("id").eq("team_id", teamId),
    sb.from("players").select("id, name, user_id").eq("team_id", teamId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const bundle = await fetchLeagueStatsBundle((seasons ?? []).map((s) => s.id as string));
  return ((roster ?? []) as { id: string; name: string; user_id: string | null }[])
    .map((p) => {
      const st = computePlayerLeagueStats(p.id, bundle);
      return {
        playerId: p.id,
        name: p.name,
        userId: p.user_id,
        played: st.played,
        won: st.won,
        lost: st.lost,
        winRate: st.winRate,
        currentStreak: st.currentStreak,
      };
    })
    .filter((r) => r.played > 0)
    .sort(
      (a, b) =>
        (b.winRate ?? 0) - (a.winRate ?? 0) || b.won - a.won || b.played - a.played,
    );
}
