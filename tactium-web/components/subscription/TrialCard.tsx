"use client";

import type { ReactNode } from "react";

import { fetchTrialSubscription } from "@/lib/queries";
import { ALL_PLANS, TRIAL_DURATION_DAYS, formatEur } from "@/lib/plans";
import { useAsync } from "@/lib/use-async";
import { BtnLink, Card, Chip, Eyebrow } from "@/components/ui";
import { IconSparkles } from "@/components/Icon";

/**
 * «Prueba gratis · quedan N días», explicada.
 *
 * Solo aparece mientras el pagador (el capitán para su equipo independiente,
 * el club para el club) tiene la prueba de BD en curso: `trialing` con
 * `product_id` `trial_*`, la que arranca el alta sin tarjeta. Una prueba de
 * tienda o de Stripe ya tiene su propia pantalla de suscripción.
 *
 * El importe que se factura es lo más visible de la línea de tiempo (misma
 * regla que el paywall de la app, Apple 3.1.2c).
 */
export function TrialCard({
  subjectType,
  subjectId,
}: {
  subjectType: "user" | "club";
  subjectId: string | null | undefined;
}) {
  const { data } = useAsync(
    () => fetchTrialSubscription(subjectType, subjectId!),
    [subjectType, subjectId],
    !!subjectId,
  );
  if (!data) return null;

  const end = new Date(data.currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return null;
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const plan =
    ALL_PLANS.find((p) => p.tier === data.planTier) ??
    (subjectType === "club" ? ALL_PLANS.find((p) => p.tier === "club_starter") : ALL_PLANS[0]);
  const billed = plan ? `${formatEur(plan.priceMonthlyEur)}/mes` : null;

  const steps: { when: string; what: ReactNode; on?: boolean }[] = [
    { when: "Hoy", what: "Todo desbloqueado", on: true },
    { when: "Día 12", what: "Te avisamos" },
    {
      when: `Día ${TRIAL_DURATION_DAYS}`,
      what: (
        <>
          {billed && (
            <span className="mono" style={{ display: "block", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {billed}
            </span>
          )}
          <span>cancela cuando quieras</span>
        </>
      ),
    },
  ];

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <span className="tile-icon">
          <IconSparkles size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Eyebrow tone="accent">
              Prueba gratis · quedan {daysLeft} {daysLeft === 1 ? "día" : "días"}
            </Eyebrow>
            {plan && (
              <Chip tone="mute" plain>
                {plan.displayName}
              </Chip>
            )}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Montar el equipo e invitar es gratis. La gestión (jornadas, alineaciones,
            escáner, recordatorios) es premium.
          </p>
        </div>
        <BtnLink href="/pro" variant="accent">
          Elegir plan
        </BtnLink>
      </div>

      <ol
        aria-label="Línea de tiempo de la prueba"
        style={{
          listStyle: "none",
          margin: "16px 0 0",
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {steps.map((s) => (
          <li
            key={s.when}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: s.on ? "var(--accent-10)" : "var(--bg-card-2)",
              border: `1px solid ${s.on ? "var(--accent-40)" : "var(--line)"}`,
              minWidth: 0,
            }}
          >
            <Eyebrow>{s.when}</Eyebrow>
            <span style={{ display: "block", marginTop: 4, fontSize: 12.5, color: "var(--text-muted)" }}>
              {s.what}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
