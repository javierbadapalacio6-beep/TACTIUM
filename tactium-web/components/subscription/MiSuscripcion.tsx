"use client";

import Link from "next/link";
import { useState } from "react";

import {
  isStoreManaged,
  sourceLabel,
  storeName,
  type Subscription,
  type SubscriptionSource,
} from "@/lib/account-data";
import { fetchSubscription, type DbSubscription } from "@/lib/queries";
import { ALL_PLANS, formatEur } from "@/lib/plans";
import { useAsync } from "@/lib/use-async";
import { Btn, BtnLink, Card, Chip, Note, PageHeader } from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import { IconClock, IconLock } from "@/components/Icon";

/**
 * Mi suscripción.
 *
 * ── LA REGLA QUE PROTEGE EL NEGOCIO ────────────────────────────────
 * Una misma cuenta puede tener la suscripción comprada en la web (Stripe) o en
 * una tienda móvil (App Store / Google Play). La web SÓLO puede vender y
 * gestionar lo que es suyo. Con una compra de tienda:
 *   · no se muestra ningún botón de contratar, cambiar plan ni cancelar
 *   · la tarjeta queda en solo lectura con el aviso de dónde se gestiona
 * Saltarse esto es lo que produce suscripciones y cobros duplicados.
 *
 * Los datos son REALES: salen de `subscriptions` vía `fetchSubscription()`.
 * Antes esta pantalla tenía un selector de casos de maqueta con precios
 * inventados (el plan de 10 equipos ponía 29,99 € cuando cobra 24,99 €).
 */

/** De dónde viene la compra, según la plataforma que guardó el webhook. */
function sourceOf(platform: string | null | undefined): SubscriptionSource {
  if (platform === "stripe" || platform === "web") return "stripe";
  if (platform === "ios" || platform === "app_store") return "app_store";
  if (platform === "android" || platform === "play_store") return "play_store";
  return "none";
}

const STATE_LABEL: Record<string, string> = {
  trialing: "En prueba",
  active: "Activa",
  grace_period: "Pago pendiente",
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

/** Traduce la fila de la base de datos a lo que pinta la pantalla. */
function toSubscription(row: DbSubscription | null): Subscription {
  if (!row) {
    return {
      source: "none",
      planName: "Plan gratuito",
      state: "Sin plan",
      price: "0 €",
      period: "al mes",
      renewNote: "Sin renovación · sin cobros",
    };
  }
  const plan = ALL_PLANS.find((p) => p.tier === row.planTier);
  const yearly = row.billingPeriod === "yearly";
  const scheduled = row.scheduledPlanTier
    ? ALL_PLANS.find((p) => p.tier === row.scheduledPlanTier)
    : null;

  return {
    source: sourceOf(row.platform),
    planName: plan?.displayName ?? row.planTier,
    state: STATE_LABEL[row.status] ?? row.status,
    price: plan
      ? formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)
      : "—",
    period: yearly ? "al año" : "al mes",
    // Con la baja programada no hay renovación ni primer cobro: decir lo
    // contrario es prometer un cargo que no va a llegar.
    renewNote: row.cancelAtPeriodEnd
      ? `No se renovará · termina el ${fmtDate(row.currentPeriodEnd)}`
      : row.status === "trialing"
        ? `Primer cobro el ${fmtDate(row.currentPeriodEnd)}`
        : `Próxima renovación · ${fmtDate(row.currentPeriodEnd)}`,
    ...(scheduled
      ? {
          scheduledPlan: {
            name: scheduled.displayName,
            date: fmtDate(row.currentPeriodEnd),
          },
        }
      : null),
  };
}

export function MiSuscripcion() {
  const { data, loading, error } = useAsync(() => fetchSubscription(), []);
  const sub = toSubscription(data);
  const [portalBusy, setPortalBusy] = useState(false);

  // Abre el portal de facturación de Stripe (cancelar, método de pago, facturas).
  async function openPortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await fetch("/api/subscription/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      alert(body.error ?? "No se pudo abrir la gestión de la suscripción.");
    } catch {
      alert("No se pudo conectar con la pasarela de pago.");
    } finally {
      setPortalBusy(false);
    }
  }

  if (loading) return <SkeletonPage />;

  const storeManaged = isStoreManaged(sub.source);
  const webManaged = sub.source === "stripe";
  const noPlan = sub.source === "none";

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Mi suscripción"
        lede="Tu plan, de dónde viene y qué puedes hacer con él desde aquí."
      />

      {error && (
        <Note tone="error" style={{ marginBottom: 16 }}>
          No se ha podido leer tu suscripción: {error}
        </Note>
      )}

      {/* Cambio de plan diferido: Apple/Google aplican los downgrades al
          final del ciclo, así que se anuncia de forma persistente. */}
      {sub.scheduledPlan && (
        <Note tone="accent" icon={<IconClock size={16} />} style={{ marginBottom: 16 }}>
          Pasarás a <strong style={{ fontWeight: 700 }}>{sub.scheduledPlan.name}</strong> el{" "}
          <span className="mono">{sub.scheduledPlan.date}</span>
        </Note>
      )}

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ fontSize: 20 }}>{sub.planName}</h2>
              <Chip tone={noPlan ? "mute" : "accent"}>{sub.state}</Chip>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}
              >
                {sub.price}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {sub.period}
              </span>
            </div>
          </div>

          <Chip tone="mute" plain style={{ flex: "none" }}>
            {sourceLabel(sub.source)}
          </Chip>
        </div>

        <div className="divider" />

        <dl className="kv">
          <dt>Renovación</dt>
          <dd>{sub.renewNote}</dd>
          {sub.scheduledPlan && (
            <>
              <dt>Cambio programado</dt>
              <dd>
                {sub.scheduledPlan.name} · {sub.scheduledPlan.date}
              </dd>
            </>
          )}
          <dt>Se gestiona en</dt>
          <dd>{sourceLabel(sub.source)}</dd>
        </dl>

        {/* CASO C · solo lectura. Ni un botón de compra. */}
        {storeManaged && (
          <>
            <Note icon={<IconLock size={16} />} style={{ marginTop: 18 }}>
              <span style={{ display: "block", fontWeight: 700, color: "var(--text)" }}>
                Gestionas tu plan desde {storeName(sub.source)}
              </span>
              <span style={{ display: "block", marginTop: 4 }}>
                Aquí solo puedes consultarla · el cobro y la cancelación se gestionan en
                la tienda.{" "}
                <Link href="/ayuda/suscripcion-tienda">Cómo gestionarla</Link>
              </span>
            </Note>

            {sub.willNotRenew && (
              <Note tone="warning" style={{ marginTop: 10 }}>
                No se renovará al expirar.
              </Note>
            )}
          </>
        )}

        {/* CASO B · comprada en la web: aquí sí se gestiona. */}
        {webManaged && (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <BtnLink href="/pro" variant="accent">
              Cambiar plan
            </BtnLink>
            <Btn>Canjear código</Btn>
            <div style={{ flex: 1 }} />
            <Btn variant="danger-ghost" onClick={openPortal} disabled={portalBusy}>
              {portalBusy ? "Abriendo…" : "Cancelar suscripción"}
            </Btn>
          </div>
        )}

        {/* CASO A · sin plan: es el único caso que puede contratar. */}
        {noPlan && (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <BtnLink href="/pro" variant="accent">
              Hazte Pro · Prueba 14 días
            </BtnLink>
            <Btn>Canjear código</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
