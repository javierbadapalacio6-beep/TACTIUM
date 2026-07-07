"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { TiltCard } from "@/app/app/TiltCard";
import { Reveal } from "@/app/app/ui/Reveal";

// ── Planes (replicados de TACTIUM/src/core/subscriptions/plans.ts) ───────────
// Apple/Google son la fuente de verdad legal del precio cobrado; esto es solo
// display. Mantener sincronizado con plans.ts de la app móvil.
interface PlanDescriptor {
  tier: PlanTier;
  priceMonthlyEur: number;
  priceYearlyEur: number;
  displayName: string;
  teamQuota: number;
  shortLabel: string;
  blurb: string;
}

const CAPTAIN_PLAN: PlanDescriptor = {
  tier: "captain",
  priceMonthlyEur: 4.99,
  priceYearlyEur: 47.99,
  displayName: "Capitán",
  teamQuota: 1,
  shortLabel: "Capitán",
  blurb: "Para capitanes independientes con un solo equipo.",
};
const CLUB_STARTER_PLAN: PlanDescriptor = {
  tier: "club_starter",
  priceMonthlyEur: 11.99,
  priceYearlyEur: 115.99,
  displayName: "Club Starter",
  teamQuota: 3,
  shortLabel: "Starter",
  blurb: "Para clubes pequeños. Cubre a todos los capitanes incluidos.",
};
const CLUB_PRO_PLAN: PlanDescriptor = {
  tier: "club_pro",
  priceMonthlyEur: 24.99,
  priceYearlyEur: 239.99,
  displayName: "Club Pro",
  teamQuota: 10,
  shortLabel: "Pro",
  blurb: "Para clubes en crecimiento con varios equipos.",
};
const CLUB_ELITE_PLAN: PlanDescriptor = {
  tier: "club_elite",
  priceMonthlyEur: 39.99,
  priceYearlyEur: 384.99,
  displayName: "Club Elite",
  teamQuota: 25,
  shortLabel: "Elite",
  blurb: "Para grandes clubes con plantilla completa.",
};

const CLUB_PLANS: PlanDescriptor[] = [
  CLUB_STARTER_PLAN,
  CLUB_PRO_PLAN,
  CLUB_ELITE_PLAN,
];

const PLAN_BY_TIER: Record<PlanTier, PlanDescriptor> = {
  captain: CAPTAIN_PLAN,
  club_starter: CLUB_STARTER_PLAN,
  club_pro: CLUB_PRO_PLAN,
  club_elite: CLUB_ELITE_PLAN,
};

const TRIAL_DURATION_DAYS = 14;

const PREMIUM_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  "trialing",
  "active",
  "grace_period",
];

function annualDiscountPercent(plan: PlanDescriptor): number {
  const monthlyTotal = plan.priceMonthlyEur * 12;
  if (monthlyTotal <= 0) return 0;
  const saved = monthlyTotal - plan.priceYearlyEur;
  return Math.round((saved / monthlyTotal) * 100);
}

function formatEur(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ── Tipos de DB (cliente sin tipar → casteamos a estas interfaces) ───────────
type PlanTier = "captain" | "club_starter" | "club_pro" | "club_elite";
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "grace_period"
  | "canceled"
  | "expired";
type BillingPeriod = "monthly" | "yearly";
type SubjectType = "user" | "club";

interface Subscription {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  plan_tier: PlanTier;
  billing_period: BillingPeriod;
  status: SubscriptionStatus;
  current_period_end: string;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  scheduled_plan_tier: PlanTier | null;
}

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "En prueba",
  active: "Activa",
  grace_period: "Pago pendiente",
  canceled: "Cancelada",
  expired: "Expirada",
};

const STATUS_TINT: Record<SubscriptionStatus, string> = {
  trialing: "var(--color-accent)",
  active: "var(--color-accent)",
  grace_period: "var(--color-warning)",
  canceled: "var(--color-text-muted)",
  expired: "var(--color-error)",
};

export default function SubscriptionPage() {
  const session = useSession();
  const userId = session.user.id;
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseApp()
      .from("subscriptions")
      .select(
        "id, subject_type, subject_id, plan_tier, billing_period, status, current_period_end, trial_end, cancel_at_period_end, scheduled_plan_tier",
      )
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setSubs((data ?? []) as Subscription[]);
      });
  }, []);

  // Sub del propio user (subject_type='user'). La activa más reciente.
  const mySub = useMemo<Subscription | null>(() => {
    if (!subs) return null;
    return (
      subs
        .filter((s) => s.subject_type === "user" && s.subject_id === userId)
        .sort(
          (a, b) =>
            new Date(b.current_period_end).getTime() -
            new Date(a.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subs, userId]);

  // ¿Hay sub de club que cubra al usuario? (info para "tu club ya paga").
  const clubCovering = useMemo<Subscription | null>(() => {
    if (!subs) return null;
    return (
      subs.find(
        (s) =>
          s.subject_type === "club" && PREMIUM_STATUSES.includes(s.status),
      ) ?? null
    );
  }, [subs]);

  const plan = mySub ? PLAN_BY_TIER[mySub.plan_tier] : null;
  const status = mySub?.status ?? null;
  const trialDays =
    status === "trialing"
      ? daysUntil(mySub?.trial_end ?? mySub?.current_period_end ?? null)
      : null;

  return (
    <div>
      {/* Cabecera */}
      <Reveal className="mb-7">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          MI SUSCRIPCIÓN
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Plan y facturación
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-lg">
          Consulta el estado de tu suscripción TACTIUM Pro. La compra y la
          gestión del cobro se realizan desde la app móvil.
        </p>
      </Reveal>

      {error && (
        <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)] mb-6">
          No se pudo cargar tu suscripción: {error}
        </div>
      )}

      {/* Skeleton */}
      {!subs && !error && (
        <div className="space-y-4">
          <div className="h-40 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse" />
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {subs && (
        <>
          {/* === TARJETA DE ESTADO === */}
          <Reveal>
          <TiltCard className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-40)] mb-4">
            <div className="p-6">
              {mySub && plan && status ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold tracking-tight">
                        {plan.displayName}
                      </h2>
                      <p className="font-mono text-[12px] text-[var(--color-text-muted)] mt-1.5">
                        {mySub.billing_period === "yearly"
                          ? "Plan anual"
                          : "Plan mensual"}
                        {" · "}
                        {mySub.billing_period === "yearly"
                          ? formatEur(plan.priceYearlyEur)
                          : formatEur(plan.priceMonthlyEur)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 font-mono text-[10px] font-bold tracking-[0.12em] rounded-full px-3 py-1 border"
                      style={{
                        color: STATUS_TINT[status],
                        borderColor: `color-mix(in srgb, ${STATUS_TINT[status]} 45%, transparent)`,
                        background: `color-mix(in srgb, ${STATUS_TINT[status]} 10%, transparent)`,
                      }}
                    >
                      {STATUS_LABEL[status].toUpperCase()}
                    </span>
                  </div>

                  <div className="h-px bg-[var(--color-hair)] my-5" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-[var(--color-text-muted)]">
                      {status === "trialing"
                        ? "Prueba termina"
                        : mySub.cancel_at_period_end
                          ? "Termina"
                          : "Próxima renovación"}
                    </span>
                    <span className="font-mono text-[13px] font-semibold">
                      {formatDate(mySub.current_period_end)}
                    </span>
                  </div>

                  {trialDays != null && (
                    <div className="flex items-center justify-between gap-3 mt-3">
                      <span className="text-[13px] text-[var(--color-text-muted)]">
                        Días de prueba restantes
                      </span>
                      <span className="font-mono text-[13px] font-semibold text-[var(--color-accent)]">
                        {trialDays} {trialDays === 1 ? "día" : "días"}
                      </span>
                    </div>
                  )}

                  {mySub.scheduled_plan_tier && (
                    <div className="mt-4 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2.5">
                      <p className="text-[12px] leading-snug text-[var(--color-warning)] font-semibold">
                        Cambio programado: pasarás a{" "}
                        {PLAN_BY_TIER[mySub.scheduled_plan_tier].displayName} el{" "}
                        {formatDate(mySub.current_period_end)}.
                      </p>
                    </div>
                  )}

                  {clubCovering && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] px-3 py-2.5">
                      <span className="shrink-0 text-[var(--color-accent)] mt-px">
                        ✓
                      </span>
                      <p className="text-[12px] leading-snug text-[var(--color-text)]">
                        Tu club ya cubre tu plan. Puedes cancelar la suscripción
                        individual desde la app móvil y ahorrar{" "}
                        {formatEur(plan.priceMonthlyEur)}/mes.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <TactiumMark size={36} className="opacity-70" />
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">
                        Plan gratuito
                      </h2>
                      <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                        Aún no tienes una suscripción premium activa.
                      </p>
                    </div>
                  </div>
                  {clubCovering && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] px-3 py-2.5">
                      <span className="shrink-0 text-[var(--color-accent)] mt-px">
                        ✓
                      </span>
                      <p className="text-[12px] leading-snug text-[var(--color-text)]">
                        Tu club te cubre. Tienes acceso premium sin pagar nada.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </TiltCard>
          </Reveal>

          {/* === RECUPERACIÓN DE PAGO (grace period) === */}
          {status === "grace_period" && (
            <Reveal delay={40} className="rounded-2xl border border-[var(--color-warning)]/55 bg-[var(--color-warning)]/10 p-5 mb-4">
              <h3 className="text-[15px] font-bold text-[var(--color-warning)]">
                Hay un problema con tu pago
              </h3>
              <p className="text-[13px] leading-relaxed text-[var(--color-text)] mt-1.5">
                No pudimos renovar tu suscripción. Actualiza tu método de pago
                en App Store o Google Play desde la app móvil para no perder el
                acceso a TACTIUM Pro.
              </p>
            </Reveal>
          )}

          {/* === AVISO: COMPRA SOLO EN MÓVIL === */}
          <Reveal delay={80} className="rounded-2xl border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] p-5 mb-8">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-accent)] mb-2">
              GESTIÓN DEL COBRO
            </p>
            <h3 className="text-[15px] font-bold tracking-tight">
              {mySub
                ? "Gestiona tu suscripción desde la app móvil"
                : "Hazte Pro desde la app móvil"}
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)] mt-1.5">
              {mySub
                ? "Cambiar de plan, cancelar, restaurar compras o canjear un código se hace desde la app de TACTIUM en tu móvil, a través de App Store (iOS) o Google Play (Android). Desde la web solo puedes consultar el estado."
                : `Suscríbete y empieza tu prueba gratuita de ${TRIAL_DURATION_DAYS} días desde la app de TACTIUM en tu móvil. Los pagos se gestionan a través de App Store (iOS) o Google Play (Android).`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)] border border-[var(--color-hair-strong)] rounded-full px-3 py-1.5">
                App Store · iOS
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)] border border-[var(--color-hair-strong)] rounded-full px-3 py-1.5">
                Google Play · Android
              </span>
            </div>
          </Reveal>

          {/* === PLAN CAPITÁN === */}
          <Reveal delay={120} className="mb-8">
            <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-3">
              PLAN INDIVIDUAL
            </p>
            <PlanCard
              plan={CAPTAIN_PLAN}
              isCurrent={mySub?.plan_tier === "captain"}
            />
          </Reveal>

          {/* === PLANES CLUB === */}
          <Reveal delay={160} className="mb-8">
            <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text)] mb-3">
              PLANES CLUB
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {CLUB_PLANS.map((p) => (
                <PlanCard
                  key={p.tier}
                  plan={p}
                  isCurrent={mySub?.plan_tier === p.tier}
                />
              ))}
            </div>
          </Reveal>

          {/* === LEGAL === */}
          <p className="text-center text-[11px] text-[var(--color-text-faint)] mt-2">
            Los precios mostrados son orientativos (España, €). El importe final
            lo determinan App Store y Google Play según tu región. Términos de
            uso y Política de Privacidad disponibles en tu Perfil de la app.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Tarjeta de plan ─────────────────────────────────────────────────────────
function PlanCard({
  plan,
  isCurrent,
}: {
  plan: PlanDescriptor;
  isCurrent?: boolean;
}) {
  const discount = annualDiscountPercent(plan);
  return (
    <TiltCard
      className={`rounded-2xl border bg-[var(--color-bg-card)] transition ${
        isCurrent
          ? "border-[var(--color-accent-40)] bg-[var(--color-accent-10)]"
          : "border-[var(--color-hair-strong)] hover:border-[var(--color-accent-40)]"
      }`}
    >
      <div className="p-5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-[16px] tracking-tight">
            {plan.displayName}
          </h4>
          {isCurrent && (
            <span className="shrink-0 font-mono text-[9px] font-bold tracking-[0.12em] text-[var(--color-accent)] border border-[var(--color-accent-40)] rounded-full px-2 py-0.5">
              ACTUAL
            </span>
          )}
        </div>

        <p className="text-[12px] leading-snug text-[var(--color-text-muted)] mt-1.5 min-h-[34px]">
          {plan.blurb}
        </p>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-extrabold tracking-tight">
            {formatEur(plan.priceMonthlyEur)}
          </span>
          <span className="text-[12px] text-[var(--color-text-muted)]">
            /mes
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-[var(--color-text-faint)]">
            {formatEur(plan.priceYearlyEur)}/año
          </span>
          {discount > 0 && (
            <span className="font-mono text-[9px] font-bold tracking-wide text-[var(--color-accent)] border border-[var(--color-accent-40)] rounded-full px-1.5 py-0.5">
              -{discount}%
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <div className="h-px bg-[var(--color-hair)] mb-3" />
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
            {plan.teamQuota === 1
              ? "1 equipo"
              : `Hasta ${plan.teamQuota} equipos`}
          </p>
        </div>
      </div>
    </TiltCard>
  );
}
