import type { Metadata } from "next";

import { CLUB_PLAN, CLUB_TEAMS, PLANS } from "@/lib/account-data";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import {
  IconAlert,
  IconBuilding,
  IconInfo,
  IconShield,
} from "@/components/Icon";

export const metadata: Metadata = { title: "Facturación del club" };

/**
 * Facturación del club. Server component: son datos de lectura, no hay
 * interacción más allá de los enlaces de cambio de plan.
 *
 * La cobertura se calcula por ÍNDICE dentro de la lista (los primeros N
 * equipos del club entran en el plan). Es la misma regla que usa la app.
 */
export default function FacturacionClubPage() {
  const covered = CLUB_TEAMS.filter((t) => t.covered).length;
  const pct = Math.min(100, Math.round((covered / CLUB_PLAN.limit) * 100));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        eyebrow="CLUB · FACTURACIÓN"
        title="Facturación del club"
        lede="Tu plan, qué equipos cubre y qué pasa con los que se salen del límite."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ── Plan actual ─────────────────────────────────────────── */}
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
            <div
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <h2 style={{ fontSize: 26 }}>{CLUB_PLAN.name}</h2>
              <span className="chip">ACTIVA</span>
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
                style={{ fontSize: 34, fontWeight: 700 }}
              >
                {CLUB_PLAN.price}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  color: "var(--text-faint)",
                }}
              >
                {CLUB_PLAN.period}
              </span>
            </div>
            <div
              className="mono"
              style={{
                marginTop: 12,
                fontSize: 12,
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Próxima renovación · {CLUB_PLAN.renews}
            </div>
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
              {covered} de {CLUB_PLAN.limit}
            </div>
            <div
              role="progressbar"
              aria-valuenow={covered}
              aria-valuemin={0}
              aria-valuemax={CLUB_PLAN.limit}
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
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "var(--text-muted)",
              }}
            >
              {covered} de {CLUB_PLAN.limit} equipos incluidos
            </span>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            {CLUB_TEAMS.map((t, i) => (
              <div
                key={t.name}
                className="tw-billing-row"
                style={{
                  borderBottom:
                    i === CLUB_TEAMS.length - 1
                      ? "none"
                      : "1px solid var(--hair)",
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
                  {t.meta}
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
            {PLANS.map((p, i) => {
              const isCurrent = p.name === "Hasta 10 equipos";
              const isBelow = i === 0;
              return (
                <Card
                  key={p.name}
                  style={{
                    padding: 22,
                    opacity: isBelow ? 0.55 : 1,
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
                      {p.name}
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
                    {p.monthly}
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

                  {isBelow ? (
                    <div
                      className="mono"
                      style={{
                        marginTop: 14,
                        fontSize: 9.5,
                        letterSpacing: "0.18em",
                        color: "var(--text-faint)",
                      }}
                    >
                      POR DEBAJO DE TU USO
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={
                        "btn " + (isCurrent ? "btn-ghost" : "btn-accent")
                      }
                      style={{
                        marginTop: 16,
                        width: "100%",
                        padding: 11,
                        fontSize: 13,
                      }}
                    >
                      {isCurrent ? "Cambiar plan" : "Mejorar plan"}
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* ── Estados vacíos que puede devolver el club ───────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {[
            { Icon: IconInfo, text: "Sin plan activo", color: "var(--text-muted)" },
            { Icon: IconBuilding, text: "SIN CLUB", color: "var(--text-muted)", mono: true },
            { Icon: IconAlert, text: "Sin configurar", color: "var(--warning)" },
          ].map((s) => (
            <div
              key={s.text}
              style={{
                padding: "18px 20px",
                borderRadius: 12,
                border: "1px solid var(--hair-strong)",
                display: "flex",
                alignItems: "center",
                gap: 11,
                color: s.color,
              }}
            >
              <s.Icon size={15} />
              <span
                className={s.mono ? "mono" : undefined}
                style={
                  s.mono
                    ? { fontSize: 10.5, letterSpacing: "0.16em" }
                    : { fontSize: 12.5 }
                }
              >
                {s.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
