import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  computeTournamentBilling,
  PLAN_TOURNAMENT_PAIR_CAP,
} from "@/lib/tournament-billing";
import { sendTournamentPaymentEmail } from "@/lib/email";

// POST /api/tournaments/:id/checkout
// Crea la sesión de Stripe Checkout del fee del torneo (cobro POR ADELANTADO
// según max_pairs). El importe se calcula SIEMPRE aquí, nunca se confía en el
// cliente. Requiere que el usuario sea admin/owner del club dueño del torneo.
//
// MODELO DE COBERTURA: el importe a cobrar es
//     (precio del tamaño ACTUAL) − (lo ya pagado por este torneo)
// De ahí salen gratis dos comportamientos:
//   · Nunca se cobra dos veces: si ya está cubierto, `due <= 0` → {paid:true}.
//   · Ampliar plazas cobra solo la DIFERENCIA (32→64 = 55 − 25 = 30 €).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // `deliver: "email"` → el enlace de pago NO se devuelve, se manda por correo.
  // Es el modo que usa la app móvil: Apple prohíbe que la app incluya enlaces a
  // métodos de pago ajenos a IAP (3.1.1a), pero permite expresamente
  // comunicarse con el usuario fuera de la app sobre ellos (3.1.3).
  const body = (await req.json().catch(() => ({}))) as { deliver?: string };
  const byEmail = body.deliver === "email";

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
    .select("id, name, club_id, max_pairs, billing_status, status, covered_pairs")
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

  // Lo YA pagado por este torneo (la suma de todos los cobros confirmados).
  const { data: paidRows } = await admin
    .from("tournament_payments")
    .select("amount_cents")
    .eq("tournament_id", t.id)
    .eq("status", "paid");
  const paidCents = (paidRows ?? []).reduce(
    (acc, r) => acc + (r.amount_cents ?? 0),
    0,
  );

  const requiredCents =
    billing.kind === "payable" ? Math.round(billing.amountEur * 100) : 0;
  const dueCents = requiredCents - paidCents;

  // ── Ya está cubierto (incluido, gratis, o pagado de sobra) ────────────────
  // Aquí es donde se corta el DOBLE COBRO: si el torneo ya tiene pagos que
  // cubren su tamaño actual, no se crea ninguna sesión nueva.
  if (dueCents <= 0) {
    const covered =
      paidCents > 0
        ? "paid"
        : billing.kind === "included"
          ? "included"
          : "free";
    await admin
      .from("tournaments")
      .update({
        billing_status: covered,
        covered_pairs: t.max_pairs,
        // Un torneo que estaba retenido por el pago se publica al quedar cubierto.
        ...(t.status === "draft" ? { status: "open" } : {}),
      })
      .eq("id", t.id);
    return NextResponse.json({ paid: true, reason: covered });
  }

  // A partir de aquí hay algo que cobrar. (Inalcanzable con kind != 'payable':
  // esos casos tienen requiredCents = 0 y ya han salido arriba; el guard está
  // para que TypeScript pueda estrechar el tipo y leer `billing.reason`.)
  if (billing.kind !== "payable") {
    return NextResponse.json({ paid: true, reason: billing.kind });
  }

  const amountCents = dueCents;
  const isTopUp = paidCents > 0; // ampliación de plazas, no primer pago
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    "https://tactium.io";

  const stripe = getStripe();

  // Entrega del enlace: a la web se le devuelve, a la app se le manda por
  // correo (ver nota de Apple arriba). En modo email la respuesta NUNCA
  // incluye la URL, para que la app no pueda abrirla ni por accidente.
  const deliver = async (url: string, reused = false) => {
    if (!byEmail) return NextResponse.json({ url, reused });
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const to = u.user?.email;
    if (!to) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene email para enviarte el enlace de pago." },
        { status: 422 },
      );
    }
    const sent = await sendTournamentPaymentEmail({
      to,
      tournamentName: t.name ?? "",
      maxPairs: t.max_pairs,
      amountEur: amountCents / 100,
      isTopUp,
      url,
    });
    return NextResponse.json({
      emailed: sent.ok,
      to,
      ...(sent.ok ? {} : { emailError: sent.error }),
    });
  };

  // ── Idempotencia ──────────────────────────────────────────────────────────
  // Si ya hay una sesión pendiente por el MISMO importe y sigue abierta en
  // Stripe, se reutiliza en vez de crear otra (evita filas basura y que el
  // club acabe con dos pagos abiertos del mismo torneo). Las que ya no sirven
  // (importe distinto o sesión caducada) se marcan como canceladas.
  const { data: pending } = await admin
    .from("tournament_payments")
    .select("id, amount_cents, stripe_session_id")
    .eq("tournament_id", t.id)
    .eq("status", "pending");

  for (const p of pending ?? []) {
    if (!p.stripe_session_id) continue;
    let stale = p.amount_cents !== amountCents;
    if (!stale) {
      const prev = await stripe.checkout.sessions
        .retrieve(p.stripe_session_id)
        .catch(() => null);
      if (prev?.status === "open" && prev.url) {
        return deliver(prev.url, true);
      }
      stale = true; // caducada o ya completada por otra vía
    }
    await admin
      .from("tournament_payments")
      .update({ status: "canceled" })
      .eq("id", p.id);
  }

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
            description: isTopUp
              ? `Ampliación a ${t.max_pairs} plazas (diferencia sobre lo ya pagado)`
              : billing.reason === "overage"
                ? `Exceso de parejas sobre tu plan (${t.max_pairs} plazas)`
                : `Cuota de organización (${t.max_pairs} plazas)`,
          },
        },
      },
    ],
    metadata: { tournament_id: t.id, club_id: t.club_id },
    // `src` marca el ORIGEN del checkout para que la página de retorno sepa qué
    // hacer: `app` (entrega por correo → el pago se inició desde el móvil) ofrece
    // volver a la app; `web` (la URL se devolvió directa → el usuario ya está en
    // el navegador) se queda en la web. La regla de Apple obliga a que la app
    // vaya siempre por correo, así que `byEmail` ES la señal de "viene de la app".
    success_url: `${origin}/torneos/pago-ok?tid=${t.id}&src=${byEmail ? "app" : "web"}`,
    cancel_url: `${origin}/torneos/pago-cancelado?tid=${t.id}&src=${byEmail ? "app" : "web"}`,
  });

  // Registra el intento (pendiente) y marca el torneo a la espera de pago.
  // `covers_pairs` deja constancia del tamaño que cubre este cobro concreto.
  await admin.from("tournament_payments").insert({
    tournament_id: t.id,
    club_id: t.club_id,
    max_pairs: t.max_pairs,
    covers_pairs: t.max_pairs,
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

  return deliver(session.url ?? "");
}
