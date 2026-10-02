/**
 * MODO MAQUETA de la disponibilidad (solo desarrollo).
 *
 * Se activa con `EXPO_PUBLIC_AVAILABILITY_MOCK=1` al arrancar Expo. Todo vive
 * en memoria del móvil: no escribe en Supabase ni manda push a nadie. Sirve
 * para revisar las pantallas antes de aplicar la migración en producción.
 * Los builds de tienda no definen la variable → este fichero no se usa.
 */
import type {
  Availability,
  AvailabilityMap,
  AvailabilityStatus,
  MaybeReason,
  RemindResult,
} from './availability';
import { useTeamStore } from '@store/teamStore';

import { RemindError } from './availabilityErrors';

export const AVAILABILITY_MOCK = process.env.EXPO_PUBLIC_AVAILABILITY_MOCK === '1';

const REMIND_COOLDOWN_MS = 12 * 3_600_000;
const maps = new Map<string, AvailabilityMap>();
const reminders = new Map<string, Date>();
// Cierre de la duda simulado: dentro de 26 h (se ve la cuenta atrás).
const deadline = new Date(Date.now() + 26 * 3_600_000);

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function row(
  matchdayId: string,
  playerId: string,
  status: AvailabilityStatus,
  reason: MaybeReason | null = null,
  note: string | null = null,
): Availability {
  return {
    id: `mock-${matchdayId}-${playerId}`,
    matchday_id: matchdayId,
    player_id: playerId,
    status,
    available: status === 'yes',
    reason: status === 'maybe' ? reason : null,
    note,
    auto_resolved: false,
    updated_by: null,
    updated_at: new Date().toISOString(),
  } as Availability;
}

/**
 * Primera vez que se abre una jornada: reparto creíble sobre la plantilla
 * real. El usuario queda SIN contestar para ver la pregunta.
 */
function seed(matchdayId: string): AvailabilityMap {
  const { players, myPlayerId } = useTeamStore.getState();
  const others = players.filter((p) => p.id !== myPlayerId);
  const map: AvailabilityMap = {};
  others.forEach((p, i) => {
    const slot = i % 8;
    if (slot === 0 || slot === 1 || slot === 3 || slot === 5) map[p.id] = row(matchdayId, p.id, 'yes');
    else if (slot === 2) map[p.id] = row(matchdayId, p.id, 'maybe', 'trabajo', 'salgo de guardia a las 10');
    else if (slot === 6) map[p.id] = row(matchdayId, p.id, 'no');
    // slot 4 y 7 → sin contestar
  });
  return map;
}

function mapFor(matchdayId: string): AvailabilityMap {
  let m = maps.get(matchdayId);
  if (!m) {
    m = seed(matchdayId);
    maps.set(matchdayId, m);
  }
  return m;
}

export async function mockFetchAvailability(matchdayId: string): Promise<AvailabilityMap> {
  await delay();
  return { ...mapFor(matchdayId) };
}

export async function mockFetchMaybeDeadline(): Promise<Date> {
  return deadline;
}

export async function mockRespond(params: {
  matchdayId: string;
  playerId: string;
  status: AvailabilityStatus;
  reason?: MaybeReason | null;
  note?: string | null;
}): Promise<Availability> {
  await delay();
  if (params.status === 'maybe' && Date.now() >= deadline.getTime()) {
    throw new Error('Ya no se puede dejar en duda: la convocatoria cierra 24 h antes del partido');
  }
  const r = row(
    params.matchdayId,
    params.playerId,
    params.status,
    params.reason ?? null,
    params.note?.trim() ? params.note.trim().slice(0, 140) : null,
  );
  mapFor(params.matchdayId)[params.playerId] = r;
  return r;
}

export async function mockClear(matchdayId: string, playerId: string): Promise<void> {
  await delay();
  delete mapFor(matchdayId)[playerId];
}

export async function mockFetchLastReminder(matchdayId: string): Promise<Date | null> {
  return reminders.get(matchdayId) ?? null;
}

export async function mockRemind(matchdayId: string): Promise<RemindResult> {
  await delay(500);
  const last = reminders.get(matchdayId);
  if (last && Date.now() - last.getTime() < REMIND_COOLDOWN_MS) {
    throw new RemindError(
      'Ya recordaste hace menos de 12 horas',
      'cooldown',
      new Date(last.getTime() + REMIND_COOLDOWN_MS),
    );
  }
  const { players } = useTeamStore.getState();
  const map = mapFor(matchdayId);
  const pending = players.filter((p) => !map[p.id] || map[p.id].status === 'maybe');
  const now = new Date();
  reminders.set(matchdayId, now);
  return {
    reminded: pending.filter((p) => p.user_id).length,
    withoutApp: pending.filter((p) => !p.user_id).map((p) => ({ playerId: p.id, name: p.name })),
    nextAllowedAt: new Date(now.getTime() + REMIND_COOLDOWN_MS),
  };
}
