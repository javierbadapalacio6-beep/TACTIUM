"use client";

import Link from "next/link";
import { useState } from "react";

import { CAPTAIN_PLAN, CLUB_PLANS, formatEur } from "@/lib/plans";
import { vatNote } from "@/lib/tax";
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_EXTRA_PAIR_EUR,
} from "@/lib/tournament-billing";
import { useSession } from "@/lib/session";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  PageHeader,
  SectionHead,
  Segmented,
} from "@/components/ui";
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

  /** Sufijo del precio: ciclo facturado + nota de IVA cuando la hay. */
  const periodNote = (tier: string) => {
    const vat = vatNote(tier);
    return (yearly ? "al año" : "al mes") + (vat ? ` · ${vat}` : "");
  };

  return (
    <div className="tw-page">
      <PageHeader
        title="Deja el Excel y el grupo de mensajes"
        lede="Toda la gestión del equipo — alineaciones, actas, torneos y federación — en un sitio hecho para capitanes."
        actions={
          <>
            <Segmented
              label="Ciclo de facturación"
              value={cycle}
              onChange={setCycle}
              options={[
                { value: "monthly", label: "Mensual" },
                { value: "yearly", label: "Anual" },
              ]}
            />
            <Chip>Ahorra 2 meses</Chip>
          </>
        }
      />

      {/* ── Planes ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {CLUB_PLANS.map((p) => (
          <Card
            key={p.tier}
            style={p.featured ? { borderColor: "var(--accent-40)" } : undefined}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                minHeight: 24,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
                {p.displayName}
              </div>
              {p.featured && <Chip tone="solid">Recomendado</Chip>}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              {p.audience}
            </div>

            {/* Importe facturado — el precio dominante (requisito de Apple). */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: p.featured ? "var(--accent)" : "var(--text)",
                }}
              >
                {formatEur(yearly ? p.priceYearlyEur : p.priceMonthlyEur)}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {periodNote(p.tier)}
              </span>
            </div>

            {/* Equivalente mensual — secundario, pequeño y debajo. */}
            {yearly && (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-faint)" }}>
                equivale a{" "}
                <span className="mono">{formatEur(p.priceYearlyEur / 12)}</span> al mes
              </div>
            )}

            <div className="divider" style={{ margin: "18px 0" }} />

            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {p.features.map((b) => (
                <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      color: "var(--accent)",
                      display: "flex",
                      flex: "none",
                      marginTop: 1,
                    }}
                  >
                    <IconCheck size={15} />
                  </span>
                  <span
                    style={{ fontSize: 13, color: "var(--text-muted)", textWrap: "pretty" }}
                  >
                    {b}
                  </span>
                </li>
              ))}
            </ul>

            <Btn
              variant={p.featured ? "accent" : "ghost"}
              block
              disabled={busy !== null}
              onClick={() => subscribe(p.tier)}
              style={{ marginTop: 20 }}
            >
              {busy === p.tier ? "Abriendo pago…" : "Empezar prueba 14 días"}
            </Btn>
          </Card>
        ))}
      </div>

      {/* ── Carril Capitán ─────────────────────────────────────────
          Quien sólo gestiona UN equipo (capitán independiente) no necesita un
          plan de club. Antes no había opción y quedaba sin salida. */}
      <Card
        style={{
          marginTop: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{CAPTAIN_PLAN.displayName}</div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 4,
              textWrap: "pretty",
            }}
          >
            {CAPTAIN_PLAN.audience} · gestiónalo sin crear un club.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            {formatEur(
              yearly ? CAPTAIN_PLAN.priceYearlyEur : CAPTAIN_PLAN.priceMonthlyEur,
            )}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {periodNote(CAPTAIN_PLAN.tier)}
          </span>
        </div>
        <Btn
          disabled={busy !== null}
          onClick={() => subscribe("captain")}
          style={{ flex: "none" }}
        >
          {busy === "captain" ? "Abriendo pago…" : "Empezar prueba 14 días"}
        </Btn>
      </Card>

      {/* ── Cómo va la prueba ──────────────────────────────────── */}
      <Card flush style={{ marginTop: 16 }}>
        <CardHead title="Cómo va la prueba" />
        <div className="card-body">
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            {[
              { day: "Día 0", text: "Empieza la prueba · sin cobro", color: "var(--accent)" },
              {
                day: "Día 11",
                text: "Te avisamos de que quedan 3 días",
                color: "var(--warning)",
              },
              {
                day: "Día 14",
                text: "Primer cobro · puedes cancelar antes",
                color: "var(--hair-strong)",
              },
            ].map((s) => (
              <li key={s.day} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span
                  style={{
                    display: "block",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: s.color,
                    flex: "none",
                    marginTop: 5,
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>
                    {s.day}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                    }}
                  >
                    {s.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* ── Torneos ────────────────────────────────────────────────
          Carril aparte: un club puede querer sólo organizar torneos y no
          gestionar equipos. Aquí no hay suscripción — se paga el torneo. */}
      <SectionHead title="¿Sólo quieres montar un torneo?" />
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 13.5,
          color: "var(--text-muted)",
          maxWidth: "62ch",
          textWrap: "pretty",
        }}
      >
        No hace falta suscripción. Pagas una vez, por el tamaño del torneo, y las
        inscripciones las cobras tú con tu pasarela: TACTIUM no se queda comisión. Si ya
        tienes plan de club, tus torneos van incluidos hasta el tope de tu plan.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {TOURNAMENT_TIERS.map((t) => (
          <Card key={t.pairs}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Hasta <span className="mono">{t.pairs}</span> parejas
            </div>
            <div
              className="mono"
              style={{
                marginTop: 8,
                fontSize: 26,
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

      <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
        Por encima del tramo se suman{" "}
        <span className="mono">{TOURNAMENT_EXTRA_PAIR_EUR} €</span> por pareja.
      </p>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Btn>Canjear código</Btn>
        <Btn variant="quiet">Continuar gratis</Btn>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
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

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
