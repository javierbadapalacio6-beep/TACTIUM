import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  emailConfigured,
  sendSignupConfirmationEmail,
  type SignupPaymentMethod,
} from "@/lib/email";
import { priceSignup } from "@/lib/tournament-signup-pricing";

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

  interface ConfirmReg {
    p1Name?: string;
    p2Name?: string;
    p1Email?: string | null;
    p2Email?: string | null;
    category?: string | null;
    gender?: string | null;
  }
  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    method?: SignupPaymentMethod;
    regs?: ConfirmReg[];
  };

  const code = (body.code ?? "").trim().toUpperCase();
  const method: SignupPaymentMethod = body.method === "club" ? "club" : "free";
  const regs = (body.regs ?? []).filter(
    (r) => r && (r.p1Name ?? "").trim() && (r.p2Name ?? "").trim(),
  );
  if (!code || regs.length === 0) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  // Nombre y cuota REALES del torneo por código (acota el uso a torneos que
  // existen; no se confía en el cliente para el importe).
  const admin = supabaseAdmin();
  const { data: t } = await admin
    .from("tournaments")
    .select("name, entry_fee, entry_fee_2")
    .eq("signup_code", code)
    .maybeSingle();
  if (!t) {
    return NextResponse.json({ error: "Código no válido." }, { status: 404 });
  }

  // Importe total (solo relevante en "pagar en el club"): mismo cálculo por
  // persona que el cobro online.
  const entryFee = Number(t.entry_fee ?? 0);
  const amountEur =
    method === "club" && entryFee > 0
      ? priceSignup(
          regs.map((r) => ({
            category: r.category ?? null,
            p1Name: (r.p1Name ?? "").trim(),
            p2Name: (r.p2Name ?? "").trim(),
          })),
          entryFee,
          t.entry_fee_2 != null ? Number(t.entry_fee_2) : null,
        ).totalCents / 100
      : null;

  const tName = t.name ?? "el torneo";
  const jobs = regs.flatMap((r) =>
    [r.p1Email, r.p2Email]
      .map((e) => (e ?? "").trim())
      .filter((e) => /.+@.+\..+/.test(e))
      .map((to) =>
        sendSignupConfirmationEmail({
          to,
          tournamentName: tName,
          p1Name: (r.p1Name ?? "").trim(),
          p2Name: (r.p2Name ?? "").trim(),
          category: r.category ?? null,
          gender: r.gender ?? null,
          method,
          amountEur,
        }).catch(() => ({ ok: false })),
      ),
  );
  if (jobs.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no_recipients" });
  }
  const results = await Promise.all(jobs);
  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent });
}
