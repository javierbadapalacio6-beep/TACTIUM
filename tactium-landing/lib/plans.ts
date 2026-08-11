// Sincronizado MANUALMENTE con `TACTIUM/src/core/subscriptions/plans.ts`.
// Si cambias precios o ids de producto en la app, replícalo aquí.
// Fuente de verdad operacional vive en App Store / Google Play tras
// publicación; esta tabla es sólo display de marketing.

export type PlanTier =
  | "captain"
  | "club_starter"
  | "club_pro"
  | "club_elite";

export interface PlanDescriptor {
  tier: PlanTier;
  productIdMonthly: string;
  productIdYearly: string;
  priceMonthlyEur: number;
  priceYearlyEur: number;
  displayName: string;
  shortLabel: string;
  // Cuántos equipos cubre el plan. Para captain individual, 1.
  teamQuota: number;
  // Tamaño máximo de torneo incluido en el plan (nº de parejas). null = el plan
  // no incluye organización de torneos (p. ej. Capitán).
  tournamentPairCap: number | null;
  // Bullets de features que aparecen en la card de pricing.
  features: string[];
}

// ── Pago por torneo (clubes que solo quieren torneos, sin suscripción) ───────
export interface TournamentTier {
  label: string;
  pairs: number;
  priceEur: number | null; // null = gratis
}
export const TOURNAMENT_TIERS: TournamentTier[] = [
  { label: "Gratis", pairs: 16, priceEur: null },
  { label: "Hasta 40 parejas", pairs: 40, priceEur: 25 },
  { label: "Hasta 90 parejas", pairs: 90, priceEur: 59 },
  { label: "Hasta 150 parejas", pairs: 150, priceEur: 99 },
  { label: "Hasta 200 parejas", pairs: 200, priceEur: 139 },
];
export const TOURNAMENT_EXTRA_PAIR_EUR = 2;
export const TOURNAMENT_BULK_DISCOUNT_PERCENT = 20; // 3+ torneos al año

export const CAPTAIN_PLAN: PlanDescriptor = {
  tier: "captain",
  productIdMonthly: "tactium_captain_monthly",
  productIdYearly: "tactium_captain_yearly",
  priceMonthlyEur: 4.99,
  priceYearlyEur: 47.9,
  displayName: "Capitán",
  shortLabel: "Capitán",
  teamQuota: 1,
  tournamentPairCap: null,
  features: [
    "1 equipo de hasta 30 jugadores",
    "Alineaciones inteligentes en cada jornada",
    "Hasta 5 variantes por jornada",
    "Push a jugadores convocados",
    "Histórico completo de temporadas",
  ],
};

export const CLUB_STARTER_PLAN: PlanDescriptor = {
  tier: "club_starter",
  productIdMonthly: "tactium_club_starter_monthly",
  productIdYearly: "tactium_club_starter_yearly",
  priceMonthlyEur: 11.99,
  priceYearlyEur: 115.1,
  displayName: "Club Starter",
  shortLabel: "Starter",
  teamQuota: 3,
  tournamentPairCap: 40,
  features: [
    "Hasta 3 equipos cubiertos",
    "Torneos incluidos hasta 40 parejas",
    "Capitanes invitados sin coste extra",
    "Panel global del club",
    "Soporte prioritario por email",
  ],
};

export const CLUB_PRO_PLAN: PlanDescriptor = {
  tier: "club_pro",
  productIdMonthly: "tactium_club_pro_monthly",
  productIdYearly: "tactium_club_pro_yearly",
  priceMonthlyEur: 24.99,
  priceYearlyEur: 239.9,
  displayName: "Club Pro",
  shortLabel: "Pro",
  teamQuota: 10,
  tournamentPairCap: 90,
  features: [
    "Hasta 10 equipos cubiertos",
    "Torneos incluidos hasta 90 parejas",
    "Multi-categoría (M/F/Mixto)",
    "Horarios de pista + rejilla",
    "Todas las features de Starter",
  ],
};

export const CLUB_ELITE_PLAN: PlanDescriptor = {
  tier: "club_elite",
  productIdMonthly: "tactium_club_elite_monthly",
  productIdYearly: "tactium_club_elite_yearly",
  priceMonthlyEur: 39.99,
  priceYearlyEur: 383.9,
  displayName: "Club Elite",
  shortLabel: "Elite",
  teamQuota: 25,
  tournamentPairCap: 150,
  features: [
    "Hasta 25 equipos cubiertos",
    "Torneos incluidos hasta 150 parejas",
    "Reporting avanzado por categoría",
    "Todas las features de Pro",
    "Soporte por WhatsApp directo",
  ],
};

export const CLUB_PLANS: PlanDescriptor[] = [
  CLUB_STARTER_PLAN,
  CLUB_PRO_PLAN,
  CLUB_ELITE_PLAN,
];

export const ALL_PLANS: PlanDescriptor[] = [CAPTAIN_PLAN, ...CLUB_PLANS];

export const TRIAL_DURATION_DAYS = 14;

export function annualDiscountPercent(plan: PlanDescriptor): number {
  const monthlyTotal = plan.priceMonthlyEur * 12;
  if (monthlyTotal <= 0) return 0;
  const saved = monthlyTotal - plan.priceYearlyEur;
  return Math.round((saved / monthlyTotal) * 100);
}

export function formatEur(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}
