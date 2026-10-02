import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

import { RemindError } from './availabilityErrors';
import * as Mock from './availabilityMock';

export { RemindError };
export { AVAILABILITY_MOCK } from './availabilityMock';

/**
 * Disponibilidad POR JORNADA (tabla `availability`). Tres respuestas:
 * `yes` (Voy) · `maybe` (Duda) · `no` (No puedo). Sin fila = sin contestar.
 *
 * La duda cierra 24 h antes del partido (`availability_maybe_deadline`); si
 * sigue en duda, el servidor la pasa a «no» (`auto_resolved`).
 * `players.available` sigue existiendo solo como espejo de la próxima
 * jornada para Lineup y builds antiguas: no escribir ahí desde código nuevo.
 */
export type AvailabilityStatus = 'yes' | 'maybe' | 'no';
export type MaybeReason = 'trabajo' | 'molestias' | 'viaje' | 'pendiente';

export const MAYBE_REASONS: { id: MaybeReason; label: string }[] = [
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'molestias', label: 'Molestias' },
  { id: 'viaje', label: 'Viaje' },
  { id: 'pendiente', label: 'Lo sé más tarde' },
];

export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  yes: 'Voy',
  maybe: 'Duda',
  no: 'No puedo',
};

// Las columnas nuevas (status, reason, auto_resolved) aún no están en los
// tipos generados: las añadimos aquí hasta regenerar database.types.ts.
export type Availability = Database['public']['Tables']['availability']['Row'] & {
  status: AvailabilityStatus;
  reason: MaybeReason | null;
  auto_resolved: boolean;
};

/** Respuestas de una jornada indexadas por player_id. */
export type AvailabilityMap = Record<string, Availability>;

export async function fetchAvailability(matchdayId: string): Promise<AvailabilityMap> {
  if (Mock.AVAILABILITY_MOCK) return Mock.mockFetchAvailability(matchdayId);
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('matchday_id', matchdayId);
  if (error) throw error;
  const map: AvailabilityMap = {};
  for (const row of (data ?? []) as Availability[]) map[row.player_id] = row;
  return map;
}

/** Cierre de la duda (24 h antes del partido) como Date, o null sin fecha. */
export async function fetchMaybeDeadline(matchdayId: string): Promise<Date | null> {
  if (Mock.AVAILABILITY_MOCK) return Mock.mockFetchMaybeDeadline();
  const { data, error } = await supabase.rpc('availability_maybe_deadline' as never, {
    p_matchday_id: matchdayId,
  } as never);
  if (error) throw error;
  return data ? new Date(data as unknown as string) : null;
}

/**
 * Responde por un jugador. El propio jugador responde por sí mismo; el
 * capitán/admin puede responder por cualquiera de su plantilla.
 */
export async function respondAvailability(params: {
  matchdayId: string;
  playerId: string;
  status: AvailabilityStatus;
  reason?: MaybeReason | null;
  note?: string | null;
}): Promise<Availability> {
  if (Mock.AVAILABILITY_MOCK) return Mock.mockRespond(params);
  const { data, error } = await supabase.rpc('respond_availability' as never, {
    p_matchday_id: params.matchdayId,
    p_player_id: params.playerId,
    p_status: params.status,
    p_reason: params.reason ?? null,
    p_note: params.note ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as Availability;
}

/** Capitán: quita la respuesta (vuelve a «sin contestar»). */
export async function clearAvailability(matchdayId: string, playerId: string): Promise<void> {
  if (Mock.AVAILABILITY_MOCK) return Mock.mockClear(matchdayId, playerId);
  const { error } = await supabase.rpc('clear_availability' as never, {
    p_matchday_id: matchdayId,
    p_player_id: playerId,
  } as never);
  if (error) throw error;
}

export interface RemindResult {
  reminded: number;
  withoutApp: { playerId: string; name: string }[];
  nextAllowedAt: Date;
}

/** Capitán (premium): push a los que no han contestado o están en duda. 1 vez / 12 h. */
export async function remindPending(matchdayId: string): Promise<RemindResult> {
  if (Mock.AVAILABILITY_MOCK) return Mock.mockRemind(matchdayId);
  const { data, error } = await supabase.rpc('remind_pending_availability' as never, {
    p_matchday_id: matchdayId,
  } as never);
  if (error) {
    const hint = (error as { hint?: string }).hint ?? '';
    if (hint === 'premium_required') throw new RemindError(error.message, 'premium');
    if (hint.startsWith('cooldown:')) {
      throw new RemindError(error.message, 'cooldown', new Date(hint.slice('cooldown:'.length)));
    }
    throw new RemindError(error.message, 'other');
  }
  const d = data as unknown as {
    reminded: number;
    without_app: { player_id: string; name: string }[];
    next_allowed_at: string;
  };
  return {
    reminded: d.reminded,
    withoutApp: (d.without_app ?? []).map((p) => ({ playerId: p.player_id, name: p.name })),
    nextAllowedAt: new Date(d.next_allowed_at),
  };
}

/** Último «Recordar ahora» de la jornada (para mostrar el bloqueo de 12 h). */
export async function fetchLastReminder(matchdayId: string): Promise<Date | null> {
  if (Mock.AVAILABILITY_MOCK) return Mock.mockFetchLastReminder(matchdayId);
  const { data, error } = await supabase
    .from('availability_reminders' as never)
    .select('created_at')
    .eq('matchday_id' as never, matchdayId as never)
    .order('created_at' as never, { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data as unknown as { created_at: string }[] | null)?.[0];
  return row ? new Date(row.created_at) : null;
}

export interface AvailabilityCounts {
  yes: number;
  maybe: number;
  no: number;
  pending: number;
  total: number;
}

/** Recuento por estado sobre una plantilla (ids de jugadores activos). */
export function countAvailability(playerIds: string[], map: AvailabilityMap): AvailabilityCounts {
  const c: AvailabilityCounts = { yes: 0, maybe: 0, no: 0, pending: 0, total: playerIds.length };
  for (const id of playerIds) {
    const s = map[id]?.status;
    if (s) c[s] += 1;
    else c.pending += 1;
  }
  return c;
}
