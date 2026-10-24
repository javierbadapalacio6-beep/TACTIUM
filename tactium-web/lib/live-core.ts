/**
 * Lógica pura del directo (sin React ni Supabase), para poder usarla también
 * desde el servidor (metadatos/OG). Espejo de `TACTIUM/src/core/services/live.ts`.
 *
 * Reglas:
 *  · El directo se activa SOLO a la hora del partido; no hace falta pulsar
 *    «Marcar». Se apaga al cerrar todas las pistas, al cerrar el acta o pasada
 *    la ventana de juego.
 *  · Manda el acta: un resultado decidido a mano en `match_results` cierra la
 *    pista aunque el directo se quedara a medias.
 */

export interface LiveSet {
  us: number;
  them: number;
}

export type CourtOutcome = "won" | "lost" | "live" | "none";

export interface CourtLike {
  forfeit: boolean;
  forfeit_us: boolean;
  /** Sets del acta (sin W.O.). Vacío/ausente en servidores antiguos. */
  result_sets?: LiveSet[];
  live: { status: string; winner: string | null; sets: LiveSet[] } | null;
}

export interface StateLike {
  matchday_status: string;
  match_date?: string | null;
  match_time?: string | null;
  courts: CourtLike[];
}

/** Pasadas estas horas desde la hora del partido ya no es «en directo» aunque nadie cierre el acta. */
export const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface LiveCtx {
  /** Ha llegado la hora del partido (o ya hay un directo apuntado). */
  started: boolean;
  /** Acta sin cerrar y dentro de la ventana de juego. */
  open: boolean;
}

export function liveCtx(state: StateLike | null | undefined, now = Date.now()): LiveCtx {
  if (!state || state.matchday_status === "finished") return { started: false, open: false };
  const t = state.match_date && state.match_time ? new Date(`${state.match_date}T${state.match_time}`).getTime() : NaN;
  // Sin hora fijada (o servidor antiguo): solo cuenta el directo que alguien apuntó.
  if (Number.isNaN(t)) return { started: state.courts.some((c) => c.live), open: true };
  return { started: now >= t, open: now < t + LIVE_WINDOW_MS };
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

/** Ganador según los sets del acta (2 sets ganados), o null si no está decidida. */
export function resultWinner(sets: LiveSet[] | undefined): "us" | "them" | null {
  let us = 0;
  let them = 0;
  for (const s of sets ?? []) {
    if (s.us > s.them) us++;
    else if (s.them > s.us) them++;
  }
  return us >= 2 ? "us" : them >= 2 ? "them" : null;
}

/** Pista cerrada: W.O., resultado decidido en el acta o directo terminado. */
export function courtDecided(c: CourtLike): boolean {
  return c.forfeit || resultWinner(c.result_sets) !== null || c.live?.status === "finished";
}

export function courtOutcome(
  c: CourtLike | undefined,
  ctx: LiveCtx = { started: false, open: true }
): CourtOutcome {
  if (!c) return ctx.open && ctx.started ? "live" : "none";
  if (c.forfeit) return c.forfeit_us ? "lost" : "won";
  const aw = resultWinner(c.result_sets);
  if (aw) return aw === "us" ? "won" : "lost";
  if (c.live?.status === "finished") {
    let w = c.live.winner;
    if (!w) {
      const s = setsWon(c.live);
      w = s.us > s.them ? "us" : s.them > s.us ? "them" : null;
    }
    return w === "us" ? "won" : w === "them" ? "lost" : "none";
  }
  return ctx.open && (ctx.started || !!c.live) ? "live" : "none";
}

/** Sets a pintar de una pista: el acta si manda ella; si no, el directo en curso. */
export function courtSets(c: CourtLike | undefined): LiveSet[] {
  if (!c || c.forfeit) return [];
  const acta = c.result_sets ?? [];
  if (acta.length && (resultWinner(acta) || !c.live || c.live.status === "finished")) return acta;
  return c.live?.sets ?? [];
}

export function liveTotals(state: StateLike | null | undefined, now = Date.now()) {
  const ctx = liveCtx(state, now);
  let won = 0;
  let lost = 0;
  let live = 0;
  for (const c of state?.courts ?? []) {
    const o = courtOutcome(c, ctx);
    if (o === "won") won++;
    else if (o === "lost") lost++;
    else if (o === "live") live++;
  }
  return { won, lost, live };
}

/**
 * ¿Pinta «EN DIRECTO»? Desde la hora del partido y hasta que todas las pistas
 * estén cerradas (o se cierre el acta). Antes de la hora, solo si alguien ya
 * está marcando. `expectedCourts` = pistas que exige la liga, por si alguna
 * aún no tiene ni alineación.
 */
export function isLiveNow(state: StateLike | null | undefined, now = Date.now(), expectedCourts = 0): boolean {
  if (!state) return false;
  const ctx = liveCtx(state, now);
  if (!ctx.open) return false;
  if (state.courts.some((c) => c.live?.status === "live" && !courtDecided(c))) return true;
  if (!ctx.started) return false;
  const total = Math.max(expectedCourts, state.courts.length);
  return total > 0 && state.courts.filter(courtDecided).length < total;
}
