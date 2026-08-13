/**
 * Precios de suscripción para Stripe (web).
 *
 * La fuente de verdad del PRECIO es `plans.ts` (espejo de la app). Aquí solo se
 * resuelve tier + ciclo → importe en céntimos e intervalo de Stripe, y se
 * construye el `price_data` recurrente del Checkout. No hay price IDs de Stripe
 * precreados: se usa `price_data` en línea (mismo enfoque que el cobro por
 * torneo), así el importe SIEMPRE se calcula en el servidor desde `plans.ts` y
 * nunca se confía en el cliente.
 */
import { ALL_PLANS, type Plan } from "@/lib/plans";

export type BillingCycle = "monthly" | "yearly";
export type PlanTier = Plan["tier"];

export function planForTier(tier: string): Plan | null {
  return ALL_PLANS.find((p) => p.tier === tier) ?? null;
}

/** Importe facturado (céntimos) del tier en el ciclo dado. */
export function priceCents(plan: Plan, cycle: BillingCycle): number {
  const eur = cycle === "yearly" ? plan.priceYearlyEur : plan.priceMonthlyEur;
  return Math.round(eur * 100);
}

/** Intervalo de recurrencia de Stripe para el ciclo. */
export function stripeInterval(cycle: BillingCycle): "month" | "year" {
  return cycle === "yearly" ? "year" : "month";
}

/** Días de prueba (reverse trial): 14 por defecto, igual que la app. */
export const TRIAL_DAYS = 14;

/** `line_items` recurrente para el Checkout en modo suscripción. */
export function subscriptionLineItem(plan: Plan, cycle: BillingCycle) {
  return {
    quantity: 1,
    price_data: {
      currency: "eur",
      unit_amount: priceCents(plan, cycle),
      recurring: { interval: stripeInterval(cycle) },
      product_data: {
        name: `TACTIUM ${plan.displayName}`,
        description:
          cycle === "yearly"
            ? "Suscripción anual"
            : "Suscripción mensual",
      },
    },
  };
}
