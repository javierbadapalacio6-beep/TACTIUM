import { supabase } from '@core/supabase/client';

/**
 * Marcador en vivo de una jornada (migración `20261006c_live_scoring`).
 *
 * Todo pasa por RPC: el estado se lee con `live_matchday_state` y se escribe
 * con `live_claim_court` / `live_score_game` / `live_undo_game` /
 * `live_finish_court`. Marca cualquier miembro del equipo; el «marcador
 * activo» de cada pista tiene un bloqueo suave de 2 min (relevo con
 * `force`). Espejo web: `tactium-web/lib/live.ts`.
 */

export interface LiveSet {
  us: number;
  them: number;
}

export interface LiveCourtState {
  id: string;
  court_number: number;
  format: 'normal' | 'super_tb';
  status: 'live' | 'finished';
  sets: LiveSet[];
  winner: 'us' | 'them' | null;
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

/** Bloqueo suave: 2 min sin marcar y la pista queda libre. */
export const LIVE_LOCK_MS = 2 * 60 * 1000;

export const LIVE_BASE_URL = 'https://tactium.io/directo/';

export function liveUrl(token: string): string {
  return `${LIVE_BASE_URL}${token}`;
}

export async function fetchLiveState(matchdayId: string): Promise<LiveMatchdayState> {
  const { data, error } = await supabase.rpc('live_matchday_state' as never, {
    p_matchday_id: matchdayId,
  } as never);
  if (error) throw error;
  return data as unknown as LiveMatchdayState;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as unknown as T;
}

/** «Marcar esta pista» (o «Tomar el relevo» con force). */
export function claimCourt(matchdayId: string, court: number, force = false) {
  return rpc<LiveCourtState>('live_claim_court', {
    p_matchday_id: matchdayId,
    p_court: court,
    p_force: force,
  });
}

export function releaseCourt(matchdayId: string, court: number) {
  return rpc<null>('live_release_court', { p_matchday_id: matchdayId, p_court: court });
}

/** uuid v4 para la idempotencia del toque (un reintento no suma dos). */
export function newEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function scoreGame(
  matchdayId: string,
  court: number,
  side: 'us' | 'them',
  eventId: string,
  expectedGames: number | null,
) {
  return rpc<LiveCourtState>('live_score_game', {
    p_matchday_id: matchdayId,
    p_court: court,
    p_side: side,
    p_event_id: eventId,
    p_expected_games: expectedGames,
  });
}

export function undoGame(matchdayId: string, court: number, expectedGames: number | null) {
  return rpc<LiveCourtState>('live_undo_game', {
    p_matchday_id: matchdayId,
    p_court: court,
    p_expected_games: expectedGames,
  });
}

export function finishCourt(matchdayId: string, court: number) {
  return rpc<LiveCourtState>('live_finish_court', { p_matchday_id: matchdayId, p_court: court });
}

/** Token del enlace público de la jornada (lo crea si no hay). Capitán. */
export function createShareToken(matchdayId: string) {
  return rpc<string>('live_share_create', { p_matchday_id: matchdayId });
}

// ─── Lógica pura ─────────────────────────────────────────────────────────

/** ¿Hay alguien marcando ahora (y no soy yo)? */
export function activeScorer(
  live: LiveCourtState | null,
  myUserId: string | null,
  now = Date.now(),
): string | null {
  if (!live || !live.scorer_id || live.scorer_id === myUserId) return null;
  if (!live.scorer_seen_at) return null;
  if (now - new Date(live.scorer_seen_at).getTime() > LIVE_LOCK_MS) return null;
  return live.scorer_name ?? 'Un compañero';
}

/** Sets ganados por cada lado (solo los cerrados). */
export function setsWon(live: LiveCourtState | null): { us: number; them: number } {
  if (!live) return { us: 0, them: 0 };
  const closed = live.status === 'finished' || live.winner ? live.sets : live.sets.slice(0, -1);
  let us = 0;
  let them = 0;
  for (const s of closed) {
    if (s.us > s.them) us++;
    else if (s.them > s.us) them++;
  }
  return { us, them };
}

export type CourtOutcome = 'won' | 'lost' | 'live' | 'none';

export function courtOutcome(c: LiveCourt | undefined): CourtOutcome {
  if (!c) return 'none';
  if (c.forfeit) return c.forfeit_us ? 'lost' : 'won';
  if (!c.live) return 'none';
  if (c.live.status === 'finished') {
    const w = c.live.winner ?? (() => {
      const s = setsWon(c.live);
      return s.us > s.them ? 'us' : s.them > s.us ? 'them' : null;
    })();
    return w === 'us' ? 'won' : w === 'them' ? 'lost' : 'none';
  }
  return 'live';
}

/** Pistas ganadas / perdidas / en juego del encuentro. */
export function liveTotals(state: LiveMatchdayState | null) {
  let won = 0;
  let lost = 0;
  let live = 0;
  for (const c of state?.courts ?? []) {
    const o = courtOutcome(c);
    if (o === 'won') won++;
    else if (o === 'lost') lost++;
    else if (o === 'live') live++;
  }
  return { won, lost, live };
}

/** ¿Pinta «EN DIRECTO»? Alguna pista en juego y el acta sin cerrar. */
export function isLiveNow(state: LiveMatchdayState | null): boolean {
  if (!state || state.matchday_status === 'finished') return false;
  return state.courts.some((c) => c.live?.status === 'live' && !c.forfeit);
}

/** Mensaje humano de un error de las RPC del directo. */
export function liveErrorMessage(e: unknown): string {
  const msg =
    e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
  return msg || 'No se ha podido guardar. Revisa la conexión.';
}

export function isLockError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { hint?: string }).hint === 'live_locked';
}

export function isStaleError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { hint?: string }).hint === 'live_stale';
}

/** Texto para WhatsApp. */
export function liveShareText(opts: {
  teamName: string;
  opponent: string;
  jornada: number | null;
  token: string;
}): string {
  const j = opts.jornada != null ? ` · J${opts.jornada}` : '';
  return `🎾 En directo: ${opts.teamName} vs ${opts.opponent}${j}\nSigue el marcador pista a pista, sin app:\n${liveUrl(opts.token)}`;
}

/**
 * Suma un juego en local (optimista) con las mismas reglas que
 * `private.live_recompute`: 6 con 2 de ventaja o 7 (7-5/7-6); en super
 * tie-break, 10 con 2. El servidor manda: su respuesta sustituye a esto.
 */
export function applyGameLocal(live: LiveCourtState, side: 'us' | 'them'): LiveCourtState {
  if (live.status === 'finished') return live;
  const sets = live.sets.length ? live.sets.map((s) => ({ ...s })) : [{ us: 0, them: 0 }];
  const cur = sets[sets.length - 1];
  cur[side] += 1;
  const hi = Math.max(cur.us, cur.them);
  const diff = Math.abs(cur.us - cur.them);
  const stb = live.format === 'super_tb' && sets.length === 3;
  const done = stb ? hi >= 10 && diff >= 2 : (hi >= 6 && diff >= 2) || hi === 7;
  let winner: 'us' | 'them' | null = null;
  if (done) {
    let us = 0;
    let them = 0;
    for (const s of sets) {
      if (s.us > s.them) us++;
      else them++;
    }
    if (us === 2) winner = 'us';
    else if (them === 2) winner = 'them';
    else sets.push({ us: 0, them: 0 });
  }
  return {
    ...live,
    sets,
    winner,
    status: winner ? 'finished' : 'live',
    games_count: live.games_count + 1,
  };
}
