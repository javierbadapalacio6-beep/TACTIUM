"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { guardedWrite, type WriteResult } from "@/lib/writes";

/**
 * Marcador en vivo de una jornada (migración `20261006c_live_scoring`).
 * Copia de `TACTIUM/src/core/services/live.ts` + el hook de
 * `TACTIUM/src/core/hooks/useLiveMatchday.ts`: mismas RPC, mismas reglas.
 *
 * Marca cualquier miembro del equipo; el «marcador activo» de cada pista
 * tiene un bloqueo suave de 2 min (relevo con `force`). Cada toque lleva un
 * uuid (idempotente) y el nº de juegos que se veía (ordenado).
 */

export interface LiveSet {
  us: number;
  them: number;
}

export interface LiveCourtState {
  id: string;
  court_number: number;
  format: "normal" | "super_tb";
  status: "live" | "finished";
  sets: LiveSet[];
  winner: "us" | "them" | null;
  games_count: number;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  scorer_id: string | null;
  scorer_name: string | null;
  scorer_seen_at: string | null;
  scorer_active: boolean;
}

export interface LiveCourt {
  court_number: number;
  player_a: { id: string; name: string | null } | null;
  player_b: { id: string; name: string | null } | null;
  forfeit: boolean;
  forfeit_us: boolean;
  live: LiveCourtState | null;
}

export interface LiveMatchdayState {
  matchday_id: string;
  matchday_status: string;
  is_admin: boolean;
  can_score: boolean;
  share_token: string | null;
  courts: LiveCourt[];
}

export const LIVE_LOCK_MS = 2 * 60 * 1000;

export function livePath(token: string): string {
  return `/directo/${token}`;
}

export function liveUrl(token: string): string {
  return `https://tactium.io${livePath(token)}`;
}

/* ── RPC ───────────────────────────────────────────────────────────── */

export async function fetchLiveState(matchdayId: string): Promise<LiveMatchdayState> {
  const { data, error } = await supabaseBrowser().rpc("live_matchday_state", {
    p_matchday_id: matchdayId,
  });
  if (error) throw error;
  return data as LiveMatchdayState;
}

async function rpc<T>(what: string, fn: string, args: Record<string, unknown>): Promise<WriteResult<T>> {
  return guardedWrite(what, async () => {
    const { data, error } = await supabaseBrowser().rpc(fn, args);
    if (error) throw error;
    return data as T;
  });
}

export function claimCourt(matchdayId: string, court: number, force = false) {
  return rpc<LiveCourtState>("marcar la pista", "live_claim_court", {
    p_matchday_id: matchdayId,
    p_court: court,
    p_force: force,
  });
}

export async function releaseCourt(matchdayId: string, court: number): Promise<void> {
  await rpc<null>("soltar la pista", "live_release_court", { p_matchday_id: matchdayId, p_court: court });
}

export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function scoreGame(
  matchdayId: string,
  court: number,
  side: "us" | "them",
  eventId: string,
  expectedGames: number | null
) {
  return rpc<LiveCourtState>("apuntar el juego", "live_score_game", {
    p_matchday_id: matchdayId,
    p_court: court,
    p_side: side,
    p_event_id: eventId,
    p_expected_games: expectedGames,
  });
}

export function undoGame(matchdayId: string, court: number, expectedGames: number | null) {
  return rpc<LiveCourtState>("deshacer el juego", "live_undo_game", {
    p_matchday_id: matchdayId,
    p_court: court,
    p_expected_games: expectedGames,
  });
}

export function finishCourt(matchdayId: string, court: number) {
  return rpc<LiveCourtState>("terminar la pista", "live_finish_court", {
    p_matchday_id: matchdayId,
    p_court: court,
  });
}

export function createShareToken(matchdayId: string) {
  return rpc<string>("crear el enlace del directo", "live_share_create", { p_matchday_id: matchdayId });
}

/** Errores con pista: `hint` = live_locked / live_stale (lo pone la BD). */
export function isLockMessage(reason: string): boolean {
  return /Ahora la marca/.test(reason);
}
export function isStaleMessage(reason: string): boolean {
  return /acaba de cambiar/.test(reason);
}

/* ── Lógica pura (copia de la app) ─────────────────────────────────── */

export function activeScorer(live: LiveCourtState | null, myUserId: string | null, now = Date.now()): string | null {
  if (!live || !live.scorer_id || live.scorer_id === myUserId || !live.scorer_seen_at) return null;
  if (now - new Date(live.scorer_seen_at).getTime() > LIVE_LOCK_MS) return null;
  return live.scorer_name ?? "Un compañero";
}

export function setsWon(live: { sets: LiveSet[]; status: string; winner: string | null } | null) {
  if (!live) return { us: 0, them: 0 };
  const closed = live.status === "finished" || live.winner ? live.sets : live.sets.slice(0, -1);
  let us = 0;
  let them = 0;
  for (const s of closed) {
    if (s.us > s.them) us++;
    else if (s.them > s.us) them++;
  }
  return { us, them };
}

export type CourtOutcome = "won" | "lost" | "live" | "none";

export function courtOutcome(c: {
  forfeit: boolean;
  forfeit_us: boolean;
  live: { sets: LiveSet[]; status: string; winner: string | null } | null;
} | undefined): CourtOutcome {
  if (!c) return "none";
  if (c.forfeit) return c.forfeit_us ? "lost" : "won";
  if (!c.live) return "none";
  if (c.live.status === "finished") {
    let w = c.live.winner;
    if (!w) {
      const s = setsWon(c.live);
      w = s.us > s.them ? "us" : s.them > s.us ? "them" : null;
    }
    return w === "us" ? "won" : w === "them" ? "lost" : "none";
  }
  return "live";
}

export function liveTotals(courts: Parameters<typeof courtOutcome>[0][]) {
  let won = 0;
  let lost = 0;
  let live = 0;
  for (const c of courts) {
    const o = courtOutcome(c);
    if (o === "won") won++;
    else if (o === "lost") lost++;
    else if (o === "live") live++;
  }
  return { won, lost, live };
}

export function isLiveNow(state: LiveMatchdayState | null): boolean {
  if (!state || state.matchday_status === "finished") return false;
  return state.courts.some((c) => c.live?.status === "live" && !c.forfeit);
}

export function applyGameLocal(live: LiveCourtState, side: "us" | "them"): LiveCourtState {
  if (live.status === "finished") return live;
  const sets = live.sets.length ? live.sets.map((s) => ({ ...s })) : [{ us: 0, them: 0 }];
  const cur = sets[sets.length - 1];
  cur[side] += 1;
  const hi = Math.max(cur.us, cur.them);
  const diff = Math.abs(cur.us - cur.them);
  const stb = live.format === "super_tb" && sets.length === 3;
  const done = stb ? hi >= 10 && diff >= 2 : (hi >= 6 && diff >= 2) || hi === 7;
  let winner: "us" | "them" | null = null;
  if (done) {
    let us = 0;
    let them = 0;
    for (const s of sets) {
      if (s.us > s.them) us++;
      else them++;
    }
    if (us === 2) winner = "us";
    else if (them === 2) winner = "them";
    else sets.push({ us: 0, them: 0 });
  }
  return { ...live, sets, winner, status: winner ? "finished" : "live", games_count: live.games_count + 1 };
}

export function liveShareText(o: { teamName: string; opponent: string; jornada: number | null; token: string }) {
  const j = o.jornada != null ? ` · J${o.jornada}` : "";
  return `🎾 En directo: ${o.teamName} vs ${o.opponent}${j}\nSigue el marcador pista a pista, sin app:\n${liveUrl(o.token)}`;
}

/* ── Hook: estado + Realtime ───────────────────────────────────────── */

export function useLiveMatchday(matchdayId: string | null | undefined, enabled = true) {
  const [state, setState] = useState<LiveMatchdayState | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    if (!matchdayId) return;
    try {
      setState(await fetchLiveState(matchdayId));
    } catch {
      /* sin acceso o sin red: no se pinta */
    } finally {
      setLoading(false);
    }
  }, [matchdayId]);

  useEffect(() => {
    if (!enabled || !matchdayId) return;
    void reload();
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void reload(), 250);
    };
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`live:${matchdayId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_matches", filter: `matchday_id=eq.${matchdayId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results", filter: `matchday_id=eq.${matchdayId}` }, soon)
      .subscribe();
    // Red de seguridad si el socket se cae (pestaña dormida, wifi del club).
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 30_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearInterval(poll);
      void sb.removeChannel(channel);
    };
  }, [matchdayId, enabled, reload]);

  return { state, setState, loading, reload };
}

export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/* ── Público (anon) ────────────────────────────────────────────────── */

export interface PublicLiveCourt {
  court_number: number;
  pair: string | null;
  forfeit: boolean;
  forfeit_us: boolean;
  result_sets: LiveSet[];
  live: {
    status: "live" | "finished";
    format: string;
    sets: LiveSet[];
    winner: "us" | "them" | null;
    started_at: string;
    finished_at: string | null;
    updated_at: string;
  } | null;
}

export interface PublicLive {
  token: string;
  team_name: string;
  opponent: string;
  is_home: boolean;
  jornada_number: number | null;
  match_date: string | null;
  match_time: string | null;
  location: string | null;
  category: string | null;
  team_logo_url: string | null;
  matchday_status: string;
  score_for: number | null;
  score_against: number | null;
  updated_at: string | null;
  courts: PublicLiveCourt[];
}

export async function fetchPublicLive(token: string): Promise<PublicLive | null> {
  const { data, error } = await supabaseBrowser().rpc("public_live_by_token", { p_token: token });
  if (error) throw error;
  return (data as PublicLive | null) ?? null;
}
