import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// POST /api/subscription/webhook
// Webhook de Stripe para SUSCRIPCIONES. Es la FUENTE DE VERDAD del estado: crea
// y reconcilia la fila de `subscriptions` en cada evento del ciclo de vida,
// igual que el webhook de RevenueCat hace en la app móvil. Escribe con
// service_role (bypassa RLS); por eso solo actúa con la firma verificada.
//
// Endpoint aparte del de torneos, con su propio secreto
// STRIPE_SUBSCRIPTION_WEBHOOK_SECRET (si falta, cae a STRIPE_WEBHOOK_SECRET).
//
// MODELO: no hay columnas propias de Stripe. Se reutiliza `platform='web'`,
// `revenuecat_customer_id` = customer de Stripe y `original_transaction_id` = id
// de la suscripción de Stripe (clave de dedupe: 1 fila por suscripción).

/** Estado de Stripe → estado de TACTIUM. `null` = ignorar (aún sin pagar). */
function mapStatus(s: string): string | null {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "grace_period";
    case "canceled":
      return "canceled";
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "expired";
    default:
      return null; // incomplete
  }
}

const toIso = (unix: number | null | undefined): string | null =>
  typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;

/** Vuelca una suscripción de Stripe a la tabla `subscriptions` (upsert por id). */
async function upsertFromStripeSub(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<void> {
  // Acceso defensivo: según la versión de la API, `current_period_*` puede vivir
  // a nivel de suscripción o de item.
  const s = sub as unknown as {
    id: string;
    status: string;
    customer: string | { id: string };
    current_period_start?: number;
    current_period_end?: number;
    trial_end?: number | null;
    cancel_at_period_end?: boolean;
    metadata?: Record<string, string>;
    items?: {
      data?: { current_period_start?: number; current_period_end?: number }[];
    };
  };

  const md = s.metadata ?? {};
  const subjectType = md.subject_type;
  const subjectId = md.subject_id;
  const payerUserId = md.payer_user_id;
  const tier = md.tier;
  const cycle = md.cycle === "monthly" ? "monthly" : "yearly";
  // Sin metadata de sujeto no podemos ubicar la fila con seguridad → se ignora.
  if (!subjectType || !subjectId || !payerUserId || !tier) return;

  const status = mapStatus(s.status);
  if (!status) return; // 'incomplete': aún no hay nada que reflejar.

  const item = s.items?.data?.[0];
  const periodStart = toIso(s.current_period_start ?? item?.current_period_start);
  const periodEnd = toIso(s.current_period_end ?? item?.current_period_end);
  const customerId =
    typeof s.customer === "string" ? s.customer : s.customer?.id ?? "";

  const row = {
    subject_type: subjectType,
    subject_id: subjectId,
    payer_user_id: payerUserId,
    plan_tier: tier,
    billing_period: cycle,
    status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_end: toIso(s.trial_end ?? null),
    cancel_at_period_end: Boolean(s.cancel_at_period_end),
    product_id: md.product_id ?? `tactium_${tier}_${cycle}`,
    platform: "web",
    revenuecat_customer_id: customerId,
    original_transaction_id: s.id,
    updated_at: new Date().toISOString(),
  };

  // Upsert por la suscripción de Stripe: si ya existe la fila, se actualiza; si
  // no, se inserta. Así el mismo `sub_...` mantiene UNA fila a lo largo de su
  // vida (creación → renovación → cancelación).
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("original_transaction_id", s.id)
    .maybeSingle();

  if (existing?.id) {
    await admin.from("subscriptions").update(row).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert(row);
  }
}

export async function POST(req: Request) {
  const secret =
    process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Sin firma" }, { status: 400 });
  }

  const body = await req.text(); // cuerpo CRUDO para verificar la firma
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Firma inválida: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break; // los pagos de torneo van aparte
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertFromStripeSub(admin, sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertFromStripeSub(admin, sub);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
