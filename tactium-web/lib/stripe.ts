import Stripe from "stripe";

/** Cliente Stripe de servidor. Requiere `STRIPE_SECRET_KEY` (test o live). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  return new Stripe(key);
}

/** ¿Está configurado el cobro por Stripe? (para degradar con elegancia). */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
