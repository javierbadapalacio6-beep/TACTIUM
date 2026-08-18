import { PLAN_BY_TIER, PREMIUM_STATUSES } from '@core/subscriptions/plans';
import type { Subscription } from './hasPremiumAccess';

// ── Cobro por torneo (modelo "por adelantado según max_pairs") ──────────────
// El precio lo manda el TAMAÑO del torneo (plazas / max_pairs) que el club fija
// al crearlo. Un club CON suscripción tiene torneos incluidos hasta el tope de
// su plan y solo paga el EXCESO por pareja; un club SIN suscripción paga el
// tramo por parejas (gratis hasta 16). Sincronizado con la landing (lib/plans).

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

// Interruptor del cobro por torneo. ACTIVO: la web (app.tactium.io) tiene las
// claves de Stripe y el webhook, y la BD aplica el gate (un torneo nace 'draft'
// y nadie se inscribe hasta pagar/publicar). Con `true`, crear un torneo que
// requiere pago lo deja en borrador y pide el pago por email antes de publicar.
// PROBAR en dev/TestFlight (crear → pagar por email → publicar → volver a la
// app) antes del OTA a producción.
export const TOURNAMENT_BILLING_ENABLED = true;

// Base de la web de TACTIUM (checkout). La web app está desplegada en el
// subdominio app.tactium.io (el apex tactium.io es la landing). Aquí llegan las
// llamadas de pago de torneo (/api/tournaments/:id/checkout con deliver:email).
export const TACTIUM_WEB_BASE_URL = 'https://app.tactium.io';

/** Precio del tramo para un club SIN suscripción, según las plazas. */
export function perTournamentPriceEur(maxPairs: number): number {
  for (const t of TOURNAMENT_TIERS) {
    if (maxPairs <= t.pairs) return t.priceEur;
  }
  // Por encima del último tramo: precio del tramo top + recargo por pareja.
  const top = TOURNAMENT_TIERS[TOURNAMENT_TIERS.length - 1];
  return top.priceEur + (maxPairs - top.pairs) * TOURNAMENT_EXTRA_PAIR_EUR;
}

export type TournamentBilling =
  | { kind: 'included' } // cubierto por el plan del club
  | { kind: 'free' } // gratis (≤16 parejas, sin suscripción)
  | { kind: 'payable'; amountEur: number; reason: 'overage' | 'per_tournament' }
  | { kind: 'needs_size' }; // hay que fijar plazas (max_pairs) para poder facturar

/**
 * Decide qué pasa con un torneo de `maxPairs` plazas dado el plan del club.
 * `planPairCap` = tope de torneo del plan (null si el club no tiene sub de club).
 */
export function computeTournamentBilling(input: {
  maxPairs: number | null;
  planPairCap: number | null;
  hasActiveSub: boolean;
}): TournamentBilling {
  const { maxPairs, planPairCap, hasActiveSub } = input;

  // Club con suscripción de club: incluido hasta su tope, exceso por pareja.
  if (hasActiveSub && planPairCap != null) {
    if (maxPairs == null) return { kind: 'needs_size' };
    if (maxPairs <= planPairCap) return { kind: 'included' };
    const amountEur = (maxPairs - planPairCap) * TOURNAMENT_EXTRA_PAIR_EUR;
    return { kind: 'payable', amountEur, reason: 'overage' };
  }

  // Sin suscripción: gratis hasta 16, luego tramo por parejas.
  if (maxPairs == null) return { kind: 'needs_size' };
  if (maxPairs <= TOURNAMENT_FREE_PAIRS) return { kind: 'free' };
  return {
    kind: 'payable',
    amountEur: perTournamentPriceEur(maxPairs),
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
