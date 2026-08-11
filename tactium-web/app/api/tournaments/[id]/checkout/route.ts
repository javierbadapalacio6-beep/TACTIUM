import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  computeTournamentBilling,
  PLAN_TOURNAMENT_PAIR_CAP,
} from "@/lib/tournament-billing";

// POST /api/tournaments/:id/checkout
// Crea la sesión de Stripe Checkout del fee del torneo (cobro POR ADELANTADO
// según max_pairs). El importe se calcula SIEMPRE aquí, nunca se confía en el
// cliente. Requiere que el usuario sea admin/owner del club dueño del torneo.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "El cobro por torneo aún no está activo." },
      { status: 503 },
    );
  }

  const admin = supabaseAdmin();

  // Auth: token Bearer (app móvil) o sesión por cookie (web).
  const authHeader = req.headers.get("authorization");
  let userId: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(authHeader.slice(7));
    userId = data.user?.id ?? null;
  } else {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  // Torneo + club (con admin para lectura fiable; la autorización va aparte).
  const { data: t } = await admin
    .from("tournaments")
    .select("id, name, club_id, max_pairs, billing_status")
    .eq("id", id)
    .maybeSingle();
  if (!t || !t.club_id) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  // Autorización: owner del club o club_member admin.
  const { data: club } = await admin
    .from("clubs")
    .select("owner_id")
    .eq("id", t.club_id)
    .maybeSingle();
  let authorized = club?.owner_id === userId;
  if (!authorized) {
    const { data: mem } = await admin
      .from("club_members")
      .select("role")
      .eq("club_id", t.club_id)
      .eq("user_id", userId)
      .maybeSingle();
    authorized = mem?.role === "admin";
  }
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Suscripción de club activa → tope de torneo incluido.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_tier, status, current_period_end")
    .eq("subject_type", "club")
    .eq("subject_id", t.club_id)
    .in("status", ["trialing", "active", "grace_period"])
    .gt("current_period_end", new Date().toISOString())
    .maybeSingle();
  const planPairCap = sub ? PLAN_TOURNAMENT_PAIR_CAP[sub.plan_tier] ?? null : null;

  const billing = computeTournamentBilling({
    maxPairs: t.max_pairs,
    planPairCap,
    hasActiveSub: Boolean(sub),
  });

  if (billing.kind === "needs_size") {
    return NextResponse.json(
      { error: "Fija las plazas (parejas) del torneo para poder cobrarlo." },
      { status: 400 },
    );
  }
  if (billing.kind !== "payable") {
    // included / free → no hay que cobrar: se marca listo para publicar.
    await admin
      .from("tournaments")
      .update({ billing_status: billing.kind === "included" ? "included" : "free" })
      .eq("id", t.id);
    return NextResponse.json({ paid: true, reason: billing.kind });
  }

  const amountCents = Math.round(billing.amountEur * 100);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    "https://tactium.io";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: `Torneo: ${t.name ?? "TACTIUM"}`,
            description:
              billing.reason === "overage"
                ? `Exceso de parejas sobre tu plan (${t.max_pairs} plazas)`
                : `Cuota de organización (${t.max_pairs} plazas)`,
          },
        },
      },
    ],
    metadata: { tournament_id: t.id, club_id: t.club_id },
    success_url: `${origin}/torneos/pago-ok?tid=${t.id}`,
    cancel_url: `${origin}/torneos/pago-cancelado?tid=${t.id}`,
  });

  // Registra el intento (pendiente) y marca el torneo a la espera de pago.
  await admin.from("tournament_payments").insert({
    tournament_id: t.id,
    club_id: t.club_id,
    max_pairs: t.max_pairs,
    reason: billing.reason,
    amount_cents: amountCents,
    status: "pending",
    provider: "stripe",
    stripe_session_id: session.id,
  });
  await admin
    .from("tournaments")
    .update({ billing_status: "pending_payment" })
    .eq("id", t.id);

  return NextResponse.json({ url: session.url });
}
