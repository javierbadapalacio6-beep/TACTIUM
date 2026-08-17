"use client";

import Link from "next/link";
import { useState } from "react";

import { CAPTAIN_PLAN, CLUB_PLANS, formatEur } from "@/lib/plans";
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_EXTRA_PAIR_EUR,
} from "@/lib/tournament-billing";
import { useSession } from "@/lib/session";
import { Card, Eyebrow } from "@/components/ui";
import { Toast } from "@/components/states";
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

  const { user, clubId } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Contrata un plan de club: abre Stripe Checkout (prueba 14 días). El sujeto es
  // el club del usuario; el importe lo calcula el servidor desde plans.ts.
  async function subscribe(tier: string) {
    if (busy) return;
    if (!user) {
      window.location.href = "/entrar";
      return;
    }
    // El plan Capitán es personal (subject = usuario): no requiere club. Los
    // planes de club sí necesitan un club del que seas owner/admin.
    const isCaptain = tier === "captain";
    if (!isCaptain && !clubId) {
      setToast("Primero crea tu club para contratar un plan de club.");
      return;
    }
    setBusy(tier);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isCaptain
            ? { tier, cycle, subjectType: "user" }
            : { tier, cycle, subjectType: "club", subjectId: clubId },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setToast(data.error ?? "No se pudo iniciar el pago.");
    } catch {
      setToast("No se pudo conectar con la pasarela de pago.");
    } finally {
      setBusy(null);
    }
  }

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
                onClick={() => subscribe(p.tier)}
                disabled={busy !== null}
                className={"btn " + (p.featured ? "btn-accent" : "btn-ghost")}
                style={{
                  marginTop: 24,
                  width: "100%",
                  padding: 14,
                  fontSize: 14,
                }}
              >
                {busy === p.tier ? "Abriendo pago…" : "Empezar prueba 14 días"}
              </button>
            </Card>
          ))}
        </div>

        {/* ── Carril Capitán ─────────────────────────────────────────
            Quien sólo gestiona UN equipo (capitán independiente) no necesita un
            plan de club. Antes no había opción y quedaba sin salida. */}
        <Card
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 20,
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 220, flex: 1 }}>
            <Eyebrow>SOLO UN EQUIPO</Eyebrow>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>
              {CAPTAIN_PLAN.displayName}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginTop: 6,
                textWrap: "pretty",
              }}
            >
              {CAPTAIN_PLAN.audience} · gestiónalo sin crear un club.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="mono"
              style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}
            >
              {formatEur(
                yearly
                  ? CAPTAIN_PLAN.priceYearlyEur
                  : CAPTAIN_PLAN.priceMonthlyEur,
              )}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--text-faint)",
              }}
            >
              {yearly ? "/AÑO" : "/MES"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => subscribe("captain")}
            disabled={busy !== null}
            className="btn btn-ghost"
            style={{ padding: "12px 22px", fontSize: 13.5, flex: "none" }}
          >
            {busy === "captain" ? "Abriendo pago…" : "Empezar prueba 14 días"}
          </button>
        </Card>

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

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
