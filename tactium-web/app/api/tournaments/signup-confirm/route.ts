import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  emailConfigured,
  sendSignupConfirmationEmail,
  type SignupPaymentMethod,
} from "@/lib/email";

// POST /api/tournaments/signup-confirm
// Envía el email de confirmación de inscripción para los caminos que NO pasan
// por el webhook de Stripe: inscripción GRATIS y "pagar en el club". El pago
// online ya envía la confirmación desde el webhook. Público (inscripción por
// código); el nombre y la cuota se leen de la BD por el código, no se confía en
// el cliente para eso.
export async function POST(req: Request) {
  if (!emailConfigured()) {
    // Sin proveedor de correo no hay nada que enviar; no es un error de flujo.
    return NextResponse.json({ sent: 0, reason: "email_off" });
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    p1Name?: string;
    p2Name?: string;
    p1Email?: string | null;
    p2Email?: string | null;
    category?: string | null;
    gender?: string | null;
    method?: SignupPaymentMethod;
  };

  const code = (body.code ?? "").trim().toUpperCase();
  const p1Name = (body.p1Name ?? "").trim();
  const p2Name = (body.p2Name ?? "").trim();
  const method: SignupPaymentMethod = body.method === "club" ? "club" : "free";
  if (!code || !p1Name || !p2Name) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const recipients = [body.p1Email, body.p2Email]
    .map((e) => (e ?? "").trim())
    .filter((e) => /.+@.+\..+/.test(e));
  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no_recipients" });
  }

  // Nombre y cuota REALES del torneo por código (acota el uso a torneos que
  // existen; no se confía en el cliente para el importe).
  const admin = supabaseAdmin();
  const { data: t } = await admin
    .from("tournaments")
    .select("name, entry_fee")
    .eq("signup_code", code)
    .maybeSingle();
  if (!t) {
    return NextResponse.json({ error: "Código no válido." }, { status: 404 });
  }

  const entryFee = Number(t.entry_fee ?? 0);
  // Cuota por persona → total = 2×. Solo relevante en "pagar en el club".
  const amountEur = method === "club" && entryFee > 0 ? entryFee * 2 : null;

  const base = {
    tournamentName: t.name ?? "el torneo",
    p1Name,
    p2Name,
    category: body.category ?? null,
    gender: body.gender ?? null,
    method,
    amountEur,
  };

  const results = await Promise.all(
    recipients.map((to) =>
      sendSignupConfirmationEmail({ ...base, to }).catch(() => ({ ok: false })),
    ),
  );
  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent });
}
