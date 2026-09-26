"use client";

import { useState } from "react";

import { BtnLink, Chip } from "@/components/ui";
import { IconCheck } from "@/components/Icon";
import {
  ALL_PLANS,
  TRIAL_DURATION_DAYS,
  annualDiscountPercent,
  formatEur,
  type Plan,
} from "@/lib/plans";
import {
  TOURNAMENT_FREE_PAIRS,
  TOURNAMENT_TIERS,
} from "@/lib/tournament-billing";
import { Reveal } from "./Reveal";

type Billing = "monthly" | "yearly";

/**
 * Resumen de precios de la portada. Lee de `lib/plans.ts` —la misma tabla que
 * el paywall de `/pro`— para que la portada nunca diga un precio distinto al
 * que se cobra.
 */
export function PricingTeaser() {
  const [billing, setBilling] = useState<Billing>("yearly");
  const discount = annualDiscountPercent(ALL_PLANS[1]);

  return (
    <section id="precios" className="mk-sec" aria-labelledby="mk-price-title">
      <div className="mk-wrap">
        <Reveal className="mk-head mk-head--center">
          <p className="mk-kicker">Precios</p>
          <h2 id="mk-price-title" className="mk-h2">
            Empieza con {TRIAL_DURATION_DAYS} días gratis
          </h2>
          <p className="mk-lede">
            Sin permanencia. Cambia o cancela cuando quieras desde tu cuenta.
            Los jugadores no pagan nunca.
          </p>
          <div className="mk-billing" role="group" aria-label="Periodo de facturación">
            <button
              type="button"
              className={billing === "monthly" ? "is-on" : ""}
              onClick={() => setBilling("monthly")}
            >
              Mensual
            </button>
            <button
              type="button"
              className={billing === "yearly" ? "is-on" : ""}
              onClick={() => setBilling("yearly")}
            >
              Anual <Chip tone="accent">−{discount}%</Chip>
            </button>
          </div>
        </Reveal>

        <div className="mk-plans">
          {ALL_PLANS.map((plan, i) => (
            <PlanCard key={plan.tier} plan={plan} billing={billing} delay={0.05 * i} />
          ))}
        </div>

        <Reveal className="mk-tourney-price" delay={0.1}>
          <div>
            <h3>¿Solo quieres torneos?</h3>
            <p>
              Sin suscripción. Cuenta de club gratis y pagas por torneo según
              las parejas inscritas. Hasta {TOURNAMENT_FREE_PAIRS} parejas no
              cuesta nada.
            </p>
          </div>
          <div className="mk-tiers">
            {TOURNAMENT_TIERS.map((t) => (
              <span key={t.pairs} className={"mk-tier" + (t.priceEur === 0 ? " is-free" : "")}>
                hasta {t.pairs} parejas
                <strong>{t.priceEur === 0 ? "gratis" : `${t.priceEur} €`}</strong>
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal className="mk-actions" style={{ justifyContent: "center" }}>
          <BtnLink href="/pro" variant="ghost">
            Ver todos los detalles de los planes
          </BtnLink>
        </Reveal>
      </div>
    </section>
  );
}

/* El importe grande es siempre el que se COBRA (al mes o al año); el
   equivalente mensual del anual va debajo, en pequeño. Misma regla que el
   paywall de la app. */
function PlanCard({ plan, billing, delay }: { plan: Plan; billing: Billing; delay: number }) {
  const yearly = billing === "yearly";
  const billed = yearly ? plan.priceYearlyEur : plan.priceMonthlyEur;
  const perMonth = plan.priceYearlyEur / 12;
  return (
    <Reveal as="article" className={"mk-plan" + (plan.featured ? " is-featured" : "")} delay={delay}>
      {plan.featured && (
        <span className="mk-plan-tag">
          <Chip tone="solid">Recomendado</Chip>
        </span>
      )}
      <div>
        <h3>{plan.displayName}</h3>
        <p className="mk-plan-aud">{plan.audience}</p>
      </div>
      <div className="mk-price">
        <strong>{formatEur(billed).replace(" €", "")}</strong>
        <span>{yearly ? "€/año" : "€/mes"}</span>
      </div>
      <p className="mk-price-sub">
        {yearly
          ? `equivale a ${formatEur(perMonth)} al mes`
          : `o ${formatEur(plan.priceYearlyEur)} al año`}
      </p>
      <ul>
        {plan.features.slice(0, 4).map((f) => (
          <li key={f}>
            <IconCheck size={14} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <BtnLink href="/empezar" variant={plan.featured ? "accent" : "ghost"} block>
        Empezar prueba
      </BtnLink>
    </Reveal>
  );
}
