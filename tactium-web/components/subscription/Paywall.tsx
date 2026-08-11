"use client";

import Link from "next/link";
import { useState } from "react";

import { CLUB_PLANS, formatEur } from "@/lib/plans";
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_EXTRA_PAIR_EUR,
} from "@/lib/tournament-billing";
import { Card, Eyebrow } from "@/components/ui";
import { IconCheck } from "@/components/Icon";

type Cycle = "monthly" | "yearly";

/**
 * Paywall web (Stripe).
 *
 * ⚠️ RESTRICCIÓN FIRME DE DISEÑO, no una preferencia estética:
 * el importe REALMENTE FACTURADO es siempre el precio más prominente. El
 * equivalente mensual de un plan anual va pequeño y debajo. Apple rechazó la
 * build 1.0(8) por invertir esa jerarquía (motivo 3.1.2c) y la regla se
 * mantiene en todas las superficies para que el mensaje sea el mismo.
 */
export function Paywall() {
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const yearly = cycle === "yearly";

  const segStyle = (on: boolean) => ({
    padding: "9px 22px",
    borderRadius: 9,
    cursor: "pointer",
    fontSize: 13.5,
    fontWeight: on ? 700 : 500,
    border: "none",
    background: on ? "var(--accent-10)" : "transparent",
    color: on ? "var(--accent)" : "var(--text-muted)",
    boxShadow: on ? "inset 0 0 0 1.5px var(--accent)" : "none",
    transition: "all var(--dur-fast) var(--ease)",
  });

  return (
    <div className="amb" style={{ borderRadius: 24, padding: "48px 24px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <Eyebrow>TACTIUM PRO</Eyebrow>
          <h1
            style={{
              margin: "18px auto 0",
              fontSize: "clamp(34px, 5vw, 52px)",
              lineHeight: 1.02,
              maxWidth: "18ch",
              textWrap: "balance",
            }}
          >
            Deja el Excel y el grupo de mensajes
          </h1>
          <p
            style={{
              margin: "18px auto 0",
              fontSize: 16,
              color: "var(--text-muted)",
              maxWidth: "52ch",
              textWrap: "pretty",
            }}
          >
            Toda la gestión del equipo — alineaciones, actas, torneos y
            federación — en un sitio hecho para capitanes.
          </p>

          <div
            style={{
              marginTop: 28,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <div
              role="radiogroup"
              aria-label="Ciclo de facturación"
              style={{
                display: "flex",
                padding: 4,
                borderRadius: 12,
                background: "var(--bg-card)",
                gap: 4,
              }}
            >
              <button
                type="button"
                role="radio"
                aria-checked={!yearly}
                onClick={() => setCycle("monthly")}
                style={segStyle(!yearly)}
              >
                Mensual
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={yearly}
                onClick={() => setCycle("yearly")}
                style={segStyle(yearly)}
              >
                Anual
              </button>
            </div>
            <span
              className="chip"
              style={{ background: "var(--accent-10)" }}
            >
              Ahorra 2 meses
            </span>
          </div>
        </div>

        {/* ── Planes ─────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 36,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {CLUB_PLANS.map((p) => (
            <Card
              key={p.tier}
              style={{
                border: `1.5px solid ${
                  p.featured ? "var(--accent)" : "transparent"
                }`,
              }}
            >
              {p.featured && (
                <div style={{ marginBottom: 16 }}>
                  <span className="chip chip-solid">Recomendado</span>
                </div>
              )}

              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {p.displayName}
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textWrap: "pretty",
                }}
              >
                {p.audience}
              </div>

              {/* Importe facturado — el precio dominante. */}
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 42,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: p.featured ? "var(--accent)" : "var(--text)",
                  }}
                >
                  {formatEur(yearly ? p.priceYearlyEur : p.priceMonthlyEur)}
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

              {/* Equivalente mensual — secundario, pequeño y debajo. */}
              {yearly && (
                <div
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--text-faint)",
                  }}
                >
                  {`equivale a ${formatEur(p.priceYearlyEur / 12)}/mes`}
                </div>
              )}

              <div
                style={{
                  marginTop: 24,
                  height: 1,
                  background: "var(--hair)",
                }}
              />

              <ul
                style={{
                  listStyle: "none",
                  margin: "20px 0 0",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {p.features.map((b) => (
                  <li
                    key={b}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 11,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--accent)",
                        display: "flex",
                        flex: "none",
                        marginTop: 1,
                      }}
                    >
                      <IconCheck size={16} />
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        textWrap: "pretty",
                      }}
                    >
                      {b}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={"btn " + (p.featured ? "btn-accent" : "btn-ghost")}
                style={{
                  marginTop: 24,
                  width: "100%",
                  padding: 14,
                  fontSize: 14,
                }}
              >
                Empezar prueba 14 días
              </button>
            </Card>
          ))}
        </div>

        {/* ── Cómo va la prueba ──────────────────────────────────── */}
        <Card style={{ marginTop: 32 }}>
          <Eyebrow>CÓMO VA LA PRUEBA</Eyebrow>
          <ol
            style={{
              listStyle: "none",
              margin: "24px 0 0",
              padding: 0,
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 24,
            }}
          >
            {[
              {
                day: "DÍA 0",
                text: "Empieza la prueba · sin cobro",
                color: "var(--accent)",
              },
              {
                day: "DÍA 11",
                text: "Te avisamos de que quedan 3 días",
                color: "var(--warning)",
              },
              {
                day: "DÍA 14",
                text: "Primer cobro · puedes cancelar antes",
                color: "var(--hair-strong)",
              },
            ].map((s, i) => (
              <li key={s.day} style={{ position: "relative", textAlign: "center" }}>
                <span
                  style={{
                    display: "block",
                    width: 15,
                    height: 15,
                    borderRadius: 999,
                    background: s.color,
                    margin: "0 auto",
                    boxShadow: "0 0 0 4px var(--bg-card)",
                  }}
                />
                <div
                  className="mono"
                  style={{
                    marginTop: 14,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: i === 2 ? "var(--text-muted)" : s.color,
                  }}
                >
                  {s.day}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13.5,
                    color: "var(--text-muted)",
                  }}
                >
                  {s.text}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* ── Torneos ────────────────────────────────────────────────
            Carril aparte: un club puede querer sólo organizar torneos y no
            gestionar equipos. Aquí no hay suscripción — se paga el torneo. */}
        <div style={{ marginTop: 48 }}>
          <Eyebrow>TORNEOS SUELTOS</Eyebrow>
          <h2 style={{ margin: "10px 0 0", fontSize: 26, lineHeight: 1.1 }}>
            ¿Sólo quieres montar un torneo?
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14.5,
              color: "var(--text-muted)",
              maxWidth: "62ch",
              textWrap: "pretty",
            }}
          >
            No hace falta suscripción. Pagas una vez, por el tamaño del torneo,
            y las inscripciones las cobras tú con tu pasarela: TACTIUM no se
            queda comisión. Si ya tienes plan de club, tus torneos van incluidos
            hasta el tope de tu plan.
          </p>

          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
            }}
          >
            {TOURNAMENT_TIERS.map((t) => (
              <Card key={t.pairs} style={{ padding: 20 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    color: "var(--text-faint)",
                  }}
                >
                  HASTA {t.pairs} PAREJAS
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 10,
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: t.priceEur === 0 ? "var(--accent)" : "var(--text)",
                  }}
                >
                  {t.priceEur === 0 ? "Gratis" : formatEur(t.priceEur)}
                </div>
              </Card>
            ))}
          </div>

          <p
            className="mono"
            style={{
              margin: "14px 0 0",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--text-faint)",
            }}
          >
            +{TOURNAMENT_EXTRA_PAIR_EUR} € POR PAREJA POR ENCIMA DEL TRAMO
          </p>
        </div>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            Canjear código
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: "12px 22px",
              fontSize: 13.5,
              fontWeight: 500,
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
            }}
          >
            Continuar gratis
          </button>
        </div>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            fontSize: 12.5,
            color: "var(--text-faint)",
          }}
        >
          <Link href="/legal/terminos" style={{ color: "inherit" }}>
            Términos de uso
          </Link>
          <span>·</span>
          <Link href="/legal/privacidad" style={{ color: "inherit" }}>
            Política de privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
