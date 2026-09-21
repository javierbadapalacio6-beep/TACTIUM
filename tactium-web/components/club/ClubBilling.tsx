"use client";

import { fetchClubTeams, fetchSubscription } from "@/lib/queries";
import { CLUB_PLANS, formatEur } from "@/lib/plans";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  BtnLink,
  Card,
  CardHead,
  Chip,
  IconTile,
  PageHeader,
  Progress,
  SectionHead,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconBuilding, IconShield } from "@/components/Icon";

/**
 * Facturación del club — DATOS REALES.
 *
 * Antes esta pantalla pintaba una maqueta: un plan fijo de "10 equipos ·
 * 29,99 €/mes" (el real son 24,99 €), una lista de equipos inventada y una
 * fila de estados vacíos de muestra. Nada de eso venía de la base de datos,
 * así que un club veía el plan de otro y un precio que no existe.
 *
 * La cobertura la marca la columna `teams.covered`, que mantiene el servidor:
 * aquí sólo se cuenta y se pinta.
 */
export function ClubBilling() {
  const { clubId } = useSession();

  const sub = useAsync(() => fetchSubscription(), []);
  const teams = useAsync(
    () => fetchClubTeams(clubId as string),
    [clubId],
    !!clubId
  );

  const plan = CLUB_PLANS.find((p) => p.tier === sub.data?.planTier) ?? null;
  const rows = teams.data ?? [];
  const covered = rows.filter((t) => t.covered).length;
  const limit = plan?.teamQuota ?? 0;
  const pct = limit ? Math.min(100, Math.round((covered / limit) * 100)) : 0;
  const yearly = sub.data?.billingPeriod === "yearly";

  const renews = sub.data?.currentPeriodEnd
    ? new Date(sub.data.currentPeriodEnd).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  if (!clubId) {
    return (
      <div className="tw-page">
        <PageHeader
          title="Facturación del club"
          lede="Tu plan, qué equipos cubre y qué pasa con los que se salen del límite."
        />
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="No gestionas ningún club"
            body="Esta pantalla es para administradores de club."
          />
        </Card>
      </div>
    );
  }

  // El plan que se propone es el SIGUIENTE hacia arriba: sugerir el más
  // barato como «mejora» era al revés de lo que dice el botón. Ese, y sólo
  // ese, lleva el botón accent de la rejilla.
  const currentIndex = CLUB_PLANS.findIndex((p) => p.tier === plan?.tier);
  const recommendedTier =
    CLUB_PLANS.find(
      (p, i) => i > currentIndex && p.teamQuota >= rows.length,
    )?.tier ?? null;

  return (
    <div className="tw-page">
      <PageHeader
        title="Facturación del club"
        lede="Tu plan, qué equipos cubre y qué pasa con los que se salen del límite."
      />

      {/* ── Plan actual ─────────────────────────────────────────── */}
      {sub.loading ? (
        <SkeletonCard />
      ) : !plan ? (
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="El club no tiene plan activo"
            body="Sin plan, los equipos no están cubiertos y las acciones de gestión piden suscripción."
            action={
              <BtnLink href="/pro" variant="accent">
                Ver planes
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <Card flush>
          <CardHead
            title={plan.displayName}
            sub={renews ? `Próxima renovación el ${renews}` : undefined}
          >
            <Chip>{sub.data?.status === "trialing" ? "En prueba" : "Activa"}</Chip>
          </CardHead>
          <StatRow style={{ border: "none", borderRadius: 0, boxShadow: "none" }}>
            <Stat
              label={yearly ? "Precio al año" : "Precio al mes"}
              value={formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
              sub={yearly ? "Facturación anual" : "Facturación mensual"}
            />
            <Stat
              label="Equipos incluidos"
              value={covered}
              unit={`/ ${limit}`}
              tone={limit > 0 && covered >= limit ? "warning" : undefined}
              sub={
                limit > 0 && covered >= limit
                  ? "Has llegado al límite del plan"
                  : `${Math.max(0, limit - covered)} huecos libres`
              }
            >
              <Progress
                value={pct}
                tone={limit > 0 && covered >= limit ? "warning" : undefined}
                style={{ marginTop: 10 }}
              />
            </Stat>
          </StatRow>
        </Card>
      )}

      {/* ── Equipos ─────────────────────────────────────────────── */}
      <Card flush style={{ marginTop: 16 }}>
        <CardHead
          title="Equipos"
          count={rows.length}
          sub={plan ? `${covered} de ${limit} incluidos en el plan` : undefined}
        />
        {teams.loading ? (
          <div style={{ padding: 18 }}>
            <SkeletonCard />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={<IconShield size={22} />}
            title="El club todavía no tiene equipos"
          />
        ) : (
          rows.map((t) => (
            <div
              key={t.id}
              className="tw-billing-row"
              style={{ opacity: t.covered ? 1 : 0.7 }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <IconTile small>
                  <IconShield size={14} />
                </IconTile>
                <span className="truncate" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  {t.name}
                </span>
              </span>

              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {[t.category, t.gender].filter(Boolean).join(" · ") || "Sin categoría"}
              </span>

              <span style={{ display: "flex", justifyContent: "flex-end" }}>
                {t.covered ? <Chip>Incluido</Chip> : <Chip tone="warning">No cubierto</Chip>}
              </span>
            </div>
          ))
        )}
      </Card>

      {/* ── Planes disponibles ──────────────────────────────────── */}
      <SectionHead title="Planes disponibles" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {CLUB_PLANS.map((p, i) => {
          const isCurrent = p.tier === plan?.tier;
          // Un plan que no llega a los equipos que ya tiene el club no le
          // sirve: se enseña apagado en vez de ofrecerlo.
          const tooSmall = p.teamQuota < rows.length;
          const isRecommended = p.tier === recommendedTier && !tooSmall;
          const isUpgrade = i > currentIndex;
          return (
            <Card
              key={p.tier}
              style={{
                display: "flex",
                flexDirection: "column",
                opacity: tooSmall && !isCurrent ? 0.55 : 1,
                borderColor: isCurrent ? "var(--accent-40)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  {p.displayName}
                </span>
                {isCurrent && <Chip>Tu plan</Chip>}
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 4 }}>
                <span className="mono" style={{ fontSize: 27, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {formatEur(p.priceMonthlyEur)}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>al mes</span>
              </div>

              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-muted)", flex: 1 }}>
                Hasta {p.teamQuota} equipos · torneos hasta {p.tournamentPairCap} parejas
              </div>

              {tooSmall && !isCurrent ? (
                <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--text-faint)" }}>
                  Por debajo de tus {rows.length} equipos
                </div>
              ) : (
                <BtnLink
                  href="/pro"
                  variant={isRecommended ? "accent" : "ghost"}
                  block
                  style={{ marginTop: 16 }}
                >
                  {isCurrent
                    ? "Gestionar plan"
                    : isUpgrade
                      ? "Mejorar plan"
                      : "Bajar a este plan"}
                </BtnLink>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
