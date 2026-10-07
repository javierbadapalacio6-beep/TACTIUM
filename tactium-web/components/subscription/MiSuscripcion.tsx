"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import {
  isStoreManaged,
  sourceLabel,
  storeName,
  type Subscription,
  type SubscriptionSource,
} from "@/lib/account-data";
import { fetchSubscription, type DbSubscription } from "@/lib/queries";
import {
  fetchClubCoveredCount,
  fetchClubSubscription,
  fetchMyDbTrialEnd,
  fetchTeamPro,
} from "@/lib/account-queries";
import { ALL_PLANS, TRIAL_DURATION_DAYS, formatEur } from "@/lib/plans";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Btn, BtnLink, Card, CardHead, Chip, Note, PageHeader, Progress } from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import { CountUp, EASE } from "@/components/entry/motion-bits";
import { RedeemCode } from "./RedeemCode";
import {
  CAPTAIN_SEATS,
  captainFirstNames,
  fetchAllTeamCaptainCoverage,
  formatCoverDate,
} from "@/lib/team-captains";
import { IconCheck, IconClock, IconLock } from "@/components/Icon";

/** Ayuda oficial para gestionar una suscripción de tienda (antes el enlace
 *  apuntaba a /ayuda/suscripcion-tienda, que no existe). */
const STORE_HELP: Record<string, string> = {
  app_store: "https://support.apple.com/es-es/118428",
  play_store: "https://support.google.com/googleplay/answer/7018481?hl=es",
};
const DAY = 86400000;
const shortDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/**
 * Mi suscripción.
 *
 * ── LA REGLA QUE PROTEGE EL NEGOCIO ────────────────────────────────
 * Una misma cuenta puede tener la suscripción comprada en la web (Stripe) o en
 * una tienda móvil (App Store / Google Play). La web SÓLO puede vender y
 * gestionar lo que es suyo. Con una compra de tienda:
 *   · no se muestra ningún botón de contratar, cambiar plan ni cancelar
 *   · la tarjeta queda en solo lectura con el aviso de dónde se gestiona
 * Saltarse esto es lo que produce suscripciones y cobros duplicados.
 *
 * Los datos son REALES: salen de `subscriptions` vía `fetchSubscription()`.
 * Antes esta pantalla tenía un selector de casos de maqueta con precios
 * inventados (el plan de 10 equipos ponía 29,99 € cuando cobra 24,99 €).
 */

/** De dónde viene la compra, según la plataforma que guardó el webhook. */
function sourceOf(platform: string | null | undefined): SubscriptionSource {
  if (platform === "stripe" || platform === "web") return "stripe";
  if (platform === "ios" || platform === "app_store") return "app_store";
  if (platform === "android" || platform === "play_store") return "play_store";
  return "none";
}

const STATE_LABEL: Record<string, string> = {
  trialing: "En prueba",
  active: "Activa",
  grace_period: "Pago pendiente",
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

/**
 * «Próximo cobro: 1 de octubre de 2026 · 47,99 €», con lo que ya hay en la
 * fila (fin del periodo y precio del plan en `plans.ts`). Null si no va a
 * haber cobro: sin plan, sin fecha o con la baja ya pedida.
 */
function nextChargeLine(row: DbSubscription | null): string | null {
  if (!row || row.cancelAtPeriodEnd || !row.currentPeriodEnd) return null;
  // La prueba sin tarjeta (fila `trial_*`, sin pasarela) no cobra nada al
  // acabar: solo hay cobro si la compra es de la web o de una tienda.
  if (sourceOf(row.platform) === "none") return null;
  const plan = ALL_PLANS.find((p) => p.tier === row.planTier);
  if (!plan) return null;
  const amount = formatEur(
    row.billingPeriod === "yearly" ? plan.priceYearlyEur : plan.priceMonthlyEur,
  );
  const label = row.status === "trialing" ? "Primer cobro" : "Próximo cobro";
  return `${label}: ${fmtDate(row.currentPeriodEnd)} · ${amount}`;
}

/** Traduce la fila de la base de datos a lo que pinta la pantalla. */
function toSubscription(row: DbSubscription | null): Subscription {
  if (!row) {
    return {
      source: "none",
      planName: "Plan gratuito",
      state: "Sin plan",
      price: "0 €",
      period: "al mes",
      renewNote: "Sin renovación · sin cobros",
    };
  }
  const plan = ALL_PLANS.find((p) => p.tier === row.planTier);
  const yearly = row.billingPeriod === "yearly";
  const scheduled = row.scheduledPlanTier
    ? ALL_PLANS.find((p) => p.tier === row.scheduledPlanTier)
    : null;

  return {
    source: sourceOf(row.platform),
    planName: plan?.displayName ?? row.planTier,
    state: STATE_LABEL[row.status] ?? row.status,
    price: plan
      ? formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)
      : "—",
    period: yearly ? "al año" : "al mes",
    // Con la baja programada no hay renovación ni primer cobro: decir lo
    // contrario es prometer un cargo que no va a llegar.
    renewNote: row.cancelAtPeriodEnd
      ? `No se renovará · termina el ${fmtDate(row.currentPeriodEnd)}`
      : row.status === "trialing"
        ? `Primer cobro el ${fmtDate(row.currentPeriodEnd)}`
        : `Próxima renovación · ${fmtDate(row.currentPeriodEnd)}`,
    ...(scheduled
      ? {
          scheduledPlan: {
            name: scheduled.displayName,
            date: fmtDate(row.currentPeriodEnd),
          },
        }
      : null),
  };
}

/**
 * Una «Mi suscripción» por rol (igual que la app): el jugador no compra nada,
 * el club va a su facturación y el capitán ve su plan (con la prueba sin
 * tarjeta, si la tiene, contada como en el paywall).
 */
export function MiSuscripcion() {
  const { role, ready } = useSession();
  if (!ready) return <SkeletonPage />;
  if (role === "jugador") return <PlayerCoverage />;
  if (role === "club") return <ClubSummary />;
  return <CaptainSubscription />;
}

function CaptainSubscription() {
  const { data, loading, error } = useAsync(() => fetchSubscription(), []);
  const { data: trialEnd } = useAsync(() => fetchMyDbTrialEnd(), []);
  // Plan Capitán compartido (hasta 3 capitanes por equipo independiente; un
  // plan cubre UN solo equipo, que puede no ser el activo).
  const { activeTeam, user, teams: myTeams } = useSession();
  const covTeam = activeTeam && !activeTeam.clubId ? activeTeam : null;
  const { data: covRows } = useAsync(
    () => fetchAllTeamCaptainCoverage().catch(() => []),
    [user?.id],
    !!user,
  );
  const cov = covTeam ? covRows?.find((r) => r.team_id === covTeam.id) ?? null : null;
  const myPlanCov = covRows?.find((r) => r.covered && r.payer_user_id === user?.id) ?? null;
  const myPlanTeamName = myPlanCov
    ? myTeams.find((t) => t.id === myPlanCov.team_id)?.name ?? null
    : null;
  const sub = toSubscription(data);
  const nextCharge = nextChargeLine(data);
  const [portalBusy, setPortalBusy] = useState(false);

  // Abre el portal de facturación de Stripe (cancelar, método de pago, facturas).
  async function openPortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await fetch("/api/subscription/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      alert(body.error ?? "No se pudo abrir la gestión de la suscripción.");
    } catch {
      alert("No se pudo conectar con la pasarela de pago.");
    } finally {
      setPortalBusy(false);
    }
  }

  if (loading) return <SkeletonPage />;

  const storeManaged = isStoreManaged(sub.source);
  const webManaged = sub.source === "stripe";
  const noPlan = sub.source === "none";
  const iPayTeam = !!myPlanCov && !!myPlanTeamName && data?.planTier === "captain";
  const mates = myPlanCov ? captainFirstNames(myPlanCov.captains, user?.id) : [];
  const coveredByMate = noPlan && !!cov?.covered && cov.payer_user_id !== user?.id;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Mi suscripción"
        lede="Tu plan, de dónde viene y qué puedes hacer con él desde aquí."
      />

      {error && (
        <Note tone="error" style={{ marginBottom: 16 }}>
          No se ha podido leer tu suscripción: {error}
        </Note>
      )}

      {trialEnd && <DbTrialHero endIso={trialEnd} />}

      {coveredByMate && cov && covTeam && (
        <Note tone="accent" icon={<IconCheck size={16} />} style={{ marginBottom: 16 }}>
          <span style={{ display: "block", fontWeight: 700, color: "var(--text)" }}>
            Te cubre el plan de {cov.payer_name?.split(/\s+/)[0] ?? "otro capitán"}
          </span>
          <span style={{ display: "block", marginTop: 4 }}>
            Tienes Pro en {covTeam.name} hasta{" "}
            <span className="mono">{formatCoverDate(cov.period_end)}</span>, sin pagar nada. El plan
            Capitán cubre a los {CAPTAIN_SEATS} capitanes del equipo; en otro equipo necesitarías tu
            propio plan.
          </span>
        </Note>
      )}

      {/* Cambio de plan diferido: Apple/Google aplican los downgrades al
          final del ciclo, así que se anuncia de forma persistente. */}
      {sub.scheduledPlan && (
        <Note tone="accent" icon={<IconClock size={16} />} style={{ marginBottom: 16 }}>
          Pasarás a <strong style={{ fontWeight: 700 }}>{sub.scheduledPlan.name}</strong> el{" "}
          <span className="mono">{sub.scheduledPlan.date}</span>
        </Note>
      )}

      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ fontSize: 20 }}>{sub.planName}</h2>
              <Chip tone={noPlan ? "mute" : "accent"}>{sub.state}</Chip>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}
              >
                {sub.price}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {sub.period}
              </span>
            </div>
            {nextCharge && (
              <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-muted)" }}>
                {nextCharge}
              </div>
            )}
            {iPayTeam && myPlanTeamName && (
              <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-muted)" }}>
                {mates.length > 0
                  ? `Cubre a los capitanes de ${myPlanTeamName}: ${mates.join(", ")}`
                  : `Cubre a ${myPlanTeamName} y hasta ${CAPTAIN_SEATS - 1} capitanes más`}
                {" · "}
                <Link href="/equipo">Gestionar capitanes</Link>
              </div>
            )}
          </div>

          <Chip tone="mute" plain style={{ flex: "none" }}>
            {sourceLabel(sub.source)}
          </Chip>
        </div>

        <div className="divider" />

        <dl className="kv">
          <dt>Renovación</dt>
          <dd>{sub.renewNote}</dd>
          {sub.scheduledPlan && (
            <>
              <dt>Cambio programado</dt>
              <dd>
                {sub.scheduledPlan.name} · {sub.scheduledPlan.date}
              </dd>
            </>
          )}
          <dt>Se gestiona en</dt>
          <dd>{sourceLabel(sub.source)}</dd>
        </dl>

        {/* CASO C · solo lectura. Ni un botón de compra. */}
        {storeManaged && (
          <>
            <Note icon={<IconLock size={16} />} style={{ marginTop: 18 }}>
              <span style={{ display: "block", fontWeight: 700, color: "var(--text)" }}>
                Gestionas tu plan desde {storeName(sub.source)}
              </span>
              <span style={{ display: "block", marginTop: 4 }}>
                Aquí solo puedes consultarla · el cobro y la cancelación se gestionan en
                la tienda.{" "}
                <a href={STORE_HELP[sub.source]} target="_blank" rel="noopener noreferrer">
                  Cómo gestionarla
                </a>
              </span>
            </Note>

            {sub.willNotRenew && (
              <Note tone="warning" style={{ marginTop: 10 }}>
                No se renovará al expirar.
              </Note>
            )}
          </>
        )}

        {/* CASO B · comprada en la web: aquí sí se gestiona. */}
        {webManaged && (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <BtnLink href="/pro" variant="accent">
              Cambiar plan
            </BtnLink>
            {/* El portal de Stripe: facturas, tarjeta y baja. */}
            <Btn onClick={openPortal} disabled={portalBusy}>
              {portalBusy ? "Abriendo…" : "Facturas y método de pago"}
            </Btn>
            <RedeemCode planHref="/pro" />
          </div>
        )}
        {/* La baja, discreta: es la misma pasarela, no un botón rojo al lado
            de «Cambiar plan». */}
        {webManaged && !data?.cancelAtPeriodEnd && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={openPortal}
              disabled={portalBusy}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12.5,
                color: "var(--text-muted)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Cancelar la renovación
            </button>
          </div>
        )}

        {/* Sin plan propio pero cubierto por otro capitán: sin compra. */}
        {coveredByMate && (
          <div style={{ marginTop: 18 }}>
            <BtnLink href="/equipo">Ver los capitanes</BtnLink>
          </div>
        )}

        {/* CASO A · sin plan: es el único caso que puede contratar. */}
        {noPlan && !coveredByMate && (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <BtnLink href="/pro" variant="accent">
              {trialEnd ? "Elegir el plan Capitán" : "Ver los planes"}
            </BtnLink>
            <RedeemCode planHref="/pro" />
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Prueba sin tarjeta: días que quedan y línea de tiempo ─────────── */
function DbTrialHero({ endIso }: { endIso: string }) {
  const reduce = useReducedMotion();
  const end = new Date(endIso);
  const start = new Date(end.getTime() - TRIAL_DURATION_DAYS * DAY);
  const notice = new Date(end.getTime() - 3 * DAY);
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / DAY));
  const steps = [
    { at: start, label: `Día 1 · ${shortDate(start)}`, text: "Empezaste tu prueba. Pro completo." },
    { at: today, label: `Hoy · ${shortDate(today)}`, text: daysLeft === 1 ? "Te queda 1 día de Pro" : `Te quedan ${daysLeft} días de Pro`, now: true },
    { at: notice, label: `Día ${TRIAL_DURATION_DAYS - 3} · ${shortDate(notice)}`, text: "Te avisamos con 3 días de margen" },
    { at: end, label: `Día ${TRIAL_DURATION_DAYS} · ${shortDate(end)}`, text: "Pasas al plan gratis si no eliges" },
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <CountUp
          to={daysLeft}
          className="mono"
          style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: daysLeft <= 3 ? "var(--warning)" : "var(--accent)" }}
        />
        <span style={{ fontSize: 16, fontWeight: 700 }}>
          {daysLeft === 1 ? "día de Pro gratis" : "días de Pro gratis"}
        </span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
        Sin tarjeta. Cuando acabe no se cobra nada: eliges plan o sigues gratis.
      </p>
      <ol style={{ listStyle: "none", margin: "16px 0 0", padding: "0 0 0 24px", position: "relative" }}>
        <motion.span
          aria-hidden="true"
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.26 }}
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
        {steps.map((st) => {
          const state = st.now ? "now" : st.at.getTime() <= today.getTime() ? "done" : "next";
          return (
            <li key={st.label} style={{ position: "relative", padding: "2px 0 12px" }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -22,
                  top: 6,
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: state === "now" ? "var(--accent)" : "var(--bg-card)",
                  border: `2px solid ${state === "next" ? "var(--text-faint)" : "var(--accent)"}`,
                }}
              />
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{st.label}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>{st.text}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ── Jugador: nada que comprar ─────────────────────────────────────── */
const PLAYER_BENEFITS = [
  "Convocatoria con Voy · Duda · No",
  "Alineación y resultados de cada jornada",
  "Tus números de liga y de amistosos",
];

function PlayerCoverage() {
  const { activeTeam } = useSession();
  const { data: pro, loading } = useAsync(
    () => fetchTeamPro(activeTeam!.id),
    [activeTeam?.id],
    !!activeTeam,
  );
  if (loading) return <SkeletonPage />;
  const name = activeTeam?.name ?? "Tu equipo";
  const free = pro === false;
  return (
    <div className="tw-page-narrow">
      <PageHeader
        title={free ? "Tu equipo está en el plan gratis" : "Tu equipo te cubre"}
        lede={
          free
            ? `${name} está en el plan gratis. Lo activa tu capitán. Tú no pagas nada.`
            : `Eres jugador de ${name}. Tienes la app completa y no pagas nada.`
        }
      />
      <Card flush>
        <CardHead title={name} sub={free ? "Plan gratis · lo gestiona tu capitán" : "Tu equipo tiene Pro"}>
          {pro && <Chip tone="accent">Pro</Chip>}
        </CardHead>
        {!free && (
          <ul className="card-body" style={{ listStyle: "none", margin: 0, display: "grid", gap: 8 }}>
            {PLAYER_BENEFITS.map((b) => (
              <li key={b} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                <span style={{ color: "var(--accent)", display: "flex" }}>
                  <IconCheck size={15} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card style={{ marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>¿Vas a capitanear tu propio equipo?</div>
        <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
          Créalo y tendrás {TRIAL_DURATION_DAYS} días de prueba, sin tarjeta.
        </p>
        <BtnLink href="/empezar" size="sm">
          Crear un equipo
        </BtnLink>
      </Card>
    </div>
  );
}

/* ── Club: un resumen y un camino ──────────────────────────────────── */
function ClubSummary() {
  const { clubId, clubs } = useSession();
  const club = clubs.find((c) => c.id === clubId) ?? null;
  const { data, loading } = useAsync(
    async () => {
      const [sub, used, personal] = await Promise.all([
        fetchClubSubscription(clubId!),
        fetchClubCoveredCount(clubId!),
        fetchSubscription().catch(() => null),
      ]);
      return { sub, used, personal };
    },
    [clubId],
    !!clubId,
  );
  if (loading) return <SkeletonPage />;
  const sub = data?.sub ?? null;
  const plan = sub ? ALL_PLANS.find((p) => p.tier === sub.planTier) ?? null : null;
  const yearly = sub?.billingPeriod === "yearly";
  const quota = plan?.teamQuota ?? 0;
  const used = data?.used ?? 0;
  const personalCaptain =
    data?.personal?.subjectType === "user" && data.personal.planTier === "captain";

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title={sub ? "La paga el club" : "Tu club está en el plan gratis"}
        lede={
          sub
            ? "La suscripción del club cubre a sus equipos y a sus capitanes."
            : "Con un plan de club cubres a todos tus equipos y capitanes."
        }
      />
      {sub && plan && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {plan.displayName} · {yearly ? "anual" : "mensual"}
              </div>
              {club && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{club.name}</div>}
            </div>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
              {formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
                {yearly ? " /año" : " /mes"}
              </span>
            </span>
          </div>
          <div className="divider" />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", width: 70 }}>Equipos</span>
            <div style={{ flex: 1 }}>
              <Progress value={quota > 0 ? Math.min(100, (used / quota) * 100) : 0} />
            </div>
            <span className="mono" style={{ fontSize: 13 }}>
              {used} de {quota}
            </span>
          </div>
          <dl className="kv" style={{ marginTop: 14 }}>
            <dt>{sub.status === "trialing" ? "Prueba termina" : sub.cancelAtPeriodEnd ? "Termina" : "Próximo cobro"}</dt>
            <dd>
              {fmtDate(sub.currentPeriodEnd)}
              {/* Importe solo con el plan activo: una prueba de club puede ser
                  sin tarjeta y no cobrar nada al terminar. */}
              {sub.status === "active" && !sub.cancelAtPeriodEnd && (
                <>
                  {" · "}
                  <span className="mono">
                    {formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
                  </span>
                </>
              )}
            </dd>
          </dl>
        </Card>
      )}
      <div style={{ marginTop: 16 }}>
        <BtnLink href="/club/facturacion" variant="accent">
          {sub ? "Abrir la facturación del club" : "Ver los planes de club"}
        </BtnLink>
      </div>
      {sub && personalCaptain && (
        <Note tone="accent" icon={<IconCheck size={16} />} style={{ marginTop: 16 }}>
          Tu club ya cubre tu plan. Puedes cancelar la suscripción individual de capitán para no
          pagar dos veces.
        </Note>
      )}
    </div>
  );
}
