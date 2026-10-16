import { supabaseBrowser } from "@/lib/supabase/client";
import { guardedWrite, type WriteResult } from "@/lib/writes";
import type { AvailStatus, MaybeReason } from "@/lib/queries";

/*
 * Enlace público de disponibilidad (tactium.io/d/TOKEN): el capitán lo pega en el
 * grupo de WhatsApp y cada jugador responde sin cuenta. RPC en
 * TACTIUM/supabase/migrations/20261010_availability_public_link.sql. La URL y el
 * texto del grupo viven en `availability-text.ts` (puro, también para servidor).
 */

export { availabilityPath, availabilityShareText, availabilityUrl, longDate } from "@/lib/availability-text";

/* ── Lectura pública (anon) ────────────────────────────────────────── */

export interface PublicAvailPlayer {
  id: string;
  /** Nombre corto («Iván R.»): es lo único que sale de la plantilla. */
  name: string;
  status: AvailStatus | null;
  reason: MaybeReason | null;
}

export interface PublicAvailability {
  valid: true;
  team_name: string;
  team_logo_url: string | null;
  category: string | null;
  opponent: string;
  is_home: boolean;
  jornada_number: number | null;
  match_date: string | null;
  match_time: string | null;
  /** Fin de semana de la Federación («23 - 25 Oct») mientras no hay fecha exacta. */
  fcp_date_range?: string | null;
  time_poll?: PublicTimePoll | null;
  location: string | null;
  /** ISO: pasado este instante la duda ya no se puede dejar. */
  maybe_deadline: string | null;
  counts: { yes: number; maybe: number; no: number; pending: number };
  players: PublicAvailPlayer[];
}

/** Encuesta de hora abierta de la jornada (null si no hay): las horas y los votos por jugador. */
export interface PublicTimePoll {
  id: string;
  message: string | null;
  /** ISO: pasado este instante ya no se puede votar. */
  deadline: string | null;
  options: { id: string; date: string; time: string }[];
  /** player_id → horas que puede. Sin clave = no ha votado; [] = «ninguna me va». */
  votes: Record<string, string[]>;
}

export type LinkProblem = "not_found" | "expired" | "revoked";

export interface InvalidAvailability {
  valid: false;
  reason: LinkProblem;
  team_name?: string;
  opponent?: string;
  match_date?: string | null;
}

export async function fetchPublicAvailability(
  token: string,
): Promise<PublicAvailability | InvalidAvailability> {
  const { data, error } = await supabaseBrowser().rpc("public_availability_by_token", {
    p_token: token,
  });
  if (error) throw error;
  return data as PublicAvailability | InvalidAvailability;
}

/* ── Responder (anon) ──────────────────────────────────────────────── */

export type RespondReason =
  | LinkProblem
  | "bad_status"
  | "bad_reason"
  | "no_player"
  | "maybe_closed"
  | "team_not_covered"
  | "rate_limited";

export type RespondOutcome = { ok: true; status: AvailStatus } | { ok: false; reason: RespondReason };

export async function respondViaLink(
  token: string,
  playerId: string,
  status: AvailStatus,
  reason?: MaybeReason | null,
  note?: string | null,
): Promise<WriteResult<RespondOutcome>> {
  return guardedWrite("guardar tu respuesta", async () => {
    const { data, error } = await supabaseBrowser().rpc("public_respond_availability", {
      p_token: token,
      p_player_id: playerId,
      p_status: status,
      p_reason: status === "maybe" ? reason ?? null : null,
      p_note: note ?? null,
    });
    if (error) throw error;
    return data as RespondOutcome;
  });
}

export type PollVoteOutcome = { ok: true; option_ids: string[] } | { ok: false; reason: string };

/** Marca las horas que le van a un jugador (sin cuenta) en la encuesta de hora de la jornada. */
export async function voteTimePollViaLink(
  token: string,
  playerId: string,
  optionIds: string[],
): Promise<WriteResult<PollVoteOutcome>> {
  return guardedWrite("guardar tus horas", async () => {
    const { data, error } = await supabaseBrowser().rpc("public_vote_time_poll", {
      p_token: token,
      p_player_id: playerId,
      p_option_ids: optionIds,
    });
    if (error) throw error;
    return data as PollVoteOutcome;
  });
}

export function pollProblemText(reason: string): string {
  switch (reason) {
    case "poll_closed":
      return "La votación de la hora ya está cerrada.";
    case "no_poll":
      return "El capitán ya ha cerrado la encuesta de hora.";
    case "rate_limited":
      return "Demasiadas respuestas seguidas. Prueba de nuevo en un rato.";
    case "no_player":
      return "No encuentro ese jugador. Recarga la página.";
    case "bad_option":
      return "Esa hora ya no está. Recarga la página.";
    case "expired":
      return "Esta jornada ya ha empezado.";
    case "revoked":
    case "not_found":
      return "El capitán ha cambiado el enlace. Pídele el nuevo.";
    default:
      return "No se ha podido guardar. Inténtalo otra vez.";
  }
}

/** Mensaje al usuario por cada motivo de rechazo del servidor. */
export function respondProblemText(reason: RespondReason): string {
  switch (reason) {
    case "team_not_covered":
      return "El capitán de este equipo tiene que activar el plan para que podáis responder. Díselo y vuelve a probar.";
    case "maybe_closed":
      return "Las dudas ya están cerradas: marca «Voy» o «No puedo».";
    case "rate_limited":
      return "Demasiadas respuestas seguidas. Prueba de nuevo en un rato.";
    case "no_player":
      return "No encuentro ese jugador. Recarga la página.";
    case "expired":
      return "Esta jornada ya ha empezado.";
    case "revoked":
    case "not_found":
      return "El capitán ha cambiado el enlace. Pídele el nuevo.";
    default:
      return "No se ha podido guardar. Inténtalo otra vez.";
  }
}

/* ── Capitán: crear / rotar el enlace ──────────────────────────────── */

export async function createAvailabilityLink(matchdayId: string): Promise<WriteResult<string>> {
  return guardedWrite("crear el enlace de disponibilidad", async () => {
    const { data, error } = await supabaseBrowser().rpc("availability_link_create", {
      p_matchday_id: matchdayId,
    });
    if (error) throw error;
    return data as string;
  });
}

export async function rotateAvailabilityLink(matchdayId: string): Promise<WriteResult<string>> {
  return guardedWrite("cambiar el enlace de disponibilidad", async () => {
    const { data, error } = await supabaseBrowser().rpc("availability_link_rotate", {
      p_matchday_id: matchdayId,
    });
    if (error) throw error;
    return data as string;
  });
}

