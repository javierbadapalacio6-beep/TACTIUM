import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  planForTier,
  subscriptionLineItem,
  TRIAL_DAYS,
  type BillingCycle,
} from "@/lib/subscription-billing";

// POST /api/subscription/checkout
// Crea la sesión de Stripe Checkout de una SUSCRIPCIÓN (reverse-trial de 14
// días). El importe se calcula SIEMPRE en el servidor desde `plans.ts`, nunca se
// confía en el cliente. El sujeto es el club (planes de club) o el propio
// usuario (plan capitán), y se AUTORIZA aquí igual que el cobro por torneo.
//
// Es dormant hasta que existan claves de Stripe: sin `STRIPE_SECRET_KEY`
// responde 503 y no toca nada (mismo enfoque que el cobro por torneo).
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "El cobro de suscripciones aún no está activo." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    tier?: string;
    cycle?: string;
    subjectType?: string;
    subjectId?: string;
  };
  const tier = body.tier ?? "";
  const cycle: BillingCycle = body.cycle === "monthly" ? "monthly" : "yearly";
  const plan = planForTier(tier);
  if (!plan) {
    return NextResponse.json({ error: "Plan desconocido" }, { status: 400 });
  }

  // Sesión por cookie (web).
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // ── Resolver y AUTORIZAR el sujeto ────────────────────────────────────────
  // Plan de club → subject_type='club' (el usuario debe ser owner/admin del
  // club). Plan capitán → subject_type='user' (el propio usuario).
  let subjectType: "club" | "user";
  let subjectId: string;
  if (tier === "captain") {
    subjectType = "user";
    subjectId = userId;
    if (body.subjectType === "club") {
      return NextResponse.json(
        { error: "El plan Capitán es personal, no de club." },
        { status: 400 },
      );
    }
  } else {
    subjectType = "club";
    subjectId = body.subjectId ?? "";
    if (!subjectId) {
      return NextResponse.json(
        { error: "Falta el club para el plan de club." },
        { status: 400 },
      );
    }
    // Autorización: owner del club o club_member admin.
    const { data: club } = await admin
      .from("clubs")
      .select("owner_id")
      .eq("id", subjectId)
      .maybeSingle();
    let authorized = club?.owner_id === userId;
    if (!authorized) {
      const { data: mem } = await admin
        .from("club_members")
        .select("role")
        .eq("club_id", subjectId)
        .eq("user_id", userId)
        .maybeSingle();
      authorized = mem?.role === "admin";
    }
    if (!authorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // ── Evitar doble cobro entre plataformas ──────────────────────────────────
  // Si el sujeto ya tiene una suscripción premium activa, no se crea otra: si es
  // de tienda, se gestiona allí; si es de web, que use el portal.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("platform, status")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .in("status", ["trialing", "active", "grace_period"])
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const where =
      existing.platform === "web"
        ? "Ya tienes una suscripción activa. Gestiónala desde «Mi suscripción»."
        : "Ya tienes una suscripción activa en la tienda de tu móvil; gestiónala allí.";
    return NextResponse.json({ error: where, alreadyActive: true }, { status: 409 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    "https://tactium.io";

  const metadata = {
    tier,
    cycle,
    subject_type: subjectType,
    subject_id: subjectId,
    payer_user_id: userId,
    // product_id espejo del catálogo de tienda (tactium_<tier>_<ciclo>).
    product_id: `tactium_${tier}_${cycle}`,
  };

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [subscriptionLineItem(plan, cycle)],
    // El reverse-trial: 14 días sin cobro. La suscripción arranca en `trialing`.
    subscription_data: { trial_period_days: TRIAL_DAYS, metadata },
    ...(user?.email ? { customer_email: user.email } : {}),
    // Metadata también en la sesión para el evento checkout.session.completed.
    metadata,
    success_url: `${origin}/suscripcion?sub=ok`,
    cancel_url: `${origin}/pro?sub=cancel`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url ?? "" });
}
