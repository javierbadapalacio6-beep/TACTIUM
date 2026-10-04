"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useSession } from "@/lib/session";
import { GATEWAY_FEE_LABEL } from "@/lib/club-ops";
import { Btn, Card, CardHead, Chip } from "@/components/ui";
import { SkeletonPage, Toast } from "@/components/states";

type ConnectStatus = "none" | "onboarding" | "restricted" | "active";

/** Los cuatro estados que devuelve /api/connect/status, cada uno con su botón. */
const STATE: Record<
  ConnectStatus,
  { text: string; tone: "mute" | "warning" | "accent"; body: string; cta: string | null }
> = {
  none: {
    text: "Sin conectar",
    tone: "mute",
    body: "Conecta Stripe y el dinero de las inscripciones va directo a la cuenta del club. También puedes cobrar en el club.",
    cta: "Conectar con Stripe",
  },
  onboarding: {
    text: "Alta pendiente",
    tone: "warning",
    body: "Empezaste el alta en Stripe y falta terminarla. Hasta entonces, las inscripciones con pago online no se pueden abrir.",
    cta: "Continuar alta",
  },
  restricted: {
    text: "Faltan datos",
    tone: "warning",
    body: "Stripe necesita algún dato más (por ejemplo, tu IBAN) para poder ingresarte lo cobrado. Hasta entonces, las inscripciones con pago online no se pueden abrir.",
    cta: "Completar en Stripe",
  },
  active: {
    text: "Listo para cobrar",
    tone: "accent",
    body: "Ya puedes poner cuota a tus torneos y cobrarla online. Stripe ingresa el dinero en la cuenta del club automáticamente.",
    cta: null,
  },
};

/**
 * Tarjeta «Cobro de inscripciones» (Stripe Connect Express) con el estado REAL.
 * Vive dentro de «Cobros y facturación». El texto de la comisión sale de las
 * constantes de `lib/connect.ts`: TACTIUM no se queda nada; lo que se retiene
 * es el coste de la pasarela.
 */
export function CobrosCard() {
  const { clubId } = useSession();
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clubId) return;
    try {
      const r = await fetch(`/api/connect/status?clubId=${clubId}`);
      const d = (await r.json().catch(() => ({}))) as { status?: ConnectStatus };
      setStatus(r.ok ? (d.status ?? "none") : null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
    // Al volver del alta de Stripe (?connect=done) se limpia la URL.
    const q = new URLSearchParams(window.location.search);
    if (q.get("connect")) window.history.replaceState({}, "", window.location.pathname + "#cobros");
    // Y al volver a la pestaña, el estado se actualiza solo.
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  async function connect() {
    if (busy || !clubId) return;
    setBusy(true);
    try {
      const r = await fetch("/api/connect/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId }),
      });
      const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (r.ok && d.url) {
        window.location.href = d.url; // → alta hospedada por Stripe
        return;
      }
      setToast(d.error ?? "No se pudo iniciar la conexión con Stripe.");
    } catch {
      setToast("No se pudo conectar con Stripe.");
    } finally {
      setBusy(false);
    }
  }

  const s = status ? STATE[status] : null;

  return (
    <Card flush style={{ scrollMarginTop: 80 }}>
      <div id="cobros" />
      <CardHead title="Cobro de inscripciones" sub="Stripe · cuenta del club">
        <AnimatePresence mode="wait" initial={false}>
          {s && (
            <motion.span
              key={status}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Chip tone={s.tone}>{s.text}</Chip>
            </motion.span>
          )}
        </AnimatePresence>
      </CardHead>
      <div style={{ padding: "0 18px 18px" }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
          {loading
            ? "Consultando el estado en Stripe…"
            : s
              ? s.body
              : "No se pudo consultar el estado de Stripe ahora mismo. Vuelve a intentarlo en un rato."}
        </p>
        <div className="divider" />
        <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>Comisión de TACTIUM</span>
            <span className="mono">0 €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>Coste de la pasarela</span>
            <span className="mono">{GATEWAY_FEE_LABEL}</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Por cada inscripción cobrada online. Lo cobra Stripe, no TACTIUM.
          </span>
        </div>
        {s?.cta && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn variant="accent" onClick={() => void connect()} disabled={busy}>
              {busy ? "Abriendo…" : `${s.cta} ↗`}
            </Btn>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
              Se abre la página segura de Stripe. Al volver, el estado se actualiza solo.
            </span>
          </div>
        )}
      </div>
      {toast && <Toast tone="error" title={toast} onClose={() => setToast(null)} />}
    </Card>
  );
}

/** /club/cobros ya no es una página aparte: lleva a la tarjeta de cobros. */
export function ClubCobros() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/club/facturacion${window.location.search}#cobros`);
  }, [router]);
  return <SkeletonPage />;
}
