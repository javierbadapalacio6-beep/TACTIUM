import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendSignupConfirmationEmail } from "@/lib/email";
import { webAppOrigin } from "@/lib/connect";

// POST /api/tournaments/webhook
// Webhook de Stripe. Al confirmarse el pago (checkout.session.completed) marca
// el pago como 'paid' y el torneo como 'paid' (listo para publicar). Es la
// FUENTE DE VERDAD del cobro: la app no debe fiarse del success_url.
//
// Configura el endpoint en Stripe apuntando a esta URL y pon el secreto en
// STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Sin firma" }, { status: 400 });
  }

  const body = await req.text(); // cuerpo CRUDO para verificar la firma
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Firma inválida: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = supabaseAdmin();
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    // ── Pago de INSCRIPCIÓN (Connect) ──────────────────────────────────────
    // Al confirmarse, se crea la inscripción con la ficha guardada (la RPC
    // valida elegibilidad). No se creaba antes para no dejar filas a medias.
    if (session.metadata?.kind === "signup") {
      const { data: sp } = await admin
        .from("tournament_signup_payments")
        .select("id, signup_payload, status")
        .eq("stripe_session_id", session.id)
        .maybeSingle();
      if (sp && sp.status !== "paid") {
        interface PayReg {
          category: string | null;
          gender: string | null;
          p1Name: string;
          p2Name: string;
          p1Email?: string | null;
          p1Phone?: string | null;
          p2Email?: string | null;
          seedPoints: number | null;
          leagueSum: number | null;
          availability: string[];
          // Aceptó las condiciones en el formulario, antes de pagar.
          termsAccepted?: boolean;
        }
        const p = sp.signup_payload as {
          code: string;
          tournamentName?: string | null;
          p1UserId?: string | null;
          regs?: PayReg[];
          // Formato antiguo (una sola categoría):
          p1Name?: string;
          p2Name?: string;
          p1Email?: string | null;
          p1Phone?: string | null;
          p2Email?: string | null;
          category?: string | null;
          gender?: string | null;
          seedPoints?: number | null;
          leagueSum?: number | null;
          availability?: string[];
        };

        // Normaliza a lista de inscripciones (compat con el payload antiguo).
        const regs: PayReg[] =
          Array.isArray(p.regs) && p.regs.length > 0
            ? p.regs
            : [
                {
                  category: p.category ?? null,
                  gender: p.gender ?? null,
                  p1Name: p.p1Name ?? "",
                  p2Name: p.p2Name ?? "",
                  p1Email: p.p1Email ?? null,
                  p1Phone: p.p1Phone ?? null,
                  p2Email: p.p2Email ?? null,
                  seedPoints: p.seedPoints ?? null,
                  leagueSum: p.leagueSum ?? null,
                  availability: p.availability ?? [],
                },
              ];

        // Crea una inscripción por categoría (la RPC valida elegibilidad) y
        // recupera el código de compañero de cada una (para el email de P2).
        const regIds: string[] = [];
        const enriched: { reg: PayReg; partnerCode: string | null }[] = [];
        // Inscripciones que el servidor rechazó DESPUÉS de cobrar (división
        // completa, ya inscrito, elegibilidad…). Si hay alguna, se devuelve
        // el pago entero y no se deja nada a medias.
        const failures: { category: string | null; message: string }[] = [];
        for (const r of regs) {
          if (!r.p1Name || !r.p2Name) {
            failures.push({ category: r.category, message: "Faltan los nombres de la pareja" });
            continue;
          }
          const { data: regId, error: regErr } = await admin.rpc("tournament_signup_paid", {
            p_code: p.code,
            p1_name: r.p1Name,
            p1_email: r.p1Email ?? null,
            p1_phone: r.p1Phone ?? null,
            p2_name: r.p2Name,
            p2_email: r.p2Email ?? null,
            p2_phone: null,
            p_availability: r.availability ?? [],
            p_category: r.category ?? null,
            p_gender: r.gender ?? null,
            p_seed_points: r.seedPoints ?? null,
            p_league_sum: r.leagueSum ?? null,
            // Pagos creados ANTES de esta versión no traen el flag: la
            // aceptación se dio igualmente en el formulario, no se les bloquea.
            p_terms_accepted: r.termsAccepted !== false,
          });
          const rid = typeof regId === "string" ? regId : null;
          if (regErr || !rid) {
            failures.push({
              category: r.category,
              message: regErr?.message ?? "No se pudo crear la inscripción",
            });
            continue;
          }
          if (rid) {
            regIds.push(rid);
            await admin
              .from("tournament_registrations")
              .update({
                payment_status: "paid",
                payment_method: "stripe",
                // Liga la inscripción a la cuenta del que pagó (login web).
                ...(p.p1UserId ? { p1_user_id: p.p1UserId } : {}),
              })
              .eq("id", rid);
            const { data: rc } = await admin
              .from("tournament_registrations")
              .select("partner_code")
              .eq("id", rid)
              .maybeSingle();
            enriched.push({
              reg: r,
              partnerCode:
                (rc as { partner_code?: string | null } | null)?.partner_code ??
                null,
            });
          }
        }

        if (failures.length > 0) {
          // 1) Deshace las inscripciones que sí se crearon con este pago.
          if (regIds.length > 0) {
            await admin.from("tournament_registrations").delete().in("id", regIds);
          }
          // 2) Devuelve el dinero: también la parte del club (reverse_transfer)
          //    y nuestra comisión (refund_application_fee).
          let refunded = false;
          if (paymentIntent) {
            try {
              await stripe.refunds.create({
                payment_intent: paymentIntent,
                reverse_transfer: true,
                refund_application_fee: true,
                metadata: { reason: "signup_rejected", signup_payment_id: sp.id },
              });
              refunded = true;
            } catch (e) {
              console.error("[webhook] refund failed", sp.id, e);
            }
          }
          const why = failures
            .map((f) => (f.category ? `${f.category}: ${f.message}` : f.message))
            .join(" · ");
          await admin
            .from("tournament_signup_payments")
            .update({
              // refund_failed = revisar a mano en Stripe (dinero cobrado sin inscripción).
              status: refunded ? "refunded" : "refund_failed",
              stripe_payment_intent: paymentIntent,
              registration_id: null,
              signup_payload: { ...p, failure: why },
            })
            .eq("id", sp.id);
          if (p.p1UserId) {
            await admin.from("notifications").insert({
              user_id: p.p1UserId,
              type: "tournament_signup",
              title: refunded
                ? "Inscripción no completada · te devolvemos el pago"
                : "Inscripción no completada",
              body: refunded
                ? `${p.tournamentName ?? "El torneo"}: ${why}. Hemos devuelto el importe; puede tardar unos días en verse.`
                : `${p.tournamentName ?? "El torneo"}: ${why}. Vamos a devolverte el importe; si no lo ves en unos días, escríbenos.`,
              data: { type: "tournament_signup", signupPaymentId: sp.id },
            });
          }
          return NextResponse.json({ received: true, refunded });
        }

        await admin
          .from("tournament_signup_payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent: paymentIntent,
            registration_id: regIds[0] ?? null,
          })
          .eq("id", sp.id);

        // Confirmación por email por inscripción (best-effort). A P1 se le manda
        // el código para COMPARTIR; a P2, el código para VINCULARSE + enlace a
        // Mis torneos.
        const tName = p.tournamentName ?? "el torneo";
        const claimUrl = `${webAppOrigin(req)}/torneos/mios`;
        await Promise.all(
          enriched.flatMap(({ reg: r, partnerCode }) => {
            const base = {
              tournamentName: tName,
              p1Name: r.p1Name,
              p2Name: r.p2Name,
              category: r.category,
              gender: r.gender,
              method: "stripe" as const,
              amountEur: null,
              partnerCode,
              claimUrl,
            };
            const jobs: Promise<unknown>[] = [];
            if (r.p1Email)
              jobs.push(
                sendSignupConfirmationEmail({
                  ...base,
                  to: r.p1Email,
                  recipientRole: "p1",
                }).catch(() => null),
              );
            if (r.p2Email)
              jobs.push(
                sendSignupConfirmationEmail({
                  ...base,
                  to: r.p2Email,
                  recipientRole: "p2",
                }).catch(() => null),
              );
            return jobs;
          }),
        );
      }
      return NextResponse.json({ received: true });
    }

    // Marca el pago como pagado y recupera qué tamaño cubre.
    const { data: payment } = await admin
      .from("tournament_payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: paymentIntent,
      })
      .eq("stripe_session_id", session.id)
      .select("tournament_id, covers_pairs")
      .maybeSingle();

    // Desbloquea el torneo: queda pagado, se anota la cobertura y, si estaba
    // retenido en borrador por el pago, se PUBLICA (pasa a inscripción abierta).
    const tournamentId = payment?.tournament_id ?? session.metadata?.tournament_id;
    if (tournamentId) {
      const { data: t } = await admin
        .from("tournaments")
        .select("status, covered_pairs")
        .eq("id", tournamentId)
        .maybeSingle();

      // Si estaba retenido en borrador por el pago, al publicar hay que darle el
      // estado REAL: un torneo puede pagarse DESPUES de haberse jugado (o estando
      // en curso). Si ya tiene partidos y ninguno queda pendiente -> 'finished';
      // si tiene partidos pero aun hay pendientes -> 'in_progress'; si no tiene
      // partidos aun (lo normal al crearlo) -> 'open' (inscripcion abierta).
      let publishStatus: string | null = null;
      if (t?.status === "draft") {
        const { data: ms } = await admin
          .from("tournament_matches")
          .select("status")
          .eq("tournament_id", tournamentId);
        const matches = ms ?? [];
        if (matches.length === 0) {
          publishStatus = "open";
        } else if (matches.every((m) => m.status !== "pending")) {
          publishStatus = "finished";
        } else {
          publishStatus = "in_progress";
        }
      }

      await admin
        .from("tournaments")
        .update({
          billing_status: "paid",
          covered_pairs: Math.max(
            payment?.covers_pairs ?? 0,
            t?.covered_pairs ?? 0,
          ),
          ...(publishStatus ? { status: publishStatus } : {}),
        })
        .eq("id", tournamentId);
    }
  }

  return NextResponse.json({ received: true });
}
