import type { ReactNode } from "react";

import { BtnLink, Card, CardHead, PageHeader, Table } from "@/components/ui";
import { IconCheck } from "@/components/Icon";
import { ALL_PLANS, TRIAL_DURATION_DAYS, formatEur } from "@/lib/plans";
import { SIGNUP_HREF } from "@/lib/nav";
import { PAID_AFTER_TRIAL_TEXT, PRICES_TAX_SUMMARY } from "@/lib/public-copy";
import { PricingTeaser } from "./PricingTeaser";

/**
 * /pro para quien llega sin cuenta: los cuatro planes como en la portada y
 * una comparativa. Sin «Canjear código» ni «Continuar gratis», que solo tienen
 * sentido con sesión (eso sigue en el `Paywall`). Todo sale de `lib/plans.ts`.
 */

const yes = <IconCheck size={15} style={{ color: "var(--accent)" }} aria-label="Incluido" />;
const no = <span style={{ color: "var(--text-faint)" }} aria-label="No incluido">—</span>;

type Row = { label: string; cells: ReactNode[] };

function rows(): Row[] {
  const has = (tier: string, ...tiers: string[]) => (tiers.includes(tier) ? yes : no);
  return [
    { label: "Para quién", cells: ALL_PLANS.map((p) => p.audience) },
    { label: "Equipos cubiertos", cells: ALL_PLANS.map((p) => <span className="mono">{p.teamQuota}</span>) },
    {
      label: "Parejas de torneo incluidas",
      cells: ALL_PLANS.map((p) =>
        p.tournamentPairCap != null ? <span className="mono">{p.tournamentPairCap}</span> : "Pago por torneo",
      ),
    },
    { label: "Alineaciones por puntos, 5 variantes y avisos", cells: ALL_PLANS.map(() => yes) },
    { label: "Panel global del club", cells: ALL_PLANS.map((p) => has(p.tier, "club_starter", "club_pro", "club_elite")) },
    { label: "Capitanes invitados sin coste", cells: ALL_PLANS.map((p) => has(p.tier, "club_starter", "club_pro", "club_elite")) },
    { label: "Multi-categoría y horarios de pista", cells: ALL_PLANS.map((p) => has(p.tier, "club_pro", "club_elite")) },
    { label: "Informes por categoría", cells: ALL_PLANS.map((p) => has(p.tier, "club_elite")) },
    {
      label: "Al mes",
      cells: ALL_PLANS.map((p) => <span className="mono">{formatEur(p.priceMonthlyEur)}</span>),
    },
    {
      label: "Al año",
      cells: ALL_PLANS.map((p) => <span className="mono">{formatEur(p.priceYearlyEur)}</span>),
    },
  ];
}

export function PublicPricing() {
  return (
    <>
      <div className="tw-page" style={{ paddingBottom: 0 }}>
        <PageHeader
          title="Planes y precios"
          lede={`Prueba ${TRIAL_DURATION_DAYS} días con todo, sin tarjeta. Los jugadores no pagan nunca: paga el capitán o el club.`}
          actions={
            <BtnLink href={SIGNUP_HREF} variant="accent">
              Empezar prueba
            </BtnLink>
          }
        />
      </div>

      <div className="mk">
        <PricingTeaser onProPage />
      </div>

      <div className="tw-page" style={{ paddingTop: 0 }}>
        <Card flush>
          <CardHead title="Comparativa" />
          <Table minWidth={720}>
            <thead>
              <tr>
                <th />
                {ALL_PLANS.map((p) => (
                  <th key={p.tier}>{p.displayName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows().map((r) => (
                <tr key={r.label}>
                  <td className="cell-main">{r.label}</td>
                  {r.cells.map((c, i) => (
                    <td key={ALL_PLANS[i].tier}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
          {PRICES_TAX_SUMMARY} En la app, el precio lo fija la tienda (App Store o
          Google Play) y puede variar ligeramente. {PAID_AFTER_TRIAL_TEXT}
        </p>
      </div>
    </>
  );
}
