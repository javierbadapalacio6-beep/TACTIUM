import { INSCRIPTION_FEE_BPS, INSCRIPTION_FEE_FIXED_CENTS } from "@/lib/connect";
import { ALL_PLANS, annualDiscountPercent } from "@/lib/plans";
import { vatNote } from "@/lib/tax";

/**
 * Frases de negocio que se repiten en varias páginas públicas. Viven aquí para
 * que digan exactamente lo mismo en todas partes y salgan de las constantes
 * reales (comisión de `lib/connect.ts`, precios de `lib/plans.ts`).
 */

/** «2 % + 0,25 €», leído de lo que de verdad se retiene en cada cobro. */
export const GATEWAY_FEE_TEXT = `${(INSCRIPTION_FEE_BPS / 100).toLocaleString("es-ES")} % + ${(
  INSCRIPTION_FEE_FIXED_CENTS / 100
).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`;

/** La frase sobre el dinero de las inscripciones. Una sola, en todas partes. */
export const INSCRIPTION_MONEY_TEXT = `Las inscripciones que se pagan online van a la cuenta del club, por Stripe. TACTIUM no se queda margen: solo retiene el coste de la pasarela (${GATEWAY_FEE_TEXT}). Si el club prefiere cobrar en mano, también puede.`;

/** Mayor descuento real del anual frente a 12 mensualidades, entre todos los planes. */
export const MAX_ANNUAL_DISCOUNT = Math.max(...ALL_PLANS.map(annualDiscountPercent));

/** «Hasta −20 %», calculado; se usa en el selector mensual/anual. */
export const ANNUAL_SAVING_TEXT = `hasta −${MAX_ANNUAL_DISCOUNT} %`;

/**
 * Cómo se presentan los impuestos. Mientras el IVA esté apagado
 * (`lib/tax.ts`), el precio que se ve es el que se cobra, sin nada encima.
 */
export function priceTaxNote(tier: string): string {
  return vatNote(tier) || "Precio final, sin impuestos añadidos";
}

/**
 * Lo que sigue gratis cuando acaba la prueba sin suscribirse. Mismo criterio
 * que `TrialCard`: montar el equipo e invitar es gratis; la gestión (jornadas,
 * alineaciones, escáner, recordatorios) es de pago.
 */
export const FREE_AFTER_TRIAL: string[] = [
  "Montar tu equipo e invitar a la plantilla",
  "Seguir torneos en directo y apuntarte a ellos",
  "Consultar la competición federada: clasificaciones, actas y rankings",
  "Tu perfil público y la comunidad",
  "Organizar torneos de hasta 16 parejas",
];

export const PAID_AFTER_TRIAL_TEXT =
  "Jornadas, alineaciones, escáner de plantilla y recordatorios necesitan un plan.";
