"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/lib/session";
import { Btn, Card, Chip, IconTile, PageHeader } from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconBuilding, IconCheckCircle, IconCreditCard } from "@/components/Icon";

type ConnectStatus = "none" | "onboarding" | "restricted" | "active";

const LABEL: Record<ConnectStatus, { text: string; tone: "mute" | "warning" | "accent" }> = {
  none: { text: "Sin conectar", tone: "mute" },
  onboarding: { text: "Alta pendiente", tone: "warning" },
  restricted: { text: "Faltan datos", tone: "warning" },
  active: { text: "Conectado · listo para cobrar", tone: "accent" },
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
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="Sin club activo"
            body="Necesitas gestionar un club para configurar los cobros."
          />
        </Card>
      </div>
    );
  }
  if (loading || status === null) return <SkeletonPage />;

  const active = status === "active";
  const l = LABEL[status];

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Cobrar inscripciones"
        lede="Conecta tu club con Stripe para cobrar online las inscripciones de tus torneos. El dinero va a tu cuenta: TACTIUM no cobra comisión y solo se descuenta el coste de la pasarela (2 % + 0,25 € por cobro)."
        actions={
          !active ? (
            <Btn variant="accent" onClick={connect} disabled={busy}>
              {busy
                ? "Abriendo…"
                : status === "none"
                  ? "Conectar con Stripe"
                  : "Continuar alta"}
            </Btn>
          ) : undefined
        }
      />

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <IconTile mute={!active}>
            {active ? <IconCheckCircle size={17} /> : <IconCreditCard size={17} />}
          </IconTile>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Stripe Connect</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
              Cuenta de cobros del club
            </div>
          </div>
          <Chip tone={l.tone}>{l.text}</Chip>
        </div>

        <div className="divider" />

        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
          {active
            ? "Ya puedes poner cuota de inscripción a tus torneos y cobrarla online. Stripe ingresa el dinero en tu cuenta bancaria automáticamente."
            : "El alta la gestiona Stripe (te pedirá tus datos y una cuenta bancaria). Cuando termines, vuelve aquí; el estado se actualiza solo."}
        </p>
      </Card>

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
