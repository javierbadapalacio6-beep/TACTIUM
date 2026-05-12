"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  ALL_PLANS,
  annualDiscountPercent,
  formatEur,
  TRIAL_DURATION_DAYS,
  type PlanDescriptor,
} from "@/lib/plans";
import { AnimatedPrice } from "./AnimatedPrice";

type Billing = "monthly" | "yearly";

const RECOMMENDED_TIER = "club_pro";

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <section
      id="precios"
      className="py-14 sm:py-20 border-t border-[var(--color-hair)]"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
            PRECIOS
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Empieza con {TRIAL_DURATION_DAYS} días gratis
          </h2>
          <p className="mt-3 text-[var(--color-text-muted)] max-w-xl mx-auto">
            Sin permanencia. Cambia o cancela cuando quieras desde tu cuenta.
          </p>

          {/* Toggle mensual/anual */}
          <div className="inline-flex mt-8 p-1 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-hair)]">
            {(["monthly", "yearly"] as const).map((opt) => {
              const sel = billing === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setBilling(opt)}
                  className={`px-5 h-9 rounded-full text-sm font-medium transition ${
                    sel
                      ? "bg-[var(--color-bg-raised)] text-[var(--color-text)] shadow"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {opt === "monthly" ? "Mensual" : "Anual"}
                  {opt === "yearly" && (
                    <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-bold tracking-widest">
                      -20%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ALL_PLANS.map((plan) => (
            <PricingCard
              key={plan.tier}
              plan={plan}
              billing={billing}
              recommended={plan.tier === RECOMMENDED_TIER}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[var(--color-text-faint)] font-mono tracking-wide">
          PAGO RECURRENTE EN APP STORE / GOOGLE PLAY · CANCELA DESDE AJUSTES
        </p>
      </div>
    </section>
  );
}

function PricingCard({
  plan,
  billing,
  recommended,
}: {
  plan: PlanDescriptor;
  billing: Billing;
  recommended: boolean;
}) {
  const monthlyEquivalent =
    billing === "yearly"
      ? plan.priceYearlyEur / 12
      : plan.priceMonthlyEur;
  const yearlyDiscount = annualDiscountPercent(plan);

  return (
    <article
      className={`relative p-6 rounded-2xl border flex flex-col gap-5 ${
        recommended
          ? "bg-[var(--color-bg-raised)] border-[var(--color-accent)] shadow-[0_24px_60px_-20px_rgba(0,223,130,0.35)]"
          : "bg-[var(--color-bg-card)] border-[var(--color-hair)]"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest font-bold px-3 py-1 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)]">
          RECOMENDADO
        </span>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold tracking-tight">{plan.displayName}</h3>
        <p className="text-xs text-[var(--color-text-faint)] font-mono tracking-wide">
          {plan.teamQuota === 1
            ? "1 equipo"
            : `Hasta ${plan.teamQuota} equipos`}
        </p>
      </div>

      <div className="flex items-baseline gap-1 tabular-nums">
        <AnimatedPrice
          value={monthlyEquivalent}
          className="font-mono text-3xl font-extrabold text-[var(--color-text)] min-w-[88px]"
        />
        <span className="text-sm text-[var(--color-text-muted)]">€/mes</span>
      </div>
      {billing === "yearly" && (
        <p className="-mt-3 font-mono text-[11px] text-[var(--color-text-faint)] tracking-wide">
          {formatEur(plan.priceYearlyEur)} / año · ahorra {yearlyDiscount}%
        </p>
      )}

      <ul className="flex flex-col gap-2 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              className="w-4 h-4 mt-0.5 text-[var(--color-accent)] flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-[var(--color-text-muted)]">{f}</span>
          </li>
        ))}
      </ul>

      <a
        href="#hero-form"
        className={`mt-auto h-11 inline-flex items-center justify-center rounded-xl font-semibold text-sm transition ${
          recommended
            ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90"
            : "bg-[var(--color-bg-raised)] text-[var(--color-text)] border border-[var(--color-hair-strong)] hover:border-[var(--color-accent-40)]"
        }`}
      >
        Empezar prueba
      </a>
    </article>
  );
}
