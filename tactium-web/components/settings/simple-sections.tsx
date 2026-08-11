"use client";

import Link from "next/link";
import { useState } from "react";

import {
  FREE_PLAYERS,
  initials,
  ACCOUNT_EMAIL,
} from "@/lib/account-data";
import { ALL_PLANS, formatEur } from "@/lib/plans";
import { fetchSubscription } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconFile,
  IconMail,
  IconPlus,
  IconSearch,
  IconShield,
  IconTicket,
  IconTrophy,
} from "@/components/Icon";

/* ═══ MI JUGADOR ══════════════════════════════════════════════════ */
export function MiJugador() {
  const [linked, setLinked] = useState<string | null>(null);

  return (
    <Card>
      <Eyebrow>MI JUGADOR</Eyebrow>
      <h2 style={{ margin: "14px 0 6px", fontSize: 24 }}>
        {linked ? "Ya estás vinculado" : "Aún no estás vinculado"}
      </h2>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 13.5,
          color: "var(--text-muted)",
          maxWidth: "52ch",
          textWrap: "pretty",
        }}
      >
        {linked
          ? `Eres ${linked} en la plantilla. Tus partidos ya cuentan en tus estadísticas.`
          : "Vincúlate a un jugador de la plantilla para marcar tu disponibilidad y que tus partidos cuenten en tus estadísticas."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FREE_PLAYERS.map((p) => {
          const active = linked === p.name;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => setLinked(active ? null : p.name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 15px",
                borderRadius: 12,
                background: "var(--bg-card-2)",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
                border: `1.5px solid ${
                  active ? "var(--accent)" : "transparent"
                }`,
                transition: "all var(--dur-fast) var(--ease)",
              }}
            >
              <span
                className="mono"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: "var(--primary-dim)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  flex: "none",
                }}
              >
                {initials(p.name)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{ display: "block", fontSize: 14, fontWeight: 700 }}
                >
                  {p.name}
                </span>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    color: "var(--text-faint)",
                  }}
                >
                  {p.meta}
                </span>
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  color: "var(--accent)",
                }}
              >
                {active ? "VINCULADO" : "VINCULAR"}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ═══ EQUIPO ACTUAL ═══════════════════════════════════════════════ */
export function EquipoActual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <Eyebrow>EQUIPO ACTUAL</Eyebrow>
        <button
          type="button"
          style={{
            marginTop: 20,
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 16,
            borderRadius: 12,
            border: "1px solid var(--hair-strong)",
            background: "var(--bg-card-2)",
            color: "var(--text)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "var(--primary-dim)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <IconShield size={19} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>
              Halcones A
            </span>
            <span
              className="mono"
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: "var(--text-faint)",
              }}
            >
              1ª MASCULINA · CLUB HALCONES
            </span>
          </span>
          <span style={{ color: "var(--text-faint)", display: "flex" }}>
            <IconChevronDown size={16} />
          </span>
        </button>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid var(--hair-strong)",
            color: "var(--text-muted)",
          }}
        >
          <IconCalendar size={16} />
          <span style={{ fontSize: 13 }}>Sin temporada activa</span>
        </div>
      </Card>

      <Card
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            Crear un equipo o club
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            ¿Todavía no gestionas ninguno? Empieza aquí.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          Crear
        </button>
      </Card>
    </div>
  );
}

/* ═══ INVITACIONES ════════════════════════════════════════════════ */
export function Invitaciones() {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const INVITE = "HLC-4X2";

  async function copy() {
    try {
      await navigator.clipboard.writeText(INVITE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Sin permiso de portapapeles: el código se ve y se puede copiar a mano. */
    }
  }

  return (
    <Card>
      <Eyebrow>INVITACIONES</Eyebrow>
      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        <div
          style={{
            padding: 22,
            borderRadius: 12,
            background: "var(--bg-card-2)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Invitar jugadores</div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            Genera un código para que se unan a Halcones A.
          </div>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--bg-card)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "var(--accent)",
              }}
            >
              {INVITE}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label="Copiar código de invitación"
              style={{
                border: "none",
                background: "transparent",
                color: copied ? "var(--accent)" : "var(--text-faint)",
                cursor: "pointer",
                display: "flex",
                padding: 4,
              }}
            >
              <IconCopy size={16} />
            </button>
          </div>
          <div
            className="mono"
            aria-live="polite"
            style={{
              marginTop: 10,
              fontSize: 9.5,
              letterSpacing: "0.16em",
              color: copied ? "var(--accent)" : "transparent",
            }}
          >
            {copied ? "COPIADO" : "·"}
          </div>
        </div>

        <div
          style={{
            padding: 22,
            borderRadius: 12,
            background: "var(--bg-card-2)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Unirme con código</div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            ¿Te han pasado uno? Úsalo aquí.
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC-123"
              aria-label="Código de invitación"
              className="mono"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "13px 15px",
                borderRadius: 12,
                border: "1px solid var(--hair-strong)",
                background: "var(--bg-card)",
                color: "var(--text)",
                fontSize: 14,
                letterSpacing: "0.18em",
                outline: "none",
              }}
            />
            <button
              type="button"
              className="btn btn-accent"
              disabled={code.trim().length < 3}
              style={{
                padding: "13px 20px",
                fontSize: 13.5,
                borderRadius: 12,
              }}
            >
              Unirme
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ═══ SUSCRIPCIÓN · resumen ═══════════════════════════════════════ */
export function SuscripcionResumen() {
  // Datos reales: antes pintaba el plan de maqueta (10 equipos a 29,99 €,
  // que no es ningun plan que exista) para cualquier usuario.
  const { data, loading } = useAsync(() => fetchSubscription(), []);
  const plan = ALL_PLANS.find((p) => p.tier === data?.planTier) ?? null;
  const yearly = data?.billingPeriod === 'yearly';
  const renews = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
      })
    : null;

  return (
    <Card>
      <Eyebrow>SUSCRIPCIÓN</Eyebrow>
      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: 20,
          borderRadius: 12,
          background: "var(--bg-card-2)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {loading ? '…' : (plan?.displayName ?? 'Plan gratuito')}
            </span>
            <span className="chip">
              {!plan ? 'SIN PLAN' : data?.status === 'trialing' ? 'EN PRUEBA' : 'ACTIVA'}
            </span>
          </div>
          <div
            className="mono"
            style={{
              marginTop: 8,
              fontSize: 12,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
            }}
          >
            {plan
              ? [
                  formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur) +
                    (yearly ? "/año" : "/mes"),
                  renews ? `renueva el ${renews}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Sin renovación · sin cobros"}
          </div>
        </div>
        <Link
          href="/suscripcion"
          className="btn btn-ghost"
          style={{ padding: "11px 20px", fontSize: 13.5, flex: "none" }}
        >
          Gestionar plan
        </Link>
      </div>
    </Card>
  );
}

/* ═══ TORNEOS ═════════════════════════════════════════════════════ */
const TOURNEY_LINKS = [
  { label: "Mis torneos", Icon: IconTrophy, href: "/torneos?tab=mios" },
  { label: "Explorar torneos", Icon: IconSearch, href: "/torneos" },
  { label: "Crear torneo", Icon: IconPlus, href: "/club/torneos/nuevo" },
  { label: "Entrar con código", Icon: IconTicket, href: "/torneos?codigo=1" },
];

export function Torneos() {
  return (
    <Card>
      <Eyebrow>TORNEOS</Eyebrow>
      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {TOURNEY_LINKS.map(({ label, Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="btn btn-ghost"
            style={{
              justifyContent: "flex-start",
              padding: "16px 18px",
              borderRadius: 12,
              fontSize: 13.5,
            }}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ═══ SOPORTE ═════════════════════════════════════════════════════ */
export function Soporte() {
  return (
    <Card>
      <Eyebrow>SOPORTE</Eyebrow>
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 0",
            borderBottom: "1px solid var(--hair)",
          }}
        >
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            <IconMail size={17} />
          </span>
          <span style={{ flex: 1, fontSize: 14 }}>Escríbenos</span>
          <a
            href={`mailto:hola@tactium.io?subject=Soporte%20TACTIUM&body=%0A%0A---%0ACuenta%3A%20${encodeURIComponent(
              ACCOUNT_EMAIL
            )}`}
            className="mono"
            style={{ fontSize: 12, letterSpacing: "0.06em" }}
          >
            hola@tactium.io
          </a>
        </div>

        <Link
          href="/legal/terminos"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 0",
            borderBottom: "1px solid var(--hair)",
            color: "var(--text)",
          }}
        >
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            <IconFile size={17} />
          </span>
          <span style={{ flex: 1, fontSize: 14 }}>Términos del servicio</span>
          <span style={{ color: "var(--text-faint)", display: "flex" }}>
            <IconChevronRight size={15} />
          </span>
        </Link>

        <Link
          href="/legal/privacidad"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 0",
            color: "var(--text)",
          }}
        >
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            <IconShield size={17} />
          </span>
          <span style={{ flex: 1, fontSize: 14 }}>Política de privacidad</span>
          <span style={{ color: "var(--text-faint)", display: "flex" }}>
            <IconChevronRight size={15} />
          </span>
        </Link>
      </div>
    </Card>
  );
}
