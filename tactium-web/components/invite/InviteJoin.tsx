"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  joinTeamWithInvite,
  previewInvitation,
  type InvitationPreview,
  type InvitationPreviewPlayer,
} from "@/lib/queries";
import { normalizeInviteCode } from "@/lib/invite";
import { useSession } from "@/lib/session";
import { guardedWrite } from "@/lib/writes";
import { Btn, Eyebrow, Note } from "@/components/ui";
import { EmptyState, Skeleton } from "@/components/states";
import { IconAlert, IconCalendar, IconCheck, IconUser, IconUsers } from "@/components/Icon";

/**
 * Vista previa de una invitación y unión al equipo.
 *
 * Se usa en la página pública `/i/[code]`, en `/empezar` (opción «Me han
 * invitado») y en `/ajustes/invitaciones`: el invitado ve A QUÉ equipo entra
 * antes de confirmar y, si es invitación de jugador, elige su ficha.
 */

export type ValidPreview = Extract<InvitationPreview, { valid: true }>;

const ACTIVE_TEAM_KEY = "tactium-active-team";

/* ── Carga de la vista previa ─────────────────────────────────────── */

export type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: InvitationPreview };

/** Pide la vista previa del código (con espera mientras se escribe). */
export function useInvitePreview(rawCode: string, minLength = 4, delayMs = 350): PreviewState {
  const code = normalizeInviteCode(rawCode);
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  useEffect(() => {
    if (code.length < minLength) {
      setState({ status: "idle" });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    const h = setTimeout(() => {
      previewInvitation(code)
        .then((preview) => alive && setState({ status: "ready", preview }))
        .catch((e: unknown) =>
          alive &&
          setState({
            status: "error",
            message:
              e && typeof e === "object" && "message" in e
                ? String((e as { message: unknown }).message)
                : "No se pudo comprobar el código",
          }),
        );
    }, delayMs);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [code, minLength, delayMs]);

  return state;
}

/* ── Piezas ───────────────────────────────────────────────────────── */

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "··"
  );
}

/** Escudo: el logo si lo hay; si no, las iniciales del equipo. */
export function TeamShield({ name, logoUrl, size = 64 }: { name: string; logoUrl: string | null; size?: number }) {
  return (
    <span
      className={"crest" + (logoUrl ? " has-img" : "")}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        fontSize: Math.round(size * 0.34),
        fontWeight: 700,
      }}
      aria-hidden="true"
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

function formatMatchDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

/** «{categoría} · {liga} · {N} jugadores», sin huecos si falta algo. */
export function previewMetaLine(p: ValidPreview): string {
  const n = p.players_count;
  return [p.team.category, p.team.league, `${n} ${n === 1 ? "jugador" : "jugadores"}`]
    .filter(Boolean)
    .join(" · ");
}

/** Tarjeta con lo público del equipo. */
export function InvitePreviewCard({ preview }: { preview: ValidPreview }) {
  const nm = preview.next_matchday;
  const nmDate = nm ? formatMatchDate(nm.date) : null;
  return (
    <div>
      <Eyebrow tone="accent">Te han invitado a</Eyebrow>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16 }}>
        <TeamShield name={preview.team.name} logoUrl={preview.team.logo_url} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 22, margin: 0, overflowWrap: "anywhere" }}>{preview.team.name}</h2>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
            {previewMetaLine(preview)}
          </div>
          {preview.club_name && (
            <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-faint)" }}>
              {preview.club_name}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gap: 8,
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--bg-card-2)",
          border: "1px solid var(--line)",
          fontSize: 13.5,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--text-faint)", display: "flex" }}>
            <IconUser size={15} />
          </span>
          <span>
            Capitán:{" "}
            <strong style={{ fontWeight: 600 }}>{preview.captain_name || "Sin nombre"}</strong>
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--text-faint)", display: "flex" }}>
            <IconCalendar size={15} />
          </span>
          {nm ? (
            <span>
              Próxima jornada
              {nm.jornada != null && (
                <>
                  {" "}
                  <span className="mono">{nm.jornada}</span>
                </>
              )}
              {nmDate ? `: ${nmDate}` : ""}
              {nm.opponent ? ` contra ${nm.opponent}` : ""}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>Sin jornadas programadas</span>
          )}
        </span>
        {preview.role === "captain" && (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--text-faint)", display: "flex" }}>
              <IconUsers size={15} />
            </span>
            <span>Entras como capitán</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Estado claro para un código que no vale. */
export function InvalidInvite({
  reason,
  action,
}: {
  reason: "not_found" | "used" | "expired";
  action?: ReactNode;
}) {
  const copy = {
    not_found: {
      title: "Código no válido",
      body: "Revisa que esté bien escrito: son 8 letras y números.",
    },
    used: {
      title: "Este código ya se ha usado",
      body: "Era de un solo uso. Pide a quien te invitó un código nuevo.",
    },
    expired: {
      title: "Este código ha caducado",
      body: "Pide a quien te invitó que te envíe uno nuevo.",
    },
  }[reason];
  return (
    <EmptyState
      compact
      icon={<IconAlert size={22} />}
      title={copy.title}
      body={copy.body}
      action={action}
    />
  );
}

/* ── Selector de ficha ────────────────────────────────────────────── */

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** La ficha libre que coincide con el nombre del perfil, si hay una clara. */
export function matchRosterByName(
  roster: InvitationPreviewPlayer[],
  profileName: string | null | undefined,
): string | null {
  if (!profileName) return null;
  const me = fold(profileName);
  if (!me) return null;
  const free = roster.filter((p) => !p.claimed);
  const exact = free.find((p) => fold(p.name) === me);
  if (exact) return exact.id;
  // Todas las palabras del perfil están en la ficha (o al revés) y solo una.
  const myWords = me.split(" ").filter((w) => w.length > 1);
  if (myWords.length < 2) return null;
  const hits = free.filter((p) => {
    const words = fold(p.name).split(" ");
    return (
      myWords.every((w) => words.includes(w)) ||
      words.filter((w) => w.length > 1).every((w) => myWords.includes(w))
    );
  });
  return hits.length === 1 ? hits[0].id : null;
}

const NOT_LISTED = "__none__";

export function RosterPicker({
  roster,
  value,
  onChange,
}: {
  roster: InvitationPreviewPlayer[];
  /** id de la ficha, o null = «No estoy en la lista». */
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const free = roster.filter((p) => !p.claimed);
  const options: { id: string; name: string; sub: string | null }[] = [
    ...free.map((p) => ({
      id: p.id,
      name: p.name,
      sub: [p.position, p.pts != null ? `${p.pts} pts` : null].filter(Boolean).join(" · ") || null,
    })),
    { id: NOT_LISTED, name: "No estoy en la lista", sub: "El capitán podrá añadirte después" },
  ];
  const current = value ?? NOT_LISTED;
  return (
    <div>
      <Eyebrow>¿Quién eres de la plantilla?</Eyebrow>
      <div
        role="radiogroup"
        aria-label="¿Quién eres de la plantilla?"
        style={{ marginTop: 10, display: "grid", gap: 6, maxHeight: 320, overflowY: "auto" }}
      >
        {options.map((o) => {
          const on = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id === NOT_LISTED ? null : o.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
                background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-ui)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  flex: "none",
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {on && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
                )}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{o.name}</span>
                {o.sub && (
                  <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--text-faint)" }}>
                    {o.sub}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Unirse (con sesión) ──────────────────────────────────────────── */

/**
 * Selector de ficha + «Unirme al equipo». Requiere sesión. Si ya es miembro
 * del equipo, lo dice y le lleva a él.
 */
export function JoinInvite({ code, preview }: { code: string; preview: ValidPreview }) {
  const { user, teams } = useSession();
  const isPlayerInvite = preview.role === "player";
  const roster = preview.roster;
  const suggested = useMemo(
    () => (isPlayerInvite ? matchRosterByName(roster, user?.name) : null),
    [isPlayerInvite, roster, user?.name],
  );
  const [picked, setPicked] = useState<string | null>(suggested);
  useEffect(() => setPicked(suggested), [suggested]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [claimWarn, setClaimWarn] = useState<string | null>(null);

  const alreadyMember = teams.some((t) => t.id === preview.team.id);

  function goToTeam() {
    try {
      localStorage.setItem(ACTIVE_TEAM_KEY, preview.team.id);
    } catch {
      /* sin persistencia: la sesión elegirá el primero */
    }
    // Recarga completa: la sesión tiene que descubrir el equipo nuevo.
    window.location.href = "/equipo";
  }

  if (alreadyMember) {
    return (
      <Note tone="accent" icon={<IconCheck size={16} />}>
        <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 180 }}>Ya estás en este equipo</span>
          <Btn variant="accent" size="sm" onClick={goToTeam}>
            Ir a mi equipo
          </Btn>
        </span>
      </Note>
    );
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("unirte al equipo", () =>
      joinTeamWithInvite(code, isPlayerInvite ? picked : null),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    if (res.data.claimError) {
      setClaimWarn(res.data.claimError);
      return;
    }
    goToTeam();
  }

  if (claimWarn) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Note tone="warning">
          Ya estás en el equipo, pero no se pudo vincular tu ficha: {claimWarn}. Puedes
          hacerlo en Ajustes, en «Mi jugador».
        </Note>
        <Btn variant="accent" size="lg" block onClick={goToTeam}>
          Ir a mi equipo
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {isPlayerInvite && <RosterPicker roster={roster} value={picked} onChange={setPicked} />}
      {err && <Note tone="error">{err}</Note>}
      <Btn variant="accent" size="lg" block disabled={busy} onClick={join}>
        {busy ? "Uniéndote…" : "Unirme al equipo"}
      </Btn>
    </div>
  );
}

/**
 * Bloque completo para los formularios con código (empezar, ajustes): carga
 * la vista previa mientras se escribe y, si vale, enseña tarjeta + selector.
 */
export function InlineInvitePreview({ code }: { code: string }) {
  const state = useInvitePreview(code);
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
        <Skeleton h={14} w="40%" />
        <Skeleton h={40} />
        <Skeleton h={12} w="70%" />
      </div>
    );
  }
  if (state.status === "error") return <Note tone="error">{state.message}</Note>;
  const p = state.preview;
  if (!p.valid) return <InvalidInvite reason={p.reason} />;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <InvitePreviewCard preview={p} />
      <JoinInvite code={normalizeInviteCode(code)} preview={p} />
    </div>
  );
}
