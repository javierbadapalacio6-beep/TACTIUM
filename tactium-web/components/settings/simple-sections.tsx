"use client";

import { useState } from "react";

import { initials } from "@/lib/account-data";
import { ALL_PLANS, formatEur } from "@/lib/plans";
import { fetchMyDbTrialEnd, fetchTeamPro } from "@/lib/account-queries";
import { fetchTeamCaptainCoverage, formatCoverDate } from "@/lib/team-captains";
import {
  fetchSubscription,
  fetchActiveSeason,
  fetchMyPlayer,
  listUnclaimedPlayers,
  claimPlayer,
  unclaimPlayer,
  type DbClaimablePlayer,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  Input,
  ListRow,
  Note,
} from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import { InvitePanel } from "@/components/invite/InvitePanel";
import { InlineInvitePreview } from "@/components/invite/InviteJoin";
import {
  IconCalendar,
  IconCheck,
  IconInfo,
  IconFile,
  IconLock,
  IconMail,
  IconShield,
  IconUsers,
} from "@/components/Icon";

/* ═══ MI JUGADOR ══════════════════════════════════════════════════ */
export function MiJugador() {
  const { activeTeam, user } = useSession();
  const teamId = activeTeam?.id ?? null;
  const userId = user?.id ?? null;

  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data, loading } = useAsync(
    async () => {
      const [mine, unclaimed] = await Promise.all([
        fetchMyPlayer(teamId!, userId!),
        listUnclaimedPlayers(teamId!),
      ]);
      return { mine, unclaimed };
    },
    [teamId, userId, reloadKey],
    !!teamId && !!userId,
  );

  async function claim(p: DbClaimablePlayer) {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("vincularte al jugador", () =>
      claimPlayer(p.id),
    );
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(`Vinculado a ${p.name}`);
    } else setToast(res.reason);
  }

  async function unclaim(p: DbClaimablePlayer) {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("desvincularte", () => unclaimPlayer(p.id));
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Desvinculado");
    } else setToast(res.reason);
  }

  if (!teamId || !userId) {
    return (
      <Card flush>
        <CardHead title="Mi jugador" />
        <EmptyState
          compact
          icon={<IconUsers size={22} />}
          title="Aún no estás en un equipo"
          body="Únete a un equipo con un código de invitación para vincularte a tu ficha de la plantilla."
        />
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;

  const mine = data?.mine ?? null;
  const unclaimed = data?.unclaimed ?? [];

  return (
    <Card flush>
      <CardHead
        title="Mi jugador"
        sub={
          mine
            ? `Eres ${mine.name} en la plantilla: tus partidos cuentan en tus estadísticas.`
            : "Vincúlate a una ficha para marcar tu disponibilidad y sumar tus partidos."
        }
      >
        {mine && <Chip>Vinculado</Chip>}
      </CardHead>

      {mine ? (
        <PlayerRow player={mine} state="linked" disabled={busy} onClick={() => unclaim(mine)} />
      ) : unclaimed.length === 0 ? (
        <EmptyState
          compact
          icon={<IconUsers size={22} />}
          title="No hay fichas libres"
          body="Todas las fichas de la plantilla ya están vinculadas. Pídele al capitán que añada la tuya."
        />
      ) : (
        unclaimed.map((p) => (
          <PlayerRow key={p.id} player={p} state="free" disabled={busy} onClick={() => claim(p)} />
        ))
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </Card>
  );
}

/** Fila de jugador reutilizable para el vínculo (libre / vinculado). */
function PlayerRow({
  player,
  state,
  disabled,
  onClick,
}: {
  player: DbClaimablePlayer;
  state: "free" | "linked";
  disabled?: boolean;
  onClick: () => void;
}) {
  const linked = state === "linked";
  const meta =
    [player.position, player.pts != null ? `${player.pts} pts` : null]
      .filter(Boolean)
      .join(" · ") || "Sin datos";

  return (
    <div className="list-row">
      <Avatar initials={initials(player.name)} size={32} />
      <span className="list-row-main">
        <span className="list-row-title">{player.name}</span>
        <span className="list-row-sub">{meta}</span>
      </span>
      <Btn
        size="sm"
        variant={linked ? "quiet" : "tint"}
        onClick={onClick}
        disabled={disabled}
      >
        {linked ? "Desvincular" : "Soy yo"}
      </Btn>
    </div>
  );
}

/* ═══ EQUIPO ACTUAL ═══════════════════════════════════════════════ */
export function EquipoActual() {
  const { activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;

  const { data: season, loading } = useAsync(
    () => fetchActiveSeason(teamId!),
    [teamId],
    !!teamId,
  );

  const meta =
    [activeTeam?.category, activeTeam?.gender].filter(Boolean).join(" · ") ||
    "Sin categoría";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {activeTeam && (
        <Card flush>
          <CardHead title="Equipo actual" />
          <ListRow
            href="/equipo"
            icon={
              <span className="tile-icon">
                <IconShield size={16} />
              </span>
            }
            title={activeTeam.name}
            sub={meta}
          />
          <ListRow
            icon={
              <span className="tile-icon tile-icon-mute">
                <IconCalendar size={16} />
              </span>
            }
            title={
              loading
                ? "Cargando temporada…"
                : season
                  ? season.name
                  : "Sin temporada activa"
            }
            sub={season ? "Temporada en curso" : "Crea una para planificar jornadas"}
            chevron={false}
          />
        </Card>
      )}

      <Card
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {activeTeam ? "Crear otro equipo o club" : "Crear un equipo o club"}
          </div>
          <div style={{ marginTop: 3, fontSize: 13, color: "var(--text-muted)" }}>
            {activeTeam
              ? "Monta otro equipo o gestiona un club."
              : "¿Todavía no gestionas ninguno? Empieza aquí."}
          </div>
        </div>
        <BtnLink href="/empezar" variant="accent">
          Crear
        </BtnLink>
      </Card>
    </div>
  );
}

/* ═══ INVITACIONES ════════════════════════════════════════════════ */
export function Invitaciones() {
  const { activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;

  const [code, setCode] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="tw-club-grid">
      {/* Invitar (solo si gestionas un equipo): el enlace primero. */}
      <Card flush>
        <CardHead
          title={teamId ? `Invitar a ${activeTeam?.name ?? "tu equipo"}` : "Invitar jugadores"}
          sub={
            teamId
              ? "Comparte el enlace: se unen desde la app o desde la web, gratis."
              : undefined
          }
        />
        <div className="card-body">
          {teamId ? (
            <InvitePanel
              teamId={teamId}
              teamName={activeTeam?.name ?? "tu equipo"}
              onToast={setToast}
            />
          ) : (
            <Note>
              Necesitas gestionar un equipo para invitar. Crea uno en
              «Tu equipo».
            </Note>
          )}
        </div>
      </Card>

      {/* Unirme con código (universal): vista previa antes de confirmar. */}
      <Card flush>
        <CardHead title="Unirme con código" sub="¿Te han pasado uno? Escríbelo y verás el equipo antes de unirte." />
        <div className="card-body" style={{ display: "grid", gap: 16 }}>
          <Field label="Código de invitación" htmlFor="codigo-invitacion">
            <Input
              id="codigo-invitacion"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoComplete="off"
              className="mono"
              style={{ letterSpacing: "0.12em" }}
            />
          </Field>
          <InlineInvitePreview code={code} />
        </div>
      </Card>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══ SUSCRIPCIÓN · resumen (según el rol) ═══════════════════════ */
/**
 * El jugador no compra nada: se le dice si su equipo tiene Pro, sin nombrar
 * quién paga. El club va a su facturación. El capitán ve su plan y, si está
 * en la prueba sin tarjeta, los días que le quedan (ámbar a 3 o menos).
 */
export function SuscripcionResumen() {
  const { role, activeTeam } = useSession();
  const isPlayer = role === "jugador";
  const isClub = role === "club";

  const { data: teamPro } = useAsync(
    () => fetchTeamPro(activeTeam!.id),
    [activeTeam?.id],
    isPlayer && !!activeTeam,
  );
  const { data, loading } = useAsync(() => fetchSubscription(), [], !isPlayer);
  const { data: trialEnd } = useAsync(() => fetchMyDbTrialEnd(), [], role === "capitan");
  // Plan Capitán compartido: me cubre el plan de otro capitán del equipo.
  const { user } = useSession();
  const { data: cov } = useAsync(
    () => fetchTeamCaptainCoverage(activeTeam!.id).catch(() => null),
    [activeTeam?.id],
    role === "capitan" && !!activeTeam && !activeTeam.clubId,
  );

  if (isPlayer) {
    const name = activeTeam?.name ?? "Tu equipo";
    return (
      <Card flush>
        <CardHead title="Tu plan">
          {teamPro && <Chip tone="accent">Pro</Chip>}
        </CardHead>
        <ListRow
          href="/suscripcion"
          icon={
            <span className="tile-icon">
              <IconCheck size={16} />
            </span>
          }
          title={teamPro === false ? `${name} está en el plan gratis` : "Te cubre tu equipo"}
          sub={
            teamPro === false
              ? "Lo activa tu capitán. Tú no pagas nada."
              : `${name} tiene Pro. No pagas nada.`
          }
        />
      </Card>
    );
  }

  const plan = ALL_PLANS.find((p) => p.tier === data?.planTier) ?? null;
  const yearly = data?.billingPeriod === "yearly";
  const renews = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
      })
    : null;
  const mate =
    !plan && !loading && cov?.covered && cov.payer_user_id !== user?.id ? cov : null;
  const daysLeft = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <Card flush>
      <CardHead title="Tu plan">
        {mate ? (
          <Chip tone="accent">Pro</Chip>
        ) : (
          <Chip tone={!plan ? "mute" : data?.status === "trialing" ? "warning" : "accent"}>
            {!plan ? "Sin plan" : data?.status === "trialing" ? "En prueba" : "Activa"}
          </Chip>
        )}
      </CardHead>
      <div
        className="card-body"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
      >
        {daysLeft !== null && (
          <div
            aria-label={`${daysLeft} días de prueba`}
            style={{
              width: 52,
              height: 52,
              flex: "none",
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              alignContent: "center",
              background: daysLeft <= 3 ? "var(--warning-soft)" : "var(--accent-10)",
              border: `1px solid ${daysLeft <= 3 ? "var(--warning)" : "var(--accent-40)"}`,
              color: daysLeft <= 3 ? "var(--warning)" : "var(--accent)",
            }}
          >
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
              {daysLeft}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{daysLeft === 1 ? "día" : "días"}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {loading
              ? "…"
              : daysLeft !== null
                ? `Prueba de Pro · ${plan?.displayName ?? "Capitán"}`
                : mate
                  ? `Te cubre el plan de ${mate.payer_name?.split(/\s+/)[0] ?? "otro capitán"}`
                  : (plan?.displayName ?? (isClub ? "El club está en el plan gratis" : "Plan gratuito"))}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
            {daysLeft !== null && trialEnd ? (
              `Termina el ${new Date(trialEnd).toLocaleDateString("es-ES", { day: "numeric", month: "long" })} · sin tarjeta`
            ) : plan ? (
              <>
                <span className="mono">
                  {formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
                </span>
                {yearly ? " al año" : " al mes"}
                {renews ? ` · renueva el ${renews}` : ""}
              </>
            ) : mate ? (
              `Pro en ${activeTeam?.name ?? "tu equipo"} hasta ${formatCoverDate(mate.period_end)} · sin pagar nada`
            ) : (
              "Sin renovación ni cobros"
            )}
          </div>
        </div>
        {isClub ? (
          <BtnLink href="/club/facturacion">Facturación del club</BtnLink>
        ) : (
          <BtnLink href="/suscripcion">Gestionar plan</BtnLink>
        )}
      </div>
    </Card>
  );
}

/* ═══ SOPORTE ═════════════════════════════════════════════════════ */
export function Soporte() {
  const { user } = useSession();
  const mailto = `mailto:hola@tactium.io?subject=Soporte%20TACTIUM&body=%0A%0A---%0ACuenta%3A%20${encodeURIComponent(
    user?.email ?? "",
  )}`;

  return (
    <Card flush>
      <CardHead title="Ayuda y contacto" />
      <a href={mailto} className="list-row" style={{ color: "inherit" }}>
        <span className="tile-icon">
          <IconMail size={16} />
        </span>
        <span className="list-row-main">
          <span className="list-row-title">Escríbenos</span>
          <span className="list-row-sub">Te respondemos en el mismo día laborable.</span>
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--accent)" }}>
          hola@tactium.io
        </span>
      </a>
      <a href="/#faq" className="list-row" style={{ color: "inherit" }}>
        <span className="tile-icon tile-icon-mute">
          <IconInfo size={16} />
        </span>
        <span className="list-row-main">
          <span className="list-row-title">Preguntas frecuentes</span>
          <span className="list-row-sub">Lo que más nos preguntan, en la portada.</span>
        </span>
      </a>
      <ListRow
        href="/legal/terminos"
        icon={
          <span className="tile-icon tile-icon-mute">
            <IconFile size={16} />
          </span>
        }
        title="Términos del servicio"
      />
      <ListRow
        href="/legal/privacidad"
        icon={
          <span className="tile-icon tile-icon-mute">
            <IconLock size={16} />
          </span>
        }
        title="Política de privacidad"
      />
    </Card>
  );
}
