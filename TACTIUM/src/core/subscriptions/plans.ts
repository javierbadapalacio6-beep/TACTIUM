import type { Database } from '@core/supabase/database.types';

export type PlanTier = Database['public']['Enums']['subscription_plan_tier'];
export type BillingPeriod = Database['public']['Enums']['subscription_billing_period'];
export type SubscriptionStatus = Database['public']['Enums']['subscription_status'];
export type SubjectType = Database['public']['Enums']['subscription_subject_type'];

// ── Tabla maestra de planes ─────────────────────────────────────────────────
// Estos precios se hardcodean también en App Store Connect y Google Play.
// Cualquier cambio aquí debe replicarse en las stores (Apple/Google son la
// fuente de verdad legal del precio cobrado; este archivo es solo display).
export interface PlanDescriptor {
  tier: PlanTier;
  // Identificadores de producto en las stores (idénticos en iOS / Android).
  productIdMonthly: string;
  productIdYearly: string;
  // Precios "públicos" para display. Apple/Google los muestran traducidos a la
  // moneda local del store. En España (€) coinciden con estos.
  priceMonthlyEur: number;
  priceYearlyEur: number;
  displayName: string;
  // Cuántos equipos cubre este plan. Sólo aplica a `club_*`; para `captain`
  // siempre es 1 (un solo equipo del propio capitán).
  teamQuota: number;
  // Tamaño máximo de torneo (nº de parejas) INCLUIDO en el plan. `null` = el
  // plan no incluye organización de torneos (p. ej. `captain`). Por encima del
  // tope se paga por torneo (recargo por pareja). Sincronizado con la landing.
  tournamentPairCap: number | null;
  // Etiqueta corta para UI ("Pro", "Elite", etc.). Para captain = "Capitán".
  shortLabel: string;
}

export const CAPTAIN_PLAN: PlanDescriptor = {
  tier: 'captain',
  productIdMonthly: 'tactium_captain_monthly',
  productIdYearly: 'tactium_captain_yearly',
  priceMonthlyEur: 4.99,
  priceYearlyEur: 47.99,
  displayName: 'Capitán',
  teamQuota: 1,
  tournamentPairCap: null,
  shortLabel: 'Capitán',
};

export const CLUB_STARTER_PLAN: PlanDescriptor = {
  tier: 'club_starter',
  productIdMonthly: 'tactium_club_starter_monthly',
  productIdYearly: 'tactium_club_starter_yearly',
  priceMonthlyEur: 11.99,
  priceYearlyEur: 115.99,
  displayName: 'Club Starter',
  teamQuota: 3,
  tournamentPairCap: 32,
  shortLabel: 'Starter',
};

export const CLUB_PRO_PLAN: PlanDescriptor = {
  tier: 'club_pro',
  productIdMonthly: 'tactium_club_pro_monthly',
  productIdYearly: 'tactium_club_pro_yearly',
  priceMonthlyEur: 24.99,
  priceYearlyEur: 239.99,
  displayName: 'Club Pro',
  teamQuota: 10,
  tournamentPairCap: 64,
  shortLabel: 'Pro',
};

export const CLUB_ELITE_PLAN: PlanDescriptor = {
  tier: 'club_elite',
  productIdMonthly: 'tactium_club_elite_monthly',
  productIdYearly: 'tactium_club_elite_yearly',
  priceMonthlyEur: 39.99,
  priceYearlyEur: 384.99,
  displayName: 'Club Elite',
  teamQuota: 25,
  tournamentPairCap: 128,
  shortLabel: 'Elite',
};

export const ALL_PLANS: PlanDescriptor[] = [
  CAPTAIN_PLAN,
  CLUB_STARTER_PLAN,
  CLUB_PRO_PLAN,
  CLUB_ELITE_PLAN,
];

export const CLUB_PLANS: PlanDescriptor[] = [
  CLUB_STARTER_PLAN,
  CLUB_PRO_PLAN,
  CLUB_ELITE_PLAN,
];

export const PLAN_BY_TIER: Record<PlanTier, PlanDescriptor> = {
  captain: CAPTAIN_PLAN,
  club_starter: CLUB_STARTER_PLAN,
  club_pro: CLUB_PRO_PLAN,
  club_elite: CLUB_ELITE_PLAN,
};

// ── Trial ───────────────────────────────────────────────────────────────────
export const TRIAL_DURATION_DAYS = 14;

// ── Estados que cuentan como "premium activo" ──────────────────────────────
// Mismos valores que la función `fn_has_premium_access` en DB. Si cambias
// uno, cambia el otro.
export const PREMIUM_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  'trialing',
  'active',
  'grace_period',
] as const;

// ── Helpers de cálculo ──────────────────────────────────────────────────────

/**
 * Devuelve el descuento porcentual del plan anual vs 12 meses del mensual.
 * Se calcula on-the-fly para que cualquier ajuste de precio se refleje sin
 * tocar UI.
 */
export function annualDiscountPercent(plan: PlanDescriptor): number {
  const monthlyTotal = plan.priceMonthlyEur * 12;
  if (monthlyTotal <= 0) return 0;
  const saved = monthlyTotal - plan.priceYearlyEur;
  return Math.round((saved / monthlyTotal) * 100);
}

/**
 * Recomendación de plan para un club dado el nº de equipos.
 * Devuelve el plan más barato cuya quota cubre los equipos pedidos,
 * o `null` si excede el plan Elite (caso "ventas B2B").
 */
export function recommendClubPlanForTeams(
  teamCount: number,
): PlanDescriptor | null {
  for (const plan of CLUB_PLANS) {
    if (plan.teamQuota >= teamCount) return plan;
  }
  return null;
}

/**
 * Format helper para precios en euros con coma decimal (locale es-ES).
 * Evita Intl.NumberFormat (overkill para 4 precios fijos) y se asegura
 * de mostrar siempre 2 decimales.
 */
export function formatEur(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}
