"use client";

import { ANNUAL_SAVING_TEXT, INSCRIPTION_MONEY_TEXT } from "@/lib/public-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { CAPTAIN_PLAN, CLUB_PLANS, TRIAL_DURATION_DAYS, formatEur, type Plan } from "@/lib/plans";
import { vatNote } from "@/lib/tax";
import { TOURNAMENT_TIERS, TOURNAMENT_EXTRA_PAIR_EUR } from "@/lib/tournament-billing";
import { useSession } from "@/lib/session";
import { fetchHadTrial, fetchTrialSubscription } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { SIGNUP_HREF } from "@/lib/nav";
import { Btn, Card, Chip, Eyebrow, PageHeader, SectionHead } from "@/components/ui";
import { Toast } from "@/components/states";
import { IconCheck, IconLock } from "@/components/Icon";
import { CountUp, EASE, Stagger, StaggerItem } from "@/components/entry/motion-bits";
import { RedeemCode } from "./RedeemCode";

type Cycle = "monthly" | "yearly";
type Family = "capitan" | "club";

/* ── Motivos: por qué se abre el paywall ─────────────────────────────
   Mismos textos que la app (tabla del rediseño de entrada). `club_import` es
   nuevo de la web: el importador de equipos del club. */
const MOTIVOS: Record<string, { title: string; sub: string }> = {
  matchday_close: {
    title: "Cerrar la jornada es Pro",
    sub: "El acta y los resultados quedan para todo el equipo",
  },
  lineup_edit: {
    title: "Las alineaciones son Pro",
    sub: "Parejas por puntos en 5 variantes, en 90 segundos",
  },
  lineup_confirm: {
    title: "Las alineaciones son Pro",
    sub: "Parejas por puntos en 5 variantes, en 90 segundos",
  },
  calendar_scan: {
    title: "Escanear el calendario es Pro",
    sub: "Una foto y tienes toda la temporada en la agenda",
  },
  availability_remind: {
    title: "Recordar a los pendientes es Pro",
    sub: "Un toque y les llega el aviso, sin perseguir a nadie",
  },
  time_poll: {
    title: "La encuesta de hora es Pro",
    sub: "Propón horas, el equipo vota y la fijas con un toque",
  },
  roster_import: {
    title: "Importar la plantilla es Pro",
    sub: "Todos los jugadores con sus puntos oficiales",
  },
  club_import: {
    title: "Importar los equipos del club es Pro",
    sub: "Todos tus equipos de la federación, con su plantilla y sus puntos",
  },
  fcp_group: {
    title: "Tu grupo de la Federación es Pro",
    sub: "Clasificación, jornadas y actas de tu grupo, al día",
  },
};

const BENEFITS: Record<Family, string[]> = {
  capitan: [
    "Convocatoria con Voy/Duda/No y recordatorios",
    "Parejas por puntos, en 5 variantes",
    "Calendario y plantilla desde la federación",
    "Acta, resultados y clasificación con zonas",
  ],
  club: [
    "Todos tus equipos en un panel",
    "Los capitanes no pagan",
    "Torneos incluidos según el plan",
    "Horarios de pista y rejilla",
  ],
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const DAY = 86400000;

/**
 * Paywall web (Stripe).
 *
 * ⚠️ RESTRICCIÓN FIRME DE DISEÑO, no una preferencia estética:
 * el importe REALMENTE FACTURADO es siempre el precio más prominente. El
 * equivalente mensual de un plan anual va pequeño y debajo. Apple rechazó la
 * build 1.0(8) por invertir esa jerarquía (motivo 3.1.2c) y la regla se
 * mantiene en todas las superficies para que el mensaje sea el mismo.
 *
 * Qué cobra el checkout (`app/api/subscription/checkout`):
 *   · quien ya tuvo la prueba sin tarjeta (`trial_*`, en curso o gastada)
 *     paga desde el primer día: no hay otra prueba de Stripe;
 *   · quien nunca la tuvo recibe 14 días de prueba de Stripe.
 * Los textos de abajo dicen exactamente eso.
 */
export function Paywall({
  motivo,
  para,
}: {
  /** Gate que abrió el paywall (`?motivo=`). */
  motivo?: string;
  /** Familia de planes (`?para=`). Sin él: club si el rol es de club. */
  para?: Family;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const yearly = cycle === "yearly";

  const { user, role, clubId, clubs, activeTeam, ready } = useSession();
  const [family, setFamily] = useState<Family>(para ?? "capitan");
  // Sin `?para=`, la familia la decide el rol en cuanto se conoce.
  useEffect(() => {
    if (!para && ready) setFamily(role === "club" ? "club" : "capitan");
  }, [para, ready, role]);

  const isClub = family === "club";
  const plans: Plan[] = isClub ? CLUB_PLANS : [CAPTAIN_PLAN];
  const [tier, setTier] = useState<Plan["tier"]>("club_pro");
  const plan = isClub ? (CLUB_PLANS.find((p) => p.tier === tier) ?? CLUB_PLANS[1]) : CAPTAIN_PLAN;

  // El pagador: el club para los planes de club; el propio usuario para el de capitán.
  const subjectType: "user" | "club" = isClub ? "club" : "user";
  const subjectId = isClub ? clubId : (user?.id ?? null);
  const trialQ = useAsync(
    () => fetchTrialSubscription(subjectType, subjectId!),
    [subjectType, subjectId],
    !!subjectId,
  );
  const hadQ = useAsync(() => fetchHadTrial(subjectType, subjectId!), [subjectType, subjectId], !!subjectId);
  const trial = subjectId ? trialQ.data : null;
  const hadTrial = subjectId ? !!hadQ.data : false;

  const trialEnd = trial ? new Date(trial.currentPeriodEnd) : null;
  const daysLeft =
    trialEnd && !Number.isNaN(trialEnd.getTime())
      ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / DAY))
      : null;

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Contrata el plan elegido: abre Stripe Checkout. El importe lo calcula el
  // servidor desde plans.ts.
  async function subscribe() {
    if (busy) return;
    if (!user) {
      window.location.href = SIGNUP_HREF;
      return;
    }
    if (isClub && !clubId) {
      router.push("/empezar/club");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isClub
            ? { tier: plan.tier, cycle, subjectType: "club", subjectId: clubId }
            : { tier: plan.tier, cycle, subjectType: "user" },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setToast(data.error ?? "No se pudo iniciar el pago.");
    } catch {
      setToast("No se pudo conectar con la pasarela de pago.");
    } finally {
      setBusy(false);
    }
  }

  function continueFree() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const billed = yearly ? plan.priceYearlyEur : plan.priceMonthlyEur;
  const per = yearly ? "año" : "mes";

  /* ── Línea de contexto (motivo) ── */
  let context: { title: string; sub?: string } | null = null;
  if (motivo === "trial_expiring") {
    if (daysLeft !== null)
      context = {
        title: daysLeft === 0 ? "Tu prueba acaba hoy" : `Tu prueba acaba en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`,
      };
  } else if (motivo && MOTIVOS[motivo]) {
    context = MOTIVOS[motivo];
  }

  /* ── Botón y nota según lo que hace de verdad el cobro ── */
  let ctaLabel: string;
  let ctaNote: ReactNode;
  if (!user) {
    ctaLabel = `Crear cuenta · ${TRIAL_DURATION_DAYS} días gratis`;
    ctaNote = "La prueba empieza al crear tu equipo o tu club. Sin tarjeta.";
  } else if (isClub && !clubId) {
    ctaLabel = "Crear mi club";
    ctaNote = "El plan se contrata a nombre del club. Créalo primero: tiene 14 días de prueba sin tarjeta.";
  } else if (trial) {
    ctaLabel = `Seguir con Pro · ${formatEur(billed)}/${per}`;
    ctaNote = "Se cobra al confirmar. Si prefieres, te avisamos el día 11 y decides entonces.";
  } else {
    // La única prueba es la nuestra sin tarjeta, al crear el equipo o el club.
    // Suscribirse cobra desde el primer día, igual que en las tiendas.
    ctaLabel = `Suscribirme · ${formatEur(billed)}/${per}`;
    ctaNote = `Se cobra al confirmar. Renovación automática ${yearly ? "anual" : "mensual"}; cancela cuando quieras.`;
  }
  // «Cómo va la prueba» solo a quien aún puede empezarla: sin cuenta, o sin el
  // club al que irá el plan.
  const showTrialPromo = !trial && !hadTrial && (!user || (isClub && !clubId));

  return (
    <div className="tw-page-narrow">
      <Stagger gap={0.07} style={{ display: "grid", gap: 16 }}>
        {context && (
          <StaggerItem>
            <ContextLine title={context.title} sub={context.sub} />
          </StaggerItem>
        )}

        <StaggerItem>
          {trial && daysLeft !== null && trialEnd ? (
            <TrialHero
              daysLeft={daysLeft}
              end={trialEnd}
              who={isClub ? (clubs.find((c) => c.id === clubId)?.name ?? null) : (activeTeam?.name ?? null)}
            />
          ) : (
            <PageHeader
              title={isClub ? "Tu club cubre a sus equipos" : "Deja el Excel y el grupo de mensajes"}
              lede={isClub ? "Los capitanes no pagan." : "Tus jugadores no pagan."}
            />
          )}
        </StaggerItem>

        {!trial && (
          <StaggerItem>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "10px 20px",
              }}
            >
              {BENEFITS[family].map((b) => (
                <li key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
                  <span style={{ color: "var(--accent)", display: "flex", flex: "none", marginTop: 2 }}>
                    <IconCheck size={15} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
              Hecho con capitanes de la Liga Cántabra
            </p>
          </StaggerItem>
        )}

        <StaggerItem>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CycleToggle value={cycle} onChange={setCycle} />
            <Chip tone="accent">Anual {ANNUAL_SAVING_TEXT}</Chip>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div
            role={isClub ? "radiogroup" : undefined}
            aria-label={isClub ? "Plan de club" : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: isClub ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "stretch",
            }}
          >
            {plans.map((p) => (
              <PlanCard
                key={p.tier}
                plan={p}
                yearly={yearly}
                selected={p.tier === plan.tier}
                selectable={isClub}
                onSelect={() => setTier(p.tier)}
                reduce={!!reduce}
              />
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button
              type="button"
              className="link-action"
              onClick={() => setFamily(isClub ? "capitan" : "club")}
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
            >
              {isClub ? "¿Llevas un solo equipo? Ver el plan Capitán" : "¿Llevas varios equipos? Ver planes de club"}
            </button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <Btn variant="accent" size="lg" block disabled={busy} onClick={subscribe}>
              {busy ? "Abriendo pago…" : ctaLabel}
            </Btn>
            <p
              style={{
                margin: "10px 0 0",
                textAlign: "center",
                fontSize: 12.5,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              {ctaNote}
            </p>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <RedeemCode />
              <Btn variant="quiet" onClick={continueFree}>
                Continuar gratis
              </Btn>
            </div>
          </Card>
        </StaggerItem>

        {showTrialPromo && (
          <StaggerItem>
            <TrialHowItWorks />
          </StaggerItem>
        )}

        {/* ── Torneos ────────────────────────────────────────────────
            Carril aparte: hasta 16 parejas es gratis y el resto se paga por
            torneo. No hace falta suscripción. */}
        <StaggerItem>
          <SectionHead title="¿Solo quieres montar un torneo?" style={{ marginTop: 12 }} />
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13.5,
              color: "var(--text-muted)",
              maxWidth: "62ch",
              textWrap: "pretty",
            }}
          >
            No hace falta suscripción: pagas una vez, por el tamaño del torneo.{" "}
            {INSCRIPTION_MONEY_TEXT} Si ya tienes plan de club, tus torneos van incluidos
            hasta el tope de tu plan.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
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
                    fontSize: 24,
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
        </StaggerItem>

        <StaggerItem>
          <div
            style={{
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              fontSize: 12.5,
              color: "var(--text-faint)",
              flexWrap: "wrap",
            }}
          >
            <span>Cancela cuando quieras</span>
            <span aria-hidden="true">·</span>
            <Link href="/legal/terminos" style={{ color: "inherit" }}>
              Términos
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/legal/privacidad" style={{ color: "inherit" }}>
              Privacidad
            </Link>
          </div>
        </StaggerItem>
      </Stagger>

      {toast && <Toast tone="error" title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Línea de contexto: por qué estás aquí ─────────────────────────── */
function ContextLine({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--r-lg)",
        background: "var(--warning-soft)",
        border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
      }}
    >
      <span
        className="tile-icon"
        style={{ background: "color-mix(in srgb, var(--warning) 22%, transparent)", color: "var(--warning)" }}
      >
        <IconLock size={16} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{title}</span>
        {sub && (
          <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

/* ── Selector Mensual / Anual con indicador deslizante ────────────── */
function CycleToggle({ value, onChange }: { value: Cycle; onChange: (c: Cycle) => void }) {
  const reduce = useReducedMotion();
  const opts: { value: Cycle; label: string }[] = [
    { value: "monthly", label: "Mensual" },
    { value: "yearly", label: "Anual" },
  ];
  return (
    <div className="seg" role="radiogroup" aria-label="Ciclo de facturación">
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="seg-item"
            style={{
              position: "relative",
              color: on ? "var(--text)" : undefined,
              fontWeight: on ? 700 : undefined,
            }}
          >
            {on && (
              <motion.span
                layoutId="pw-cycle-pill"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 7,
                  background: "var(--bg-card)",
                  boxShadow: "var(--shadow-sm), inset 0 0 0 1px var(--line-strong)",
                }}
              />
            )}
            <span style={{ position: "relative" }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Tarjeta de plan ──────────────────────────────────────────────── */
function PlanCard({
  plan,
  yearly,
  selected,
  selectable,
  onSelect,
  reduce,
}: {
  plan: Plan;
  yearly: boolean;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  reduce: boolean;
}) {
  const vat = vatNote(plan.tier);
  const isCaptain = plan.tier === "captain";
  const summary = isCaptain
    ? "1 equipo · tus jugadores no pagan"
    : `${plan.teamQuota} equipos · torneos hasta ${plan.tournamentPairCap} parejas`;

  return (
    <motion.button
      type="button"
      role={selectable ? "radio" : undefined}
      aria-checked={selectable ? selected : undefined}
      onClick={onSelect}
      animate={reduce ? undefined : { scale: selected && selectable ? 1.015 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className="card"
      style={{
        padding: 18,
        textAlign: "left",
        cursor: selectable ? "pointer" : "default",
        color: "var(--text)",
        fontFamily: "var(--font-ui)",
        display: "flex",
        flexDirection: "column",
        borderColor: selected ? "var(--accent-40)" : undefined,
        background: selected
          ? "linear-gradient(160deg, var(--accent-10) 0%, var(--bg-card) 70%)"
          : undefined,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%" }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{plan.displayName}</span>
        {plan.featured && <Chip tone="solid">Más elegido</Chip>}
      </span>
      <span style={{ marginTop: 4, fontSize: 12.5, color: "var(--text-muted)" }}>{summary}</span>

      {/* Importe facturado — el precio dominante (requisito de Apple). */}
      <span style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
          {formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {yearly ? "al año" : "al mes"}
          {vat ? ` · ${vat}` : ""}
        </span>
      </span>
      {/* Equivalente mensual — secundario, pequeño y debajo. */}
      {yearly && (
        <span style={{ marginTop: 6, fontSize: 12, color: "var(--text-faint)" }}>
          equivale a <span className="mono">{formatEur(plan.priceYearlyEur / 12)}</span> al mes
        </span>
      )}

      <span className="divider" style={{ margin: "14px 0", width: "100%" }} />

      <span style={{ display: "grid", gap: 8 }}>
        {plan.features.map((f) => (
          <span key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: "var(--accent)", display: "flex", flex: "none", marginTop: 1 }}>
              <IconCheck size={14} />
            </span>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{f}</span>
          </span>
        ))}
      </span>
    </motion.button>
  );
}

/* ── Prueba en curso: días que quedan y línea de tiempo real ──────── */
function TrialHero({ daysLeft, end, who }: { daysLeft: number; end: Date; who: string | null }) {
  const start = new Date(end.getTime() - TRIAL_DURATION_DAYS * DAY);
  const notice = new Date(end.getTime() - 3 * DAY);
  const today = new Date();
  const steps: { at: Date; label: string; text: string; now?: boolean }[] = [
    { at: start, label: `Día 1 · ${shortDate(start)}`, text: who ? `Creaste ${who}. Pro completo.` : "Empieza tu prueba. Pro completo." },
    { at: today, label: `Hoy · ${shortDate(today)}`, text: `Te ${daysLeft === 1 ? "queda 1 día" : `quedan ${daysLeft} días`} de Pro`, now: true },
    { at: notice, label: `Día 11 · ${shortDate(notice)}`, text: "Te avisamos con 3 días de margen" },
    { at: end, label: `Día ${TRIAL_DURATION_DAYS} · ${shortDate(end)}`, text: "Pasas al plan gratis si no eliges" },
  ];
  steps.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div>
      <Eyebrow tone="accent">Tu prueba</Eyebrow>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <CountUp to={daysLeft} className="mono" style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color: "var(--accent)" }} />
        <h1 style={{ margin: 0 }}>{daysLeft === 1 ? "día de Pro gratis" : "días de Pro gratis"}</h1>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)", maxWidth: "60ch" }}>
        Sin tarjeta. Cuando acabe no se cobra nada: eliges plan o sigues gratis.
      </p>
      <Timeline
        items={steps.map((s) => ({
          label: s.label,
          text: s.text,
          state: s.now ? "now" : s.at.getTime() <= today.getTime() ? "done" : "next",
        }))}
      />
    </div>
  );
}

/* ── Cómo va la prueba (quien aún no la ha usado) ─────────────────── */
function TrialHowItWorks() {
  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700 }}>Cómo va la prueba</div>
      <Timeline
        items={[
          { label: "Hoy", text: "Pro completo, sin tarjeta", state: "now" },
          { label: "Día 11", text: "Te avisamos", state: "next" },
          { label: `Día ${TRIAL_DURATION_DAYS}`, text: "Eliges plan o sigues gratis", state: "next" },
        ]}
      />
      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
        Empieza al crear tu equipo o tu club.
      </p>
    </Card>
  );
}

/** Línea de tiempo vertical que se dibuja al entrar. */
function Timeline({
  items,
}: {
  items: { label: string; text: string; state: "done" | "now" | "next" }[];
}) {
  const reduce = useReducedMotion();
  return (
    <ol style={{ listStyle: "none", margin: "16px 0 8px", padding: "0 0 0 24px", position: "relative" }}>
      <motion.span
        aria-hidden="true"
        initial={reduce ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
        style={{
          position: "absolute",
          left: 7,
          top: 8,
          bottom: 14,
          width: 2,
          borderRadius: 1,
          transformOrigin: "top center",
          background: "linear-gradient(var(--accent), var(--line-strong))",
        }}
      />
      {items.map((it, i) => (
        <motion.li
          key={it.label}
          initial={reduce ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: EASE, delay: 0.25 + i * 0.12 }}
          style={{ position: "relative", padding: "2px 0 12px" }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: -22,
              top: 6,
              width: 12,
              height: 12,
              borderRadius: 999,
              background: it.state === "now" ? "var(--accent)" : "var(--bg-card)",
              border: `2px solid ${it.state === "next" ? "var(--text-faint)" : "var(--accent)"}`,
            }}
          />
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{it.label}</span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>{it.text}</span>
        </motion.li>
      ))}
    </ol>
  );
}
