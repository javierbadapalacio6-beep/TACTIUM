"use client";

import { useState } from "react";

import { initials } from "@/lib/account-data";
import { ALL_PLANS, formatEur } from "@/lib/plans";
import {
  fetchSubscription,
  fetchActiveSeason,
  fetchMyPlayer,
  listUnclaimedPlayers,
  claimPlayer,
  unclaimPlayer,
  fetchTeamInvitations,
  createInvitation,
  redeemInvitation,
  invitationActive,
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
  Segmented,
} from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import {
  IconCalendar,
  IconCopy,
  IconFile,
  IconLock,
  IconMail,
  IconPlus,
  IconSearch,
  IconShield,
  IconTicket,
  IconTrophy,
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

  const [reloadKey, setReloadKey] = useState(0);
  const [role, setRole] = useState<"player" | "captain">("player");
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: invites } = useAsync(
    () => fetchTeamInvitations(teamId!),
    [teamId, reloadKey],
    !!teamId,
  );
  const active = (invites ?? []).filter(invitationActive);

  async function generate() {
    if (busy || !teamId) return;
    setBusy(true);
    const res = await guardedWrite("crear la invitación", () =>
      createInvitation(teamId, role),
    );
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(`Código creado: ${res.data.code}`);
    } else setToast(res.reason);
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCode(value);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      /* Sin permiso de portapapeles: el código se ve y se copia a mano. */
    }
  }

  async function join() {
    if (joining || code.trim().length < 3) return;
    setJoining(true);
    const res = await guardedWrite("unirte con el código", () =>
      redeemInvitation(code),
    );
    setJoining(false);
    if (res.ok) {
      setToast("Te has unido. Recargando…");
      setTimeout(() => window.location.reload(), 900);
    } else setToast(res.reason);
  }

  return (
    <div className="tw-club-grid">
      {/* Generar (solo si gestionas un equipo). */}
      <Card flush>
        <CardHead
          title={teamId ? `Invitar a ${activeTeam?.name ?? "tu equipo"}` : "Invitar jugadores"}
          sub={
            teamId
              ? "Genera un código para que se unan a la plantilla."
              : undefined
          }
        />
        {teamId ? (
          <>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Rol del invitado">
                <Segmented
                  label="Rol del invitado"
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: "player", label: "Jugador" },
                    { value: "captain", label: "Capitán" },
                  ]}
                />
              </Field>
              <Btn variant="accent" onClick={generate} disabled={busy} icon={<IconPlus size={15} />} block>
                {busy ? "Generando…" : "Generar código"}
              </Btn>
              {role === "player" && (
                <Note>
                  El código de jugador es único por equipo y se puede reutilizar.
                  El de capitán sirve una sola vez.
                </Note>
              )}
            </div>

            {active.length === 0 ? (
              <EmptyState compact title="Sin códigos activos" body="Genera uno para empezar a invitar." />
            ) : (
              active.map((inv) => (
                <div key={inv.id} className="list-row">
                  <span className="list-row-main">
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        fontSize: 17,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        color: "var(--accent)",
                      }}
                    >
                      {inv.code}
                    </span>
                    <span className="list-row-sub">
                      {inv.role === "captain" ? "Capitán" : "Jugador"}
                    </span>
                  </span>
                  <Btn
                    size="sm"
                    variant="quiet"
                    onClick={() => copy(inv.code)}
                    aria-label={`Copiar ${inv.code}`}
                    icon={<IconCopy size={14} />}
                  >
                    {copiedCode === inv.code ? "Copiado" : "Copiar"}
                  </Btn>
                </div>
              ))
            )}
          </>
        ) : (
          <div className="card-body">
            <Note>
              Necesitas gestionar un equipo para generar códigos. Crea uno desde
              «Equipo actual».
            </Note>
          </div>
        )}
      </Card>

      {/* Unirme con código (universal). */}
      <Card flush>
        <CardHead title="Unirme con código" sub="¿Te han pasado uno? Úsalo aquí." />
        <div className="card-body">
          <Field label="Código de invitación" htmlFor="codigo-invitacion">
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                id="codigo-invitacion"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="mono"
                style={{ letterSpacing: "0.12em" }}
              />
              <Btn
                variant="accent"
                onClick={join}
                disabled={code.trim().length < 3 || joining}
              >
                {joining ? "…" : "Unirme"}
              </Btn>
            </div>
          </Field>
        </div>
      </Card>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══ SUSCRIPCIÓN · resumen ═══════════════════════════════════════ */
export function SuscripcionResumen() {
  // Datos reales: antes pintaba el plan de maqueta (10 equipos a 29,99 €,
  // que no es ningún plan que exista) para cualquier usuario.
  const { data, loading } = useAsync(() => fetchSubscription(), []);
  const plan = ALL_PLANS.find((p) => p.tier === data?.planTier) ?? null;
  const yearly = data?.billingPeriod === "yearly";
  const renews = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
      })
    : null;

  return (
    <Card flush>
      <CardHead title="Suscripción">
        <Chip tone={!plan ? "mute" : data?.status === "trialing" ? "warning" : "accent"}>
          {!plan ? "Sin plan" : data?.status === "trialing" ? "En prueba" : "Activa"}
        </Chip>
      </CardHead>
      <div
        className="card-body"
        style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {loading ? "…" : (plan?.displayName ?? "Plan gratuito")}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
            {plan ? (
              <>
                <span className="mono">
                  {formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
                </span>
                {yearly ? " al año" : " al mes"}
                {renews ? ` · renueva el ${renews}` : ""}
              </>
            ) : (
              "Sin renovación ni cobros"
            )}
          </div>
        </div>
        <BtnLink href="/suscripcion">Gestionar plan</BtnLink>
      </div>
    </Card>
  );
}

/* ═══ TORNEOS ═════════════════════════════════════════════════════ */
const TOURNEY_LINKS = [
  {
    label: "Mis torneos",
    body: "Los que organizas o en los que juegas",
    Icon: IconTrophy,
    href: "/torneos?tab=mios",
  },
  {
    label: "Explorar torneos",
    body: "Por zona, club o fecha",
    Icon: IconSearch,
    href: "/torneos",
  },
  {
    label: "Crear torneo",
    body: "Monta uno en tu club",
    Icon: IconPlus,
    href: "/club/torneos/nuevo",
  },
  {
    label: "Entrar con código",
    body: "Si te han pasado uno de inscripción",
    Icon: IconTicket,
    href: "/torneos?codigo=1",
  },
];

export function Torneos() {
  return (
    <Card flush>
      <CardHead title="Torneos" />
      {TOURNEY_LINKS.map(({ label, body, Icon, href }) => (
        <ListRow
          key={label}
          href={href}
          icon={
            <span className="tile-icon">
              <Icon size={16} />
            </span>
          }
          title={label}
          sub={body}
        />
      ))}
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
      <CardHead title="Soporte" />
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
