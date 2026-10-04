/**
 * Motor de la alineación (sin React). Movido tal cual desde LineupScreen:
 * orden por puntos, validación del orden de fuerza y helpers de pistas.
 * La nota de «equilibrio» (72/100 EQUI.) se quitó en el rediseño del bloque
 * Partido (2026-10): no había dato que la respaldara.
 */
import type { Player } from '@store/teamStore';
import type { AvailabilityMap, AvailabilityStatus } from '@core/services/availability';

export type SlotIdx = 0 | 1;

export interface SlotState {
  court: number;
  playerAId: string | null;
  playerBId: string | null;
}

export type Selection =
  | { kind: 'slot'; court: number; slot: SlotIdx }
  | { kind: 'bench'; id: string }
  | null;

export type Validation =
  | { state: 'ok' }
  | { state: 'warn' }
  | { state: 'err'; msg: string; diff: number }
  | { state: 'empty' };

export const filledLen = (s: SlotState) =>
  (s.playerAId ? 1 : 0) + (s.playerBId ? 1 : 0);

export const buildEmptySlots = (courts: number): SlotState[] =>
  Array.from({ length: courts }).map((_, i) => ({
    court: i + 1,
    playerAId: null,
    playerBId: null,
  }));

export const ptsOfSlot = (s: SlotState, byId: Map<string, Player>) =>
  (s.playerAId ? byId.get(s.playerAId)?.pts ?? 0 : 0) +
  (s.playerBId ? byId.get(s.playerBId)?.pts ?? 0 : 0);

export const sortByPoints = (
  input: SlotState[],
  byId: Map<string, Player>,
): SlotState[] => {
  const normalized = input.map((p) => {
    const a = p.playerAId ? byId.get(p.playerAId) : null;
    const b = p.playerBId ? byId.get(p.playerBId) : null;
    if (a && b) {
      return a.pts >= b.pts
        ? { playerAId: a.id, playerBId: b.id }
        : { playerAId: b.id, playerBId: a.id };
    }
    if (a && !b) return { playerAId: a.id, playerBId: null };
    if (!a && b) return { playerAId: b.id, playerBId: null };
    return { playerAId: null, playerBId: null };
  });

  const indexed = normalized.map((n, i) => ({
    ...n,
    pts: ptsOfSlot({ court: i, ...n }, byId),
    fill: (n.playerAId ? 1 : 0) + (n.playerBId ? 1 : 0),
  }));

  indexed.sort((a, b) => {
    if (a.fill !== b.fill) return b.fill - a.fill;
    return b.pts - a.pts;
  });

  return indexed.map((n, i) => ({
    court: i + 1,
    playerAId: n.playerAId,
    playerBId: n.playerBId,
  }));
};

export const calcValidation = (
  slots: SlotState[],
  byId: Map<string, Player>,
  mustOrder: boolean = true,
): Validation[] => {
  const ptsArr = slots.map((s) => ptsOfSlot(s, byId));
  return ptsArr.map((v, i) => {
    if (filledLen(slots[i]) !== 2) return { state: 'empty' };
    if (i === 0) return { state: 'ok' };
    if (v > ptsArr[i - 1]) {
      // El orden estricto solo es error si la federación lo exige.
      if (!mustOrder) return { state: 'ok' };
      const diff = v - ptsArr[i - 1];
      return {
        state: 'err',
        msg: `Pareja ${i + 1} más fuerte que la ${i}`,
        diff,
      };
    }
    if ((ptsArr[i - 1] - v) / Math.max(ptsArr[i - 1], 1) < 0.05) {
      return { state: 'warn' };
    }
    return { state: 'ok' };
  });
};

// ── Convocatoria de la jornada (Voy · Duda · Sin contestar · No) ────
export type BenchGroup = 'yes' | 'maybe' | 'pending' | 'no';

/**
 * Estado de la convocatoria de un jugador para ESTA jornada. Si la tabla
 * `availability` no se pudo leer (`map === null`), se cae a la marca general
 * `players.available` (espejo de la próxima jornada) para no dejar el
 * banquillo vacío.
 */
export function benchGroupOf(p: Player, map: AvailabilityMap | null): BenchGroup {
  if (!map) return p.available ? 'yes' : 'no';
  const st: AvailabilityStatus | undefined = map[p.id]?.status;
  if (st === 'yes') return 'yes';
  if (st === 'maybe') return 'maybe';
  if (st === 'no') return 'no';
  return 'pending';
}

/** «1.234» con punto de miles, como en el resto de la app. */
export const fmtPts = (n: number) => n.toLocaleString('es-ES');
