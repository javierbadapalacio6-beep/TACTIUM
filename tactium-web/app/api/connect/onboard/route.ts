import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  isClubAdmin,
  userIdFromRequest,
  mapAccountStatus,
  webAppOrigin,
} from "@/lib/connect";

// POST /api/connect/onboard  { clubId }
// Crea (si no existe) la cuenta Express del club y devuelve un Account Link para
// que el admin complete el alta hospedada por Stripe (KYC + banco). Idempotente:
// si el club ya tiene cuenta pero el alta está incompleta, genera otro link.
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "El cobro por Stripe aún no está activo." },
      { status: 503 },
    );
  }

  const admin = supabaseAdmin();
  const userId = await userIdFromRequest(req, admin, supabaseServer);
  if (!userId) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { clubId?: string };
  const clubId = body.clubId;
  if (!clubId) {
    return NextResponse.json({ error: "Falta el club" }, { status: 400 });
  }
  if (!(await isClubAdmin(admin, userId, clubId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: club } = await admin
    .from("clubs")
    .select("id, name, stripe_connect_account_id")
    .eq("id", clubId)
    .maybeSingle();
  if (!club) {
    return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });
  }

  const stripe = getStripe();

  // Reutiliza la cuenta si ya existe; si no, crea una Express (ES/EUR).
  let accountId = club.stripe_connect_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "ES",
      email: undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: club.name ?? undefined,
        product_description: "Inscripciones de torneos de pádel",
      },
      metadata: { club_id: clubId },
    });
    accountId = account.id;
    await admin
      .from("clubs")
      .update({
        stripe_connect_account_id: accountId,
        stripe_connect_status: "onboarding",
      })
      .eq("id", clubId);
  }

  const origin = webAppOrigin(req);

  // Si el alta la inició la APP (token Bearer), al terminar Stripe no debe
  // devolver a una página web (el navegador no tiene sesión → login): la
  // mandamos a /connect/return, que rebota de vuelta a la app por deep link.
  // Desde la web (cookie) sí volvemos a la consola de Cobros del club.
  const fromApp = (req.headers.get("authorization") ?? "").startsWith("Bearer ");
  const returnUrl = fromApp
    ? `${origin}/connect/return`
    : `${origin}/club/cobros?connect=done`;
  const refreshUrl = fromApp
    ? `${origin}/connect/return?retry=1`
    : `${origin}/club/cobros?connect=refresh`;

  const link = await stripe.accountLinks.create({
    account: accountId,
    // Si el alta caduca o falta algo, Stripe manda a refresh_url para reintentar.
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  // Estado por si acaso (aún no estará activo hasta completar el alta).
  const account = await stripe.accounts.retrieve(accountId);
  await admin
    .from("clubs")
    .update({ stripe_connect_status: mapAccountStatus(account) })
    .eq("id", clubId);

  return NextResponse.json({ url: link.url });
}
