/**
 * Planes de TACTIUM — espejo de `TACTIUM/src/core/subscriptions/plans.ts`.
 *
 * OJO: hasta ahora la web pintaba los precios desde `account-data.ts`, que son
 * datos de MAQUETA. No coincidían con los reales: el plan de 25 equipos pedía
 * 599,90 €/año cuando la app cobra 384,99 €. Una página de precios que miente
 * no es un detalle estético — es lo que el cliente cree que va a pagar.
 *
 * Apple y Google son la fuente de verdad legal del importe cobrado en la app;
 * esta tabla es display. Si se cambia un precio, se cambia aquí, en la app y
 * en la landing.
 */

export interface Plan {
  tier: "captain" | "club_starter" | "club_pro" | "club_elite";
  displayName: string;
  /** A quién va dirigido, en una línea. */
  audience: string;
  priceMonthlyEur: number;
  priceYearlyEur: number;
  teamQuota: number;
  /** Parejas de torneo incluidas. `null` = el plan no cubre torneos. */
  tournamentPairCap: number | null;
  features: string[];
  featured?: boolean;
}

export const CAPTAIN_PLAN: Plan = {
  tier: "captain",
  displayName: "Capitán",
  audience: "Un equipo, un capitán",
  priceMonthlyEur: 4.99,
  priceYearlyEur: 47.99,
  teamQuota: 1,
  tournamentPairCap: null,
  features: [
    "1 equipo de hasta 30 jugadores",
    "Alineaciones ordenadas por puntos",
    "Hasta 5 variantes por jornada",
    "Avisos a los convocados",
    "Histórico completo de temporadas",
  ],
};

export const CLUB_PLANS: Plan[] = [
  {
    tier: "club_starter",
    displayName: "Club Starter",
    audience: "Clubes pequeños",
    priceMonthlyEur: 11.99,
    priceYearlyEur: 115.99,
    teamQuota: 3,
    tournamentPairCap: 32,
    features: [
      "Hasta 3 equipos cubiertos",
      "Torneos incluidos hasta 32 parejas",
      "Capitanes invitados sin coste extra",
      "Panel global del club",
      "Soporte prioritario por email",
    ],
  },
  {
    tier: "club_pro",
    displayName: "Club Pro",
    audience: "La mayoría de clubes federados",
    priceMonthlyEur: 24.99,
    priceYearlyEur: 239.99,
    teamQuota: 10,
    tournamentPairCap: 64,
    featured: true,
    features: [
      "Hasta 10 equipos cubiertos",
      "Torneos incluidos hasta 64 parejas",
      "Multi-categoría (M/F/Mixto)",
      "Horarios de pista y rejilla",
      "Todo lo de Starter",
    ],
  },
  {
    tier: "club_elite",
    displayName: "Club Elite",
    audience: "Escuelas y academias",
    priceMonthlyEur: 39.99,
    priceYearlyEur: 384.99,
    teamQuota: 25,
    tournamentPairCap: 128,
    features: [
      "Hasta 25 equipos cubiertos",
      "Torneos incluidos hasta 128 parejas",
      "Informes por categoría",
      "Todo lo de Pro",
      "Soporte por WhatsApp",
    ],
  },
];

export const ALL_PLANS: Plan[] = [CAPTAIN_PLAN, ...CLUB_PLANS];

export const TRIAL_DURATION_DAYS = 14;

/** Descuento del anual frente a 12 mensualidades. */
export function annualDiscountPercent(plan: Plan): number {
  const monthlyTotal = plan.priceMonthlyEur * 12;
  if (monthlyTotal <= 0) return 0;
  return Math.round(((monthlyTotal - plan.priceYearlyEur) / monthlyTotal) * 100);
}

export function formatEur(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}
