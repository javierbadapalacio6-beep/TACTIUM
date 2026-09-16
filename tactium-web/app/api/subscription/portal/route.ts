import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { webAppOrigin } from "@/lib/connect";

// POST /api/subscription/portal
// Abre el portal de facturación de Stripe (cancelar, cambiar método de pago,
// ver facturas) para la suscripción WEB del usuario. Solo aplica a compras de
// web (`platform='web'`): las de tienda se gestionan en la tienda.
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "El cobro de suscripciones aún no está activo." },
      { status: 503 },
    );
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  // El customer de Stripe está en `revenuecat_customer_id` (slot de proveedor)
  // de la suscripción web del usuario. Se toma la más reciente que pagó él.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("revenuecat_customer_id, platform, status")
    .eq("payer_user_id", userId)
    .eq("platform", "web")
    .in("status", ["trialing", "active", "grace_period"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = sub?.revenuecat_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "No tienes una suscripción web que gestionar." },
      { status: 404 },
    );
  }

  // `/suscripcion` y `/pro` viven en la web app, no en la landing del apex: el
  // helper compartido normaliza el origen para no devolver al usuario a una
  // ruta que allí no existe (ver lib/connect.ts).
  const origin = webAppOrigin(req);

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/suscripcion`,
  });

  return NextResponse.json({ url: session.url });
}
