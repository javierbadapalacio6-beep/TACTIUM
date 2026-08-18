"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/lib/session";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import { IconBuilding, IconCheckCircle, IconCreditCard } from "@/components/Icon";

type ConnectStatus = "none" | "onboarding" | "restricted" | "active";

const LABEL: Record<ConnectStatus, { text: string; tone: string }> = {
  none: { text: "Sin conectar", tone: "var(--text-faint)" },
  onboarding: { text: "Alta pendiente", tone: "var(--warning)" },
  restricted: { text: "Faltan datos", tone: "var(--warning)" },
  active: { text: "Conectado · listo para cobrar", tone: "var(--accent)" },
};

/**
 * Cobros del club (Stripe Connect Express). Conecta la cuenta del club para
 * cobrar inscripciones de torneo online (la pareja paga al club; TACTIUM se
 * queda un 3%). Ver TACTIUM/docs/plan-inscripciones-connect.md.
 */
export function ClubCobros() {
  const { clubId } = useSession();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/connect/status?clubId=${clubId}`);
      const d = (await r.json().catch(() => ({}))) as { status?: ConnectStatus };
      setStatus(d.status ?? "none");
    } catch {
      setStatus("none");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    refresh();
    // Al volver del alta de Stripe (?connect=done) refresca el estado.
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("connect")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
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

  if (!clubId) {
    return (
      <Card>
        <EmptyState
          icon={<IconBuilding size={34} />}
          title="Sin club activo"
          body="Necesitas gestionar un club para configurar los cobros."
        />
      </Card>
    );
  }
  if (loading || status === null) return <SkeletonCard />;

  const active = status === "active";
  const l = LABEL[status];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>CLUB · COBROS</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Cobrar inscripciones</h1>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
          Conecta tu club con Stripe para cobrar online las inscripciones de tus
          torneos. El dinero va a tu cuenta; TACTIUM se queda un 3 % por
          inscripción.
        </p>
      </div>

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "var(--primary-dim)",
              color: active ? "var(--accent)" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            {active ? <IconCheckCircle size={22} /> : <IconCreditCard size={22} />}
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Stripe Connect</div>
            <div
              className="mono"
              style={{
                marginTop: 4,
                fontSize: 11,
                letterSpacing: "0.12em",
                color: l.tone,
                textTransform: "uppercase",
              }}
            >
              {l.text}
            </div>
          </div>
          {!active && (
            <button
              type="button"
              className="btn btn-accent"
              onClick={connect}
              disabled={busy}
              style={{ padding: "12px 22px", fontSize: 13.5 }}
            >
              {busy
                ? "Abriendo…"
                : status === "none"
                  ? "Conectar con Stripe"
                  : "Continuar alta"}
            </button>
          )}
        </div>

        {active ? (
          <p
            style={{
              marginTop: 18,
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Ya puedes poner cuota de inscripción a tus torneos y cobrarla online.
            Stripe ingresa el dinero en tu cuenta bancaria automáticamente.
          </p>
        ) : (
          <p
            style={{
              marginTop: 18,
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            El alta la gestiona Stripe (te pedirá tus datos y una cuenta bancaria).
            Cuando termines, vuelve aquí; el estado se actualiza solo.
          </p>
        )}
      </Card>

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
