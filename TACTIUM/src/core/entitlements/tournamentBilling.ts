import { PLAN_BY_TIER, PREMIUM_STATUSES } from '@core/subscriptions/plans';
import type { Subscription } from './hasPremiumAccess';

// ── Cobro por torneo (modelo "al cerrar la inscripción") ───────────────────
// El precio lo manda el número de parejas REALMENTE INSCRITAS, no las plazas
// que el club fijara al crearlo. La inscripción es ilimitada; al ir a generar
// los cuadros se paga por lo que haya entrado. Un club CON suscripción tiene
// torneos incluidos hasta el tope de su plan y solo paga el EXCESO por pareja;
// un club SIN suscripción paga el tramo por parejas (gratis hasta 16).
// Sincronizado con la landing (lib/plans).
//
// Por qué se cambió (reunión Smash, 2026-09-03): al gestor no le sirve limitar
// plazas, y el modelo viejo además hacía aguas — el tope se aplicaba POR
// DIVISIÓN, así que un torneo de "40 plazas" con tres categorías admitía 120
// parejas habiendo pagado 40.

export interface TournamentTier {
  pairs: number; // tope de parejas del tramo
  priceEur: number; // 0 = gratis
}
// Tramos alineados con la competencia (Xporty) en CAPACIDAD y por debajo en
// PRECIO — lo justo para ser la opción barata sin regalar margen:
//   40 parejas  → 25 €  (Xporty 30 €)    150 parejas → 117 € (Xporty 125 €)
//   90 parejas  → 67 €  (Xporty 75 €)    200 parejas → 160 € (Xporty 168 €)
// El tramo gratis (16) también supera al suyo (15) y sin sus límites de
// 1 competición activa / 1 categoría / 2 fases.
export const TOURNAMENT_TIERS: TournamentTier[] = [
  { pairs: 16, priceEur: 0 },
  { pairs: 40, priceEur: 25 },
  { pairs: 90, priceEur: 67 },
  { pairs: 150, priceEur: 117 },
  { pairs: 200, priceEur: 160 },
];
export const TOURNAMENT_EXTRA_PAIR_EUR = 2; // recargo por pareja por encima del tramo/tope
export const TOURNAMENT_FREE_PAIRS = 16;

// Interruptor del cobro por torneo. ACTIVO: la web (tactium.io) tiene las
// claves de Stripe y el webhook, y la BD aplica el gate (un torneo nace 'draft'
// y nadie se inscribe hasta pagar/publicar). Con `true`, crear un torneo que
// requiere pago lo deja en borrador y pide el pago por email antes de publicar.
// PROBAR en dev/TestFlight (crear → pagar por email → publicar → volver a la
// app) antes del OTA a producción.
export const TOURNAMENT_BILLING_ENABLED = true;

// Base de la web de TACTIUM (checkout). Desde 2026-09-26 la web entera vive en
// el apex tactium.io (app.tactium.io redirige). Aquí llegan las llamadas de
// pago de torneo (/api/tournaments/:id/checkout con deliver:email).
export const TACTIUM_WEB_BASE_URL = 'https://tactium.io';

/** Precio del tramo para un club SIN suscripción, según las parejas inscritas. */
export function perTournamentPriceEur(pairs: number): number {
  for (const t of TOURNAMENT_TIERS) {
    if (pairs <= t.pairs) return t.priceEur;
  }
  // Por encima del último tramo: precio del tramo top + recargo por pareja.
  const top = TOURNAMENT_TIERS[TOURNAMENT_TIERS.length - 1];
  return top.priceEur + (pairs - top.pairs) * TOURNAMENT_EXTRA_PAIR_EUR;
}

export type TournamentBilling =
  | { kind: 'included' } // cubierto por el plan del club
  | { kind: 'free' } // gratis (≤16 parejas, sin suscripción)
  | { kind: 'payable'; amountEur: number; reason: 'overage' | 'per_tournament' };

/**
 * Decide qué se paga por un torneo con `pairs` parejas inscritas, dado el plan
 * del club. `planPairCap` = tope de torneo del plan (null si no hay sub club).
 * Una pareja apuntada a DOS categorías cuenta dos veces: ocupa dos huecos de
 * cuadro, que es lo que se está pagando.
 */
export function computeTournamentBilling(input: {
  pairs: number;
  planPairCap: number | null;
  hasActiveSub: boolean;
}): TournamentBilling {
  const { pairs, planPairCap, hasActiveSub } = input;

  // Club con suscripción de club: incluido hasta su tope, exceso por pareja.
  if (hasActiveSub && planPairCap != null) {
    if (pairs <= planPairCap) return { kind: 'included' };
    const amountEur = (pairs - planPairCap) * TOURNAMENT_EXTRA_PAIR_EUR;
    return { kind: 'payable', amountEur, reason: 'overage' };
  }

  // Sin suscripción: gratis hasta 16, luego tramo por parejas.
  if (pairs <= TOURNAMENT_FREE_PAIRS) return { kind: 'free' };
  return {
    kind: 'payable',
    amountEur: perTournamentPriceEur(pairs),
    reason: 'per_tournament',
  };
}

/** Tope de torneo (parejas) del plan de club activo, o null si no hay sub club. */
export function clubTournamentCap(
  clubId: string | null,
  subscriptions: Subscription[],
  now: Date = new Date(),
): { hasActiveSub: boolean; pairCap: number | null } {
  if (!clubId) return { hasActiveSub: false, pairCap: null };
  const sub = subscriptions.find(
    (s) =>
      s.subject_type === 'club' &&
      s.subject_id === clubId &&
      PREMIUM_STATUSES.includes(s.status) &&
      new Date(s.current_period_end) > now,
  );
  if (!sub) return { hasActiveSub: false, pairCap: null };
  return {
    hasActiveSub: true,
    pairCap: PLAN_BY_TIER[sub.plan_tier].tournamentPairCap,
  };
}
