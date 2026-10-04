import * as Haptics from 'expo-haptics';

import { supabase } from '@core/supabase/client';
import type { Tournament } from '@core/services/tournaments';

// Datos operativos del club que el rediseño enseña de un vistazo (panel del
// club, gestión de torneos y facturación). Todo sale de tablas que el club ya
// puede leer bajo RLS: no hay RPC ni tablas nuevas.

type AnyFrom = (table: string) => any;
const from = () => supabase.from.bind(supabase) as unknown as AnyFrom;

export interface TournamentStats {
  /** Inscripciones activas (sin las retiradas). Una pareja en 2 categorías cuenta 2. */
  pairs: number;
  /** Pendientes de pagar en el club. */
  pendingClub: number;
  /** Pagadas online (Stripe). */
  paidOnline: number;
  /** Partidos con las dos parejas puestas y, de ellos, los jugados. */
  matches: number;
  played: number;
}

const EMPTY: TournamentStats = { pairs: 0, pendingClub: 0, paidOnline: 0, matches: 0, played: 0 };

/** Recuento de inscripciones y partidos por torneo, en dos consultas. Nunca lanza. */
export async function fetchTournamentStats(
  tournaments: Pick<Tournament, 'id' | 'status'>[],
): Promise<Record<string, TournamentStats>> {
  const out: Record<string, TournamentStats> = {};
  for (const t of tournaments) out[t.id] = { ...EMPTY };
  const ids = tournaments.map((t) => t.id);
  if (ids.length === 0) return out;
  try {
    const { data: regs } = await from()('tournament_registrations')
      .select('tournament_id, status, payment_status, payment_method')
      .in('tournament_id', ids);
    for (const r of (regs ?? []) as {
      tournament_id: string;
      status: string;
      payment_status: string | null;
      payment_method: string | null;
    }[]) {
      const s = out[r.tournament_id];
      if (!s || r.status === 'withdrawn') continue;
      s.pairs += 1;
      if (r.payment_status === 'pending_club') s.pendingClub += 1;
      if (r.payment_status === 'paid' && r.payment_method === 'stripe') s.paidOnline += 1;
    }
    // Partidos solo de los que están en juego: es la única fase que los enseña.
    const live = tournaments.filter((t) => t.status === 'in_progress').map((t) => t.id);
    if (live.length) {
      const { data: ms } = await from()('tournament_matches')
        .select('tournament_id, status, home_reg, away_reg')
        .in('tournament_id', live);
      for (const m of (ms ?? []) as {
        tournament_id: string;
        status: string;
        home_reg: string | null;
        away_reg: string | null;
      }[]) {
        const s = out[m.tournament_id];
        if (!s || !m.home_reg || !m.away_reg) continue;
        s.matches += 1;
        if (m.status === 'finished') s.played += 1;
      }
    }
  } catch (e) {
    console.warn('fetchTournamentStats', e);
  }
  return out;
}

// ── Fases de un torneo ──────────────────────────────────────────────────────
// Inscripción → Pago → Cuadros → En juego → Final, calculadas con lo que ya hay:
//   · Inscripción: abierto y sin haber llegado la fecha de inicio.
//   · Pago: borrador retenido, pago pendiente, o inscripción ya vencida sin
//     cerrar el pago del torneo.
//   · Cuadros: el pago está cerrado (pagado, incluido o gratis) y aún no hay
//     cuadros (el torneo sigue «open»).
//   · En juego: in_progress. Final: finished.
export const PHASES = ['Inscr.', 'Pago', 'Cuadros', 'En juego', 'Final'] as const;
export type PhaseIndex = 0 | 1 | 2 | 3 | 4;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function tournamentPhase(
  t: Pick<Tournament, 'status' | 'billing_status' | 'starts_on'>,
): PhaseIndex {
  if (t.status === 'finished' || t.status === 'canceled') return 4;
  if (t.status === 'in_progress') return 3;
  const billing = t.billing_status ?? 'none';
  if (t.status === 'draft' || billing === 'pending_payment') return 1;
  if (billing === 'paid' || billing === 'included' || billing === 'free') return 2;
  if (t.starts_on && t.starts_on <= todayIso()) return 1;
  return 0;
}

export const PHASE_LABEL: Record<PhaseIndex, string> = {
  0: 'Inscripción',
  1: 'Pago',
  2: 'Cuadros',
  3: 'En juego',
  4: 'Final',
};

/** Lo que toca hacer en cada fase (un único botón por torneo). */
export const PHASE_ACTION: Record<PhaseIndex, string> = {
  0: 'Compartir',
  1: 'Cerrar y pagar',
  2: 'Generar cuadros',
  3: 'Poner resultados',
  4: 'Ver resultados',
};

/** Enlace público de inscripción (el mismo que usa la web). */
export const tournamentSignupUrl = (id: string) => `https://tactium.io/torneos/${id}/inscripcion`;

/**
 * Lo que se retiene por cada inscripción cobrada online: el COSTE de la
 * pasarela, no una comisión de TACTIUM. Copia de INSCRIPTION_FEE_BPS (200) e
 * INSCRIPTION_FEE_FIXED_CENTS (25) de `tactium-web/lib/connect.ts`, que es
 * quien lo aplica: si cambia allí, cambia aquí.
 */
export const GATEWAY_FEE_LABEL = '2 % + 0,25 €';

/** Vibración ligera de confirmación; sin módulo nativo, nada. */
export function tapSuccess() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    // Sin módulo nativo: no vibra.
  }
}
