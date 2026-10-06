"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Encuesta de hora de la jornada (migraciones 20261006c/d).
 *
 * El capitán propone de 2 a 4 opciones de día y hora; cada jugador marca en
 * cuáles PUEDE (multiselección, editable hasta que se cierre) y el capitán
 * fija la ganadora, que se escribe en `matchdays.match_date / match_time`.
 *
 * Tablas: `matchday_time_polls`, `matchday_time_poll_options`,
 * `matchday_time_poll_votes` (un voto por jugador con `option_ids`; vacío =
 * «ninguna me va»; sin fila = no ha votado). Escrituras por RPC.
 * Copia de TACTIUM/src/core/services/timePolls.ts (misma lógica y textos).
 * Las escrituras pasan por `guardedWrite` en el llamador.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFrom = (table: string) => any;
type AnyRpc = (fn: string, args?: Record<string, unknown>) => any;
const rawFrom: AnyFrom = (t) => (supabaseBrowser() as any).from(t);
const rawRpc: AnyRpc = (fn, args) => (supabaseBrowser() as any).rpc(fn, args);

/** Error de «Recordar»: sin plan, en bloqueo de 12 h u otro. */
export class RemindError extends Error {
  constructor(
    message: string,
    public kind: 'premium' | 'cooldown' | 'other',
    public nextAllowedAt?: Date,
  ) {
    super(message);
  }
}

export type TimePollStatus = 'open' | 'fixed' | 'cancelled';

export interface TimePollOption {
  id: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  position: number;
}

export interface TimePoll {
  id: string;
  matchdayId: string;
  teamId: string;
  createdBy: string | null;
  message: string | null;
  deadline: Date | null;
  status: TimePollStatus;
  fixedOptionId: string | null;
  lastRemindedAt: Date | null;
  createdAt: string;
  options: TimePollOption[];
  /** player_id → opciones que puede. Sin clave = no ha votado. */
  votes: Record<string, string[]>;
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** «sáb 18/10» */
export function optionDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** «sáb 18/10 · 10:30» */
export function optionLabel(o: { date: string; time: string }): string {
  return `${optionDayLabel(o.date)} · ${o.time.slice(0, 5)}`;
}

/**
 * Última encuesta de la jornada (la abierta si la hay; si no, la más
 * reciente cerrada) o null.
 */
export async function fetchTimePoll(matchdayId: string): Promise<TimePoll | null> {
  const { data: polls, error } = await rawFrom('matchday_time_polls')
    .select('*')
    .eq('matchday_id', matchdayId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  const rows = (polls ?? []) as Record<string, any>[];
  const p = rows.find((r) => r.status === 'open') ?? rows[0];
  if (!p) return null;

  const [opts, votes] = await Promise.all([
    rawFrom('matchday_time_poll_options').select('*').eq('poll_id', p.id).order('position'),
    rawFrom('matchday_time_poll_votes').select('player_id, option_ids').eq('poll_id', p.id),
  ]);
  if (opts.error) throw opts.error;
  if (votes.error) throw votes.error;

  const voteMap: Record<string, string[]> = {};
  for (const v of (votes.data ?? []) as { player_id: string; option_ids: string[] }[]) {
    voteMap[v.player_id] = v.option_ids ?? [];
  }
  return {
    id: p.id,
    matchdayId: p.matchday_id,
    teamId: p.team_id,
    createdBy: p.created_by ?? null,
    message: p.message ?? null,
    deadline: p.deadline ? new Date(p.deadline) : null,
    status: p.status,
    fixedOptionId: p.fixed_option_id ?? null,
    lastRemindedAt: p.last_reminded_at ? new Date(p.last_reminded_at) : null,
    createdAt: p.created_at,
    options: ((opts.data ?? []) as Record<string, any>[]).map((o) => ({
      id: o.id,
      date: o.match_date,
      time: String(o.match_time).slice(0, 5),
      position: o.position,
    })),
    votes: voteMap,
  };
}

/** Error de las RPC de la encuesta con su motivo. */
export class TimePollError extends Error {
  constructor(
    message: string,
    public kind: 'premium' | 'club_time_set' | 'time_changed' | 'other',
    /** time_changed: la hora que hay ahora en la jornada ('YYYY-MM-DDTHH:MM'). */
    public current?: string,
  ) {
    super(message);
  }
}

function toPollError(error: { message: string; hint?: string }): TimePollError {
  const hint = error.hint ?? '';
  if (hint === 'premium_required') return new TimePollError(error.message, 'premium');
  if (hint === 'club_time_set') return new TimePollError(error.message, 'club_time_set');
  if (hint.startsWith('time_changed:')) {
    return new TimePollError(error.message, 'time_changed', hint.slice('time_changed:'.length));
  }
  return new TimePollError(error.message, 'other');
}

export async function createTimePoll(params: {
  matchdayId: string;
  options: { date: string; time: string }[];
  message?: string | null;
  deadline?: Date | null;
}): Promise<string> {
  const { data, error } = await rawRpc('create_time_poll', {
    p_matchday_id: params.matchdayId,
    p_options: params.options,
    p_message: params.message ?? null,
    p_deadline: params.deadline ? params.deadline.toISOString() : null,
  });
  if (error) throw toPollError(error);
  return data as string;
}

/** El propio jugador: opciones que puede ([] = ninguna). */
export async function voteTimePoll(pollId: string, optionIds: string[]): Promise<void> {
  const { error } = await rawRpc('vote_time_poll', {
    p_poll_id: pollId,
    p_option_ids: optionIds,
  });
  if (error) throw toPollError(error);
}

/**
 * Capitán: fija la opción. Si mientras se votaba alguien puso otra hora a la
 * jornada, lanza `TimePollError('time_changed')` salvo con `overwrite`.
 */
export async function fixTimePoll(pollId: string, optionId: string, overwrite = false): Promise<void> {
  const { error } = await rawRpc('fix_time_poll', {
    p_poll_id: pollId,
    p_option_id: optionId,
    p_overwrite: overwrite,
  });
  if (error) throw toPollError(error);
}

export async function cancelTimePoll(pollId: string): Promise<void> {
  const { error } = await rawRpc('cancel_time_poll', { p_poll_id: pollId });
  if (error) throw toPollError(error);
}

export interface TimePollRemindResult {
  reminded: number;
  withoutApp: { playerId: string; name: string }[];
}

/** Capitán (Pro): push a los que no han votado. 1 vez / 12 h. */
export async function remindTimePoll(pollId: string): Promise<TimePollRemindResult> {
  const { data, error } = await rawRpc('remind_time_poll', { p_poll_id: pollId });
  if (error) {
    const hint = (error as { hint?: string }).hint ?? '';
    if (hint === 'premium_required') throw new RemindError(error.message, 'premium');
    if (hint.startsWith('cooldown:')) {
      throw new RemindError(error.message, 'cooldown', new Date(hint.slice('cooldown:'.length)));
    }
    throw new RemindError(error.message, 'other');
  }
  const d = data as { reminded: number; without_app: { player_id: string; name: string }[] };
  return {
    reminded: d.reminded,
    withoutApp: (d.without_app ?? []).map((p) => ({ playerId: p.player_id, name: p.name })),
  };
}

export interface PollTally {
  /** option_id → player_ids que pueden. */
  byOption: Record<string, string[]>;
  /** Opción(es) con más votos (vacío si nadie ha votado). */
  topIds: string[];
  voted: string[];
  pending: string[];
}

/** Recuento sobre la plantilla activa (ids). */
export function tallyPoll(poll: TimePoll, playerIds: string[]): PollTally {
  const byOption: Record<string, string[]> = {};
  for (const o of poll.options) byOption[o.id] = [];
  const voted: string[] = [];
  const pending: string[] = [];
  for (const pid of playerIds) {
    const v = poll.votes[pid];
    if (!v) {
      pending.push(pid);
      continue;
    }
    voted.push(pid);
    for (const oid of v) byOption[oid]?.push(pid);
  }
  const max = Math.max(0, ...Object.values(byOption).map((a) => a.length));
  const topIds = max === 0 ? [] : poll.options.filter((o) => byOption[o.id].length === max).map((o) => o.id);
  return { byOption, topIds, voted, pending };
}

/** Equipo «de club»: el club (dueño o sede) suele poner la hora. */
export function isClubManaged(team: { club_id?: string | null; venue_club_id?: string | null } | null): boolean {
  return !!team && (!!team.club_id || !!team.venue_club_id);
}

/**
 * ¿Se ofrece «Proponer horas»? Equipo independiente: siempre. Equipo de club:
 * solo si la jornada aún no tiene hora (el club no la ha puesto).
 */
export function canProposeTimes(
  team: { club_id?: string | null; venue_club_id?: string | null } | null,
  matchday: { status: string; match_time: string | null },
): boolean {
  if (matchday.status === 'finished') return false;
  return !isClubManaged(team) || !matchday.match_time;
}

/**
 * Sugerencias para el formulario: la fecha de la jornada con las franjas
 * favoritas del equipo (`preferred_home_slots`: 'HH:MM' o 'd|HH:MM', d =
 * día de la semana 0-6). Si la franja trae día, se usa ese día del mismo
 * fin de semana de la jornada.
 */
export function suggestOptions(
  matchDate: string | null,
  matchTime: string | null,
  slots: string[],
): { date: string; time: string }[] {
  const base = matchDate ? new Date(`${matchDate}T12:00:00`) : nextSaturday();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out: { date: string; time: string }[] = [];
  const push = (date: string, time: string) => {
    if (!out.some((o) => o.date === date && o.time === time)) out.push({ date, time });
  };
  for (const s of slots) {
    const [a, b] = s.includes('|') ? s.split('|') : [null, s];
    const time = (b ?? '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(time)) continue;
    let d = new Date(base);
    if (a != null && /^\d$/.test(a)) {
      // Mismo fin de semana/semana: desplaza al día pedido (±3 días).
      let diff = Number(a) - d.getDay();
      if (diff > 3) diff -= 7;
      if (diff < -3) diff += 7;
      d = new Date(d.getTime() + diff * 86_400_000);
    }
    push(iso(d), time);
  }
  if (matchTime) push(iso(base), matchTime.slice(0, 5));
  if (out.length < 2) {
    for (const t of ['10:00', '12:00', '17:00']) {
      if (out.length >= 2) break;
      push(iso(base), t);
    }
  }
  return out.slice(0, 4);
}

function nextSaturday(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d;
}

/* ── Contexto de la encuesta para la web ────────────────────────────
 * Equipo DE LA JORNADA (no el activo): el club abre las de cualquiera de
 * sus equipos. Espejo de `useTimePoll` de la app. */
export interface PollPlayer {
  id: string;
  name: string;
  photoUrl: string | null;
  hasApp: boolean;
}

export interface TimePollContext {
  poll: TimePoll | null;
  matchday: {
    id: string;
    status: string;
    match_date: string | null;
    match_time: string | null;
    is_home: boolean;
    jornada_number: number | null;
    opponent: string | null;
  };
  team: {
    id: string;
    club_id: string | null;
    venue_club_id: string | null;
    preferred_home_slots: string[];
  } | null;
  players: PollPlayer[];
  myPlayerId: string | null;
}

export async function fetchTimePollContext(matchdayId: string): Promise<TimePollContext | null> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: md } = await rawFrom('matchdays')
    .select('id, status, match_date, match_time, is_home, jornada_number, opponent, seasons(team_id)')
    .eq('id', matchdayId)
    .maybeSingle();
  const s = md?.seasons;
  const teamId: string | null = (Array.isArray(s) ? s[0]?.team_id : s?.team_id) ?? null;
  if (!md || !teamId) return null;
  const [teamRes, playersRes, poll] = await Promise.all([
    rawFrom('teams').select('id, club_id, venue_club_id, preferred_home_slots').eq('id', teamId).maybeSingle(),
    rawFrom('players').select('id, name, alias, photo_url, user_id, active').eq('team_id', teamId),
    fetchTimePoll(matchdayId),
  ]);
  const rows = ((playersRes.data ?? []) as {
    id: string;
    name: string;
    alias: string | null;
    photo_url: string | null;
    user_id: string | null;
    active: boolean;
  }[]).filter((p) => p.active);
  const t = teamRes.data as TimePollContext['team'];
  return {
    poll,
    matchday: {
      id: md.id,
      status: md.status,
      match_date: md.match_date,
      match_time: md.match_time,
      is_home: md.is_home,
      jornada_number: md.jornada_number,
      opponent: md.opponent,
    },
    team: t ? { ...t, preferred_home_slots: t.preferred_home_slots ?? [] } : null,
    players: rows
      .map((p) => ({ id: p.id, name: p.alias?.trim() || p.name, photoUrl: p.photo_url, hasApp: !!p.user_id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    myPlayerId: rows.find((p) => !!user && p.user_id === user.id)?.id ?? null,
  };
}
