"use client";

import Link from "next/link";

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
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import { SkeletonCard } from "@/components/states";
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
  trialing: "EN PRUEBA",
  active: "ACTIVA",
  grace_period: "PAGO PENDIENTE",
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
      state: "SIN PLAN",
      price: "0 €",
      period: "/MES",
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
    state: STATE_LABEL[row.status] ?? row.status.toUpperCase(),
    price: plan
      ? formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)
      : "—",
    period: yearly ? "/AÑO" : "/MES",
    renewNote:
      row.status === "trialing"
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

  const storeManaged = isStoreManaged(sub.source);
  const webManaged = sub.source === "stripe";
  const noPlan = sub.source === "none";

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <PageHeader
        eyebrow="CUENTA · MI SUSCRIPCIÓN"
        title="Mi suscripción"
        lede="Tu plan, de dónde viene y qué puedes hacer con él desde aquí."
      />

      {loading && <SkeletonCard />}
      {error && (
        <Card style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
            No se ha podido leer tu suscripción: {error}
          </p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Eyebrow>MI SUSCRIPCIÓN</Eyebrow>

        {/* Cambio de plan diferido: Apple/Google aplican los downgrades al
            final del ciclo, así que se anuncia de forma persistente. */}
        {sub.scheduledPlan && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 20px",
              borderRadius: 12,
              background: "var(--accent-10)",
              border: "1px solid var(--accent-25)",
              color: "var(--accent)",
            }}
          >
            <IconClock size={17} />
            <span style={{ fontSize: 13.5 }}>
              Pasarás a{" "}
              <strong style={{ fontWeight: 700 }}>
                {sub.scheduledPlan.name}
              </strong>{" "}
              el{" "}
              <span
                className="mono"
                style={{ letterSpacing: "0.06em" }}
              >
                {sub.scheduledPlan.date}
              </span>
            </span>
          </div>
        )}

        <Card
          style={{
            border: `1.5px solid ${
              storeManaged ? "var(--hair-strong)" : "transparent"
            }`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ fontSize: 30 }}>{sub.planName}</h2>
                <span className={"chip" + (noPlan ? " chip-mute" : "")}>
                  {sub.state}
                </span>
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 38,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  {sub.price}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.16em",
                    color: "var(--text-faint)",
                  }}
                >
                  {sub.period}
                </span>
              </div>

              <div
                className="mono"
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                }}
              >
                {sub.renewNote}
              </div>
            </div>

            <span className="chip chip-mute" style={{ flex: "none" }}>
              {sourceLabel(sub.source)}
            </span>
          </div>

          {/* CASO C · solo lectura. Ni un botón de compra. */}
          {storeManaged && (
            <>
              <div
                style={{
                  marginTop: 24,
                  padding: "18px 20px",
                  borderRadius: 12,
                  background: "var(--bg-card-2)",
                  border: "1px solid var(--hair-strong)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color: "var(--text-muted)",
                    display: "flex",
                    flex: "none",
                  }}
                >
                  <IconLock size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 200 }}>
                  <span
                    style={{ display: "block", fontSize: 14, fontWeight: 700 }}
                  >
                    Gestionas tu plan desde {storeName(sub.source)}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 5,
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                    }}
                  >
                    Aquí solo puedes consultarla · el cobro y la cancelación se
                    gestionan en la tienda.
                  </span>
                </span>
                <Link
                  href="/ayuda/suscripcion-tienda"
                  style={{ fontSize: 12.5, flex: "none" }}
                >
                  Cómo gestionarla →
                </Link>
              </div>

              {sub.willNotRenew && (
                <div
                  className="mono"
                  style={{
                    marginTop: 12,
                    fontSize: 10.5,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--warning)",
                  }}
                >
                  No se renovará al expirar
                </div>
              )}
            </>
          )}

          {/* CASO B · comprada en la web: aquí sí se gestiona. */}
          {webManaged && (
            <div
              style={{
                marginTop: 24,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/pro"
                className="btn btn-accent"
                style={{ padding: "12px 20px", fontSize: 13.5 }}
              >
                Cambiar plan
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "12px 20px", fontSize: 13.5 }}
              >
                Canjear código
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-danger-ghost"
                style={{ padding: "12px 20px", fontSize: 13.5 }}
              >
                Cancelar suscripción
              </button>
            </div>
          )}

          {/* CASO A · sin plan: es el único caso que puede contratar. */}
          {noPlan && (
            <div
              style={{
                marginTop: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/pro"
                className="btn btn-accent"
                style={{ padding: "14px 24px", fontSize: 14.5 }}
              >
                Hazte Pro · Prueba 14 días
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "14px 22px", fontSize: 14 }}
              >
                Canjear código
              </button>
            </div>
          )}
        </Card>

        {/* Los otros estados que puede devolver el webhook. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {[
            { label: "EN PRUEBA", color: "var(--text-faint)" },
            { label: "PAGO PENDIENTE", color: "var(--warning)" },
            { label: "CANCELADA · EXPIRADA", color: "var(--error)" },
          ].map((s) => (
            <div
              key={s.label}
              className="mono"
              style={{
                padding: "16px 18px",
                borderRadius: 12,
                border: "1px solid var(--hair-strong)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: s.color,
                textAlign: "center",
              }}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
