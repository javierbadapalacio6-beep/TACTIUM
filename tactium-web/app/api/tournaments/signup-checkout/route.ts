import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { inscriptionFeeCents, webAppOrigin, userIdFromRequest } from "@/lib/connect";
import { supabaseServer } from "@/lib/supabase/server";
import { priceSignup } from "@/lib/tournament-signup-pricing";

interface SignupReg {
  category: string | null;
  gender: string | null;
  p1Name: string;
  p2Name: string;
  p1Email?: string | null;
  p1Phone?: string | null;
  p2Email?: string | null;
  seedPoints?: number | null;
  leagueSum?: number | null;
  availability?: string[];
}

// POST /api/tournaments/signup-checkout
// Cobro de la inscripción (1 o 2 categorías). Público (por código). El precio es
// POR PERSONA (1 cat → entry_fee, 2 → entry_fee_2), calculado SIEMPRE aquí con
// el helper compartido (nunca se confía en el cliente). Guarda las
// inscripciones en un pago PENDIENTE y crea un Checkout con destination charge
// al club (− 3% TACTIUM). Las inscripciones se CREAN al confirmarse (webhook).
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "El cobro de inscripciones aún no está activo." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    regs?: SignupReg[];
  };

  const code = (body.code ?? "").trim().toUpperCase();
  const regs = (body.regs ?? []).filter(
    (r) => r && r.p1Name?.trim() && r.p2Name?.trim(),
  );
  if (!code || regs.length === 0) {
    return NextResponse.json({ error: "Faltan datos de la inscripción." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Torneo por código (+ su club y precios).
  const { data: t } = await admin
    .from("tournaments")
    .select("id, name, club_id, status, entry_fee, entry_fee_2")
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

  // Precio POR PERSONA (1 cat → entry_fee, 2 → entry_fee_2), calculado aquí.
  const pricing = priceSignup(
    regs.map((r) => ({
      category: r.category ?? null,
      p1Name: r.p1Name,
      p2Name: r.p2Name,
    })),
    entryFee,
    t.entry_fee_2 != null ? Number(t.entry_fee_2) : null,
  );
  const amountCents = pricing.totalCents;
  if (!(amountCents > 0)) {
    return NextResponse.json({ error: "Importe inválido." }, { status: 400 });
  }
  const feeCents = inscriptionFeeCents(amountCents);

  // Ficha de cada inscripción, para crearlas en el webhook al confirmar el pago.
  const payloadRegs = regs.map((r) => ({
    category: r.category ?? null,
    gender: r.gender ?? null,
    p1Name: r.p1Name.trim(),
    p2Name: r.p2Name.trim(),
    p1Email: r.p1Email?.trim() || null,
    p1Phone: r.p1Phone?.trim() || null,
    p2Email: r.p2Email?.trim() || null,
    seedPoints: r.seedPoints ?? null,
    leagueSum: r.leagueSum ?? null,
    availability: r.availability ?? [],
  }));
  const payerEmail = payloadRegs[0]?.p1Email ?? null;
  // Usuario que paga (login obligatorio en la web): la inscripción se atará a su
  // cuenta. El webhook usa service-role (auth.uid()=null), así que guardamos su
  // id aquí y lo escribimos en las inscripciones al confirmar el pago.
  const payerUserId = await userIdFromRequest(req, admin, supabaseServer);
  const payload = {
    code,
    tournamentName: t.name ?? null,
    p1UserId: payerUserId,
    regs: payloadRegs,
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

  const origin = webAppOrigin(req);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Una línea POR PERSONA: cada jugador con su cuota (1 o 2 categorías).
    line_items: pricing.persons.map((p) => ({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: p.feeCents,
        product_data: {
          name: `Inscripción · ${p.name}`,
          description: `${p.categories >= 2 ? "2 categorías" : "1 categoría"} · ${t.name ?? "Torneo"}`,
        },
      },
    })),
    ...(payerEmail ? { customer_email: payerEmail } : {}),
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
