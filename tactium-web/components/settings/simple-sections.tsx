"use client";

import Link from "next/link";
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
  type DbInvitation,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import {
  IconCalendar,
  IconChevronRight,
  IconCopy,
  IconFile,
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
      <Card>
        <Eyebrow>MI JUGADOR</Eyebrow>
        <div style={{ marginTop: 16 }}>
          <EmptyState
            icon={<IconUsers size={30} />}
            title="Aún no estás en un equipo"
            body="Únete a un equipo con un código de invitación para poder vincularte a tu ficha de la plantilla."
          />
        </div>
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;

  const mine = data?.mine ?? null;
  const unclaimed = data?.unclaimed ?? [];

  return (
    <Card>
      <Eyebrow>MI JUGADOR</Eyebrow>
      <h2 style={{ margin: "14px 0 6px", fontSize: 24 }}>
        {mine ? "Ya estás vinculado" : "Aún no estás vinculado"}
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
        {mine
          ? `Eres ${mine.name} en la plantilla. Tus partidos cuentan en tus estadísticas.`
          : "Vincúlate a un jugador de la plantilla para marcar tu disponibilidad y que tus partidos cuenten en tus estadísticas."}
      </p>

      {mine ? (
        <PlayerRow
          player={mine}
          state="linked"
          disabled={busy}
          onClick={() => unclaim(mine)}
        />
      ) : unclaimed.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={30} />}
          title="No hay fichas libres"
          body="Todas las fichas de la plantilla ya están vinculadas. Pídele al capitán que añada la tuya."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {unclaimed.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              state="free"
              disabled={busy}
              onClick={() => claim(p)}
            />
          ))}
        </div>
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 15px",
        borderRadius: 12,
        background: "var(--bg-card-2)",
        color: "var(--text)",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        opacity: disabled ? 0.6 : 1,
        border: `1.5px solid ${linked ? "var(--accent)" : "transparent"}`,
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
        {initials(player.name)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
          {player.name}
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
          {[player.pts != null ? `${player.pts} PTS` : null, player.position]
            .filter(Boolean)
            .join(" · ") || "SIN DATOS"}
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
        {linked ? "DESVINCULAR" : "SOY YO"}
      </span>
    </button>
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
    [activeTeam?.category, activeTeam?.gender]
      .filter(Boolean)
      .join(" · ")
      .toUpperCase() || "EQUIPO";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {activeTeam && (
        <Card>
          <Eyebrow>EQUIPO ACTUAL</Eyebrow>
          <Link
            href="/equipo"
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
                {activeTeam.name}
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
                {meta}
              </span>
            </span>
            <span style={{ color: "var(--text-faint)", display: "flex" }}>
              <IconChevronRight size={16} />
            </span>
          </Link>

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
            <span style={{ fontSize: 13 }}>
              {loading
                ? "Cargando temporada…"
                : season
                  ? `Temporada: ${season.name}`
                  : "Sin temporada activa"}
            </span>
          </div>
        </Card>
      )}

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
            {activeTeam ? "Crear otro equipo o club" : "Crear un equipo o club"}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            {activeTeam
              ? "Monta otro equipo o gestiona un club."
              : "¿Todavía no gestionas ninguno? Empieza aquí."}
          </div>
        </div>
        <Link
          href="/empezar"
          className="btn btn-accent"
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          Crear
        </Link>
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
      setToast("¡Te has unido! Recargando…");
      setTimeout(() => window.location.reload(), 900);
    } else setToast(res.reason);
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
        {/* Generar (solo si gestionas un equipo). */}
        {teamId ? (
          <div
            style={{
              padding: 22,
              borderRadius: 12,
              background: "var(--bg-card-2)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Invitar a {activeTeam?.name ?? "tu equipo"}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 12.5,
                color: "var(--text-muted)",
              }}
            >
              Genera un código para que se unan a la plantilla.
            </div>

            {/* Rol del invitado */}
            <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
              {(
                [
                  { id: "player", label: "Jugador" },
                  { id: "captain", label: "Capitán" },
                ] as const
              ).map((r) => {
                const on = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      flex: 1,
                      padding: "9px 10px",
                      borderRadius: 9,
                      cursor: "pointer",
                      fontFamily: "'Satoshi', sans-serif",
                      fontSize: 12.5,
                      fontWeight: on ? 700 : 500,
                      color: on ? "var(--accent)" : "var(--text-muted)",
                      background: on ? "var(--accent-10)" : "var(--bg-card)",
                      border: on
                        ? "1.5px solid var(--accent)"
                        : "1px solid var(--hair-strong)",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn btn-accent"
              onClick={generate}
              disabled={busy}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 16px",
                fontSize: 13,
              }}
            >
              <IconPlus size={15} />
              {busy ? "Generando…" : "Generar código"}
            </button>

            {/* Códigos activos */}
            <div
              style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}
            >
              {active.length === 0 ? (
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    color: "var(--text-faint)",
                  }}
                >
                  SIN CÓDIGOS ACTIVOS
                </div>
              ) : (
                active.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "var(--bg-card)",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        className="mono"
                        style={{
                          display: "block",
                          fontSize: 18,
                          fontWeight: 700,
                          letterSpacing: "0.18em",
                          color: "var(--accent)",
                        }}
                      >
                        {inv.code}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          color: "var(--text-faint)",
                        }}
                      >
                        {inv.role === "captain" ? "CAPITÁN" : "JUGADOR"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(inv.code)}
                      aria-label={`Copiar ${inv.code}`}
                      style={{
                        border: "none",
                        background: "transparent",
                        color:
                          copiedCode === inv.code
                            ? "var(--accent)"
                            : "var(--text-faint)",
                        cursor: "pointer",
                        display: "flex",
                        padding: 4,
                      }}
                    >
                      <IconCopy size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
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
                textWrap: "pretty",
              }}
            >
              Necesitas gestionar un equipo para generar códigos. Crea uno desde
              «Equipo actual».
            </div>
          </div>
        )}

        {/* Unirme con código (universal). */}
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
              onClick={join}
              disabled={code.trim().length < 3 || joining}
              style={{
                padding: "13px 20px",
                fontSize: 13.5,
                borderRadius: 12,
              }}
            >
              {joining ? "…" : "Unirme"}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
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
  const { user } = useSession();
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
              user?.email ?? ""
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
