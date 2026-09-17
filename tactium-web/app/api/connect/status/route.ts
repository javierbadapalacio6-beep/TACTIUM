import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  isClubAdmin,
  userIdFromRequest,
  mapAccountStatus,
  connectErrorMessage,
  type ConnectStatus,
} from "@/lib/connect";

// GET /api/connect/status?clubId=...
// Consulta la cuenta Express del club en Stripe, refresca el estado en la BD y
// lo devuelve. Así no dependemos del webhook para el onboarding (se puede añadir
// después para tiempo real).
export async function GET(req: Request) {
  const admin = supabaseAdmin();
  const userId = await userIdFromRequest(req, admin, supabaseServer);
  if (!userId) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const clubId = new URL(req.url).searchParams.get("clubId");
  if (!clubId) return NextResponse.json({ error: "Falta el club" }, { status: 400 });
  if (!(await isClubAdmin(admin, userId, clubId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: club } = await admin
    .from("clubs")
    .select("stripe_connect_account_id, stripe_connect_status")
    .eq("id", clubId)
    .maybeSingle();
  if (!club) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  const accountId = club.stripe_connect_account_id as string | null;
  if (!accountId || !stripeConfigured()) {
    return NextResponse.json({
      status: (club.stripe_connect_status as ConnectStatus) ?? "none",
      hasAccount: false,
    });
  }

  const stripe = getStripe();

  // Si Stripe no contesta, se devuelve el último estado conocido en vez de dejar
  // que la excepción tumbe la respuesta: el cliente caía al `catch` y pintaba
  // "sin conectar" a un club que sí lo estaba.
  let account: Stripe.Account;
  try {
    account = await stripe.accounts.retrieve(accountId);
  } catch (e) {
    console.error("[connect/status] no se pudo leer la cuenta", { clubId, accountId }, e);
    return NextResponse.json({
      status: (club.stripe_connect_status as ConnectStatus) ?? "none",
      hasAccount: true,
      error: connectErrorMessage(e),
    });
  }

  const status = mapAccountStatus(account);
  if (status !== club.stripe_connect_status) {
    await admin
      .from("clubs")
      .update({ stripe_connect_status: status })
      .eq("id", clubId);
  }

  return NextResponse.json({
    status,
    hasAccount: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
}
