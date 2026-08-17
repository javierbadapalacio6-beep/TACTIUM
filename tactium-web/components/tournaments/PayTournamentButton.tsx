"use client";

import { useState } from "react";

/**
 * Botón de pago del torneo (organizador, web).
 *
 * Llama al checkout de servidor `/api/tournaments/:id/checkout`. La web NO es la
 * app de iOS, así que puede mostrar el enlace de pago directo (no aplica la
 * restricción 3.1.1a de Apple). El servidor calcula el importe y decide:
 *   · { url }        → hay algo que cobrar → se redirige a Stripe.
 *   · { paid:true }  → cubierto por el plan / gratis / ya pagado → publicado.
 *   · { error }      → se muestra el motivo.
 *
 * Escribe con service_role en el servidor, así que funciona aunque la web esté
 * en modo solo-lectura (`NEXT_PUBLIC_TACTIUM_WRITES=off`).
 */
export function PayTournamentButton({ tournamentId }: { tournamentId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        paid?: boolean;
        reason?: string;
        error?: string;
      };
      if (res.ok && data.url) {
        window.location.href = data.url; // → Stripe Checkout
        return;
      }
      if (res.ok && data.paid) {
        setMsg(
          data.reason === "included"
            ? "Incluido en tu plan · torneo publicado."
            : data.reason === "free"
              ? "Gratis · torneo publicado."
              : "Ya estaba pagado.",
        );
      } else {
        setMsg(data.error ?? "No se pudo iniciar el pago.");
      }
    } catch {
      setMsg("No se pudo conectar con la pasarela de pago.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-accent"
        onClick={pay}
        disabled={busy}
        style={{ padding: "11px 18px", fontSize: 13 }}
      >
        {busy ? "Abriendo pago…" : "Pagar / publicar torneo"}
      </button>
      {msg && (
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textWrap: "pretty",
            maxWidth: 240,
          }}
        >
          {msg}
        </span>
      )}
    </>
  );
}
