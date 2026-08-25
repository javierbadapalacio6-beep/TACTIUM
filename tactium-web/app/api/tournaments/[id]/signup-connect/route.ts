import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripeConfigured } from "@/lib/stripe";

// GET /api/tournaments/[id]/signup-connect
// ¿Puede este torneo cobrar la inscripción online? Es decir: la pasarela está
// activa Y el club está dado de alta en Stripe Connect (cuenta conectada
// `active`). Público: lo consulta la ficha de inscripción para enseñar los
// botones correctos (pago online con Stripe vs. solo "pagar en el club").
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Sin claves de Stripe no hay cobro online posible.
  if (!stripeConfigured()) return NextResponse.json({ online: false });

  const admin = supabaseAdmin();

  const { data: t } = await admin
    .from("tournaments")
    .select("club_id, entry_fee")
    .eq("id", id)
    .maybeSingle();
  // Sin club o sin cuota → no hay pago online que ofrecer.
  if (!t?.club_id || !(Number(t.entry_fee ?? 0) > 0)) {
    return NextResponse.json({ online: false });
  }

  const { data: club } = await admin
    .from("clubs")
    .select("stripe_connect_account_id, stripe_connect_status")
    .eq("id", t.club_id)
    .maybeSingle();

  const online =
    !!club?.stripe_connect_account_id &&
    club?.stripe_connect_status === "active";

  return NextResponse.json({ online });
}
