import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST /api/tournaments/webhook
// Webhook de Stripe. Al confirmarse el pago (checkout.session.completed) marca
// el pago como 'paid' y el torneo como 'paid' (listo para publicar). Es la
// FUENTE DE VERDAD del cobro: la app no debe fiarse del success_url.
//
// Configura el endpoint en Stripe apuntando a esta URL y pon el secreto en
// STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
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
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Firma inválida: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = supabaseAdmin();
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    // Marca el pago como pagado y recupera qué tamaño cubre.
    const { data: payment } = await admin
      .from("tournament_payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: paymentIntent,
      })
      .eq("stripe_session_id", session.id)
      .select("tournament_id, covers_pairs")
      .maybeSingle();

    // Desbloquea el torneo: queda pagado, se anota la cobertura y, si estaba
    // retenido en borrador por el pago, se PUBLICA (pasa a inscripción abierta).
    const tournamentId = payment?.tournament_id ?? session.metadata?.tournament_id;
    if (tournamentId) {
      const { data: t } = await admin
        .from("tournaments")
        .select("status, covered_pairs")
        .eq("id", tournamentId)
        .maybeSingle();
      await admin
        .from("tournaments")
        .update({
          billing_status: "paid",
          covered_pairs: Math.max(
            payment?.covers_pairs ?? 0,
            t?.covered_pairs ?? 0,
          ),
          ...(t?.status === "draft" ? { status: "open" } : {}),
        })
        .eq("id", tournamentId);
    }
  }

  return NextResponse.json({ received: true });
}
