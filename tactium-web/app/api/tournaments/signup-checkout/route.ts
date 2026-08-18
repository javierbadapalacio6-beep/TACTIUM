import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { inscriptionFeeCents } from "@/lib/connect";

// POST /api/tournaments/signup-checkout
// Cobro de la cuota de inscripción de una pareja. Público (inscripción por
// código, como el signup gratuito). Guarda la ficha en un pago PENDIENTE y crea
// un Checkout con destination charge a la cuenta del club (− 3% TACTIUM). La
// inscripción se CREA al confirmarse el pago (webhook), no antes.
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "El cobro de inscripciones aún no está activo." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    p1Name?: string;
    p2Name?: string;
    category?: string | null;
    gender?: string | null;
    seedPoints?: number | null;
    leagueSum?: number | null;
    availability?: string[];
  };

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code || !body.p1Name?.trim() || !body.p2Name?.trim()) {
    return NextResponse.json({ error: "Faltan datos de la inscripción." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Torneo por código (+ su club y precio).
  const { data: t } = await admin
    .from("tournaments")
    .select("id, name, club_id, status, entry_fee")
    .eq("signup_code", code)
    .maybeSingle();
  if (!t || !t.club_id) {
    return NextResponse.json({ error: "Código de torneo no válido." }, { status: 404 });
  }
  if (t.status === "draft") {
    return NextResponse.json(
      { error: "El torneo aún no está publicado.", reason: "draft" },
      { status: 409 },
    );
  }
  const entryFee = Number(t.entry_fee ?? 0);
  if (!(entryFee > 0)) {
    return NextResponse.json(
      { error: "Este torneo no tiene cuota de inscripción.", reason: "free" },
      { status: 400 },
    );
  }

  // El club debe estar conectado a Stripe (Connect activo) para recibir el pago.
  const { data: club } = await admin
    .from("clubs")
    .select("stripe_connect_account_id, stripe_connect_status")
    .eq("id", t.club_id)
    .maybeSingle();
  const acct = club?.stripe_connect_account_id as string | null;
  if (!acct || club?.stripe_connect_status !== "active") {
    return NextResponse.json(
      {
        error: "El club aún no tiene los cobros online activados.",
        reason: "not_connected",
      },
      { status: 409 },
    );
  }

  const amountCents = Math.round(entryFee * 100);
  const feeCents = inscriptionFeeCents(amountCents);

  const payload = {
    code,
    p1Name: body.p1Name.trim(),
    p2Name: body.p2Name.trim(),
    category: body.category ?? null,
    gender: body.gender ?? null,
    seedPoints: body.seedPoints ?? null,
    leagueSum: body.leagueSum ?? null,
    availability: body.availability ?? [],
  };

  // Pago pendiente con la ficha guardada.
  const { data: pay, error: payErr } = await admin
    .from("tournament_signup_payments")
    .insert({
      tournament_id: t.id,
      club_id: t.club_id,
      amount_cents: amountCents,
      application_fee_cents: feeCents,
      status: "pending",
      provider: "stripe",
      connected_account_id: acct,
      signup_payload: payload,
    })
    .select("id")
    .single();
  if (payErr || !pay) {
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 500 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    "https://app.tactium.io";

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
            name: `Inscripción · ${t.name ?? "Torneo"}`,
            description: `${payload.p1Name} / ${payload.p2Name}`,
          },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: feeCents,
      transfer_data: { destination: acct },
      on_behalf_of: acct,
    },
    metadata: {
      kind: "signup",
      tournament_id: t.id,
      signup_payment_id: pay.id,
    },
    success_url: `${origin}/torneos/${t.id}?inscripcion=ok`,
    cancel_url: `${origin}/torneos/${t.id}/inscripcion?pago=cancelado`,
  });

  await admin
    .from("tournament_signup_payments")
    .update({ stripe_session_id: session.id })
    .eq("id", pay.id);

  return NextResponse.json({ url: session.url });
}
