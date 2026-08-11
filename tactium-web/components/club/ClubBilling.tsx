"use client";

import Link from "next/link";

import { fetchClubTeams, fetchSubscription } from "@/lib/queries";
import { CLUB_PLANS, formatEur } from "@/lib/plans";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
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
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <PageHeader
          eyebrow="CLUB · FACTURACIÓN"
          title="Facturación del club"
          lede="Tu plan, qué equipos cubre y qué pasa con los que se salen del límite."
        />
        <Card>
          <EmptyState
            icon={<IconBuilding size={34} />}
            title="No gestionas ningún club"
            body="Esta pantalla es para administradores de club."
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        eyebrow="CLUB · FACTURACIÓN"
        title="Facturación del club"
        lede="Tu plan, qué equipos cubre y qué pasa con los que se salen del límite."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ── Plan actual ─────────────────────────────────────────── */}
        {sub.loading ? (
          <SkeletonCard />
        ) : !plan ? (
          <Card>
            <EmptyState
              icon={<IconBuilding size={34} />}
              title="El club no tiene plan activo"
              body="Sin plan, los equipos no están cubiertos y las acciones de gestión piden suscripción."
              action={
                <Link
                  href="/pro"
                  className="btn btn-accent"
                  style={{ padding: "12px 22px", fontSize: 13.5 }}
                >
                  Ver planes
                </Link>
              }
            />
          </Card>
        ) : (
          <Card
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h2 style={{ fontSize: 26 }}>{plan.displayName}</h2>
                <span className="chip">
                  {sub.data?.status === "trialing" ? "EN PRUEBA" : "ACTIVA"}
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
                <span className="mono" style={{ fontSize: 34, fontWeight: 700 }}>
                  {formatEur(
                    yearly ? plan.priceYearlyEur : plan.priceMonthlyEur
                  )}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    color: "var(--text-faint)",
                  }}
                >
                  {yearly ? "/AÑO" : "/MES"}
                </span>
              </div>
              {renews && (
                <div
                  className="mono"
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                  }}
                >
                  Próxima renovación · {renews}
                </div>
              )}
            </div>

            <div style={{ textAlign: "right", flex: "none" }}>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                }}
              >
                Equipos incluidos
              </div>
              <div
                className="mono"
                style={{ marginTop: 10, fontSize: 26, fontWeight: 700 }}
              >
                {covered} de {limit}
              </div>
              <div
                role="progressbar"
                aria-valuenow={covered}
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-label="Equipos incluidos en el plan"
                style={{
                  marginTop: 12,
                  width: 180,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--hair-strong)",
                  overflow: "hidden",
                  marginLeft: "auto",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--accent)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* ── Equipos ─────────────────────────────────────────────── */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Eyebrow>EQUIPOS</Eyebrow>
            {plan && (
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                }}
              >
                {covered} de {limit} equipos incluidos
              </span>
            )}
          </div>

          {teams.loading ? (
            <SkeletonCard />
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconShield size={34} />}
                title="El club todavía no tiene equipos"
              />
            </Card>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {rows.map((t, i) => (
                <div
                  key={t.id}
                  className="tw-billing-row"
                  style={{
                    borderBottom:
                      i === rows.length - 1 ? "none" : "1px solid var(--hair)",
                    opacity: t.covered ? 1 : 0.6,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        background: "var(--primary-dim)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                      }}
                    >
                      <IconShield size={14} />
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {t.name}
                    </span>
                  </span>

                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      color: "var(--text-faint)",
                    }}
                  >
                    {[t.category, t.gender].filter(Boolean).join(" · ").toUpperCase()}
                  </span>

                  <span
                    className={"chip" + (t.covered ? "" : " chip-warning")}
                    style={{ justifyContent: "center" }}
                  >
                    {t.covered ? "Incluido" : "No cubierto"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Planes disponibles ──────────────────────────────────── */}
        <section>
          <Eyebrow style={{ marginBottom: 12 }}>PLANES DISPONIBLES</Eyebrow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {CLUB_PLANS.map((p) => {
              const isCurrent = p.tier === plan?.tier;
              // Un plan que no llega a los equipos que ya tiene el club no le
              // sirve: se enseña apagado en vez de ofrecerlo.
              const tooSmall = p.teamQuota < rows.length;
              return (
                <Card
                  key={p.tier}
                  style={{
                    padding: 22,
                    opacity: tooSmall && !isCurrent ? 0.55 : 1,
                    border: isCurrent
                      ? "1.5px solid var(--accent)"
                      : "1.5px solid transparent",
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
                    <span style={{ fontSize: 16, fontWeight: 700 }}>
                      {p.displayName}
                    </span>
                    {isCurrent && <span className="chip">Tu plan</span>}
                  </div>

                  <div
                    className="mono"
                    style={{
                      marginTop: 12,
                      fontSize: 24,
                      fontWeight: 700,
                      color: isCurrent ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    {formatEur(p.priceMonthlyEur)}
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.14em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {" "}
                      /MES
                    </span>
                  </div>

                  <div
                    className="mono"
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: "var(--text-faint)",
                    }}
                  >
                    HASTA {p.teamQuota} EQUIPOS · TORNEOS HASTA{" "}
                    {p.tournamentPairCap} PAREJAS
                  </div>

                  {tooSmall && !isCurrent ? (
                    <div
                      className="mono"
                      style={{
                        marginTop: 14,
                        fontSize: 9.5,
                        letterSpacing: "0.18em",
                        color: "var(--text-faint)",
                      }}
                    >
                      POR DEBAJO DE TUS {rows.length} EQUIPOS
                    </div>
                  ) : (
                    <Link
                      href="/pro"
                      className={"btn " + (isCurrent ? "btn-ghost" : "btn-accent")}
                      style={{
                        marginTop: 16,
                        width: "100%",
                        padding: 11,
                        fontSize: 13,
                        justifyContent: "center",
                      }}
                    >
                      {isCurrent ? "Cambiar plan" : "Mejorar plan"}
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
