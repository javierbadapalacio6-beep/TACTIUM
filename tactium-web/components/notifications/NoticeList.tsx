"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { ICONS, IconCheck, IconX } from "@/components/Icon";
import { Btn, BtnLink } from "@/components/ui";
import {
  fetchMyMatchdayAvailability,
  followTarget,
  respondAvailability,
  STATUS_LABEL,
  type AvailStatus,
  type NotifActor,
} from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";

/**
 * Lista de la campana «Avisos».
 *
 * - Agrupada por día: «Hoy», «Esta semana» (últimos 7 días) y «Antes».
 * - Varios «X te ha empezado a seguir» del mismo día se juntan en una fila
 *   («3 nuevos seguidores»).
 * - Botones en línea por tipo (responder a la convocatoria, seguir también,
 *   ver la alineación…). Van FUERA del enlace de la fila: un `button` dentro
 *   de un `a` no es HTML válido, y así tampoco disparan la navegación.
 *
 * Mismos textos que la campana de la app (`NotificationsSheet`).
 */

export type NoticeTone = "accent" | "warning" | "muted";

export interface Notice {
  id: string;
  type: string;
  icon: keyof typeof ICONS;
  text: string;
  time: string;
  createdAt: string;
  unread: boolean;
  tone: NoticeTone;
  /** A dónde lleva. Null si ese tipo no tiene destino. */
  href: string | null;
  matchdayId: string | null;
  tournamentId: string | null;
  actor: NotifActor | null;
  clubId: string | null;
}

type Item =
  | { kind: "one"; n: Notice }
  | { kind: "followers"; key: string; items: Notice[] };

type Bucket = "today" | "week" | "older";
const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Hoy",
  week: "Esta semana",
  older: "Antes",
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function bucketOf(iso: string): Bucket {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "older";
  const now = new Date();
  if (dayKey(iso) === dayKey(now.toISOString())) return "today";
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return d.getTime() >= startToday - 6 * 86_400_000 ? "week" : "older";
}

/** «Marta López» → «Marta L.» */
function shortName(full: string): string {
  const w = full.trim().split(/\s+/).filter(Boolean);
  if (w.length <= 1) return w[0] ?? full;
  return `${w[0]} ${w[1][0].toUpperCase()}.`;
}

/** «Marta L., Rubén C. y 1 más» — null si no hay ningún nombre. */
function followerNames(items: Notice[]): string | null {
  const names = items
    .map((n) => n.actor?.name)
    .filter((x): x is string => !!x)
    .map(shortName);
  if (names.length === 0) return null;
  const shown = names.slice(0, 2);
  const rest = items.length - shown.length;
  if (rest <= 0) {
    return shown.length === 2 ? `${shown[0]} y ${shown[1]}` : shown[0];
  }
  return `${shown.join(", ")} y ${rest} más`;
}

/** Sigue a una persona (no a tu club): es lo que se agrupa. */
const isUserFollow = (n: Notice) => n.type === "new_follower" && !!n.actor && !n.clubId;

function buildSections(notices: Notice[]): { bucket: Bucket; items: Item[] }[] {
  // Seguidores por día: con 2 o más, una sola fila.
  const perDay = new Map<string, Notice[]>();
  for (const n of notices) {
    if (!isUserFollow(n)) continue;
    const k = dayKey(n.createdAt);
    perDay.set(k, [...(perDay.get(k) ?? []), n]);
  }

  const items: Item[] = [];
  const emitted = new Set<string>();
  for (const n of notices) {
    if (isUserFollow(n)) {
      const k = dayKey(n.createdAt);
      const group = perDay.get(k) ?? [];
      if (group.length >= 2) {
        if (!emitted.has(k)) {
          emitted.add(k);
          items.push({ kind: "followers", key: k, items: group });
        }
        continue;
      }
    }
    items.push({ kind: "one", n });
  }

  const order: Bucket[] = ["today", "week", "older"];
  return order
    .map((bucket) => ({
      bucket,
      items: items.filter(
        (it) => bucketOf(it.kind === "one" ? it.n.createdAt : it.items[0].createdAt) === bucket
      ),
    }))
    .filter((s) => s.items.length > 0);
}

export function NoticeList({
  notices,
  onNavigate,
  onDelete,
  onRead,
}: {
  notices: Notice[];
  /** Al seguir un enlace (cierra la campana). */
  onNavigate: () => void;
  /** Borra uno o varios avisos (una fila agrupada son varios). */
  onDelete: (ids: string[]) => void;
  /** Al tocar un aviso no leído: lo marca como leído (baja el contador). */
  onRead?: (ids: string[]) => void;
}) {
  if (notices.length === 0) {
    return (
      <div
        style={{
          padding: "22px 16px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-faint)",
        }}
      >
        No tienes avisos.
      </div>
    );
  }

  const sections = buildSections(notices);

  return (
    <>
      {sections.map((s) => (
        <section key={s.bucket} aria-label={BUCKET_LABEL[s.bucket]}>
          <div
            style={{
              padding: "10px 16px 4px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-faint)",
            }}
          >
            {BUCKET_LABEL[s.bucket]}
          </div>
          {s.items.map((it, i) => {
            const last = i === s.items.length - 1;
            return it.kind === "one" ? (
              <NoticeRow
                key={it.n.id}
                n={it.n}
                last={last}
                onNavigate={onNavigate}
                onDelete={() => onDelete([it.n.id])}
                onRead={it.n.unread && onRead ? () => onRead([it.n.id]) : undefined}
              />
            ) : (
              <FollowersRow
                key={"f-" + it.key}
                items={it.items}
                last={last}
                onNavigate={onNavigate}
                onDelete={() => onDelete(it.items.map((n) => n.id))}
                onRead={
                  onRead && it.items.some((n) => n.unread)
                    ? () => onRead(it.items.filter((n) => n.unread).map((n) => n.id))
                    : undefined
                }
              />
            );
          })}
        </section>
      ))}
    </>
  );
}

/* ── Filas ──────────────────────────────────────────────────────── */

function RowShell({
  href,
  tone,
  icon,
  title,
  sub,
  time,
  unread,
  last,
  actions,
  onNavigate,
  onDelete,
  onRead,
  emoji,
}: {
  href: string | null;
  tone: NoticeTone;
  icon: keyof typeof ICONS;
  /** Sustituye al icono cuando el aviso tiene su emoji propio (👏 kudos). */
  emoji?: string;
  title: string;
  sub?: string | null;
  time: string;
  unread: boolean;
  last: boolean;
  actions?: ReactNode;
  onNavigate: () => void;
  onDelete: () => void;
  onRead?: () => void;
}) {
  const Icon = ICONS[icon];
  const color =
    tone === "accent"
      ? "var(--accent)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--text-muted)";

  const contenido = (
    <>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: tone === "accent" ? "var(--accent-10)" : "var(--bg-card-2)",
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {emoji ? (
          <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
            {emoji}
          </span>
        ) : (
          <Icon size={15} />
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 13.5,
            lineHeight: 1.35,
            color: unread ? "var(--text)" : "var(--text-muted)",
          }}
        >
          {title}
        </span>
        {sub ? (
          <span
            style={{
              display: "block",
              fontSize: 12.5,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            {sub}
          </span>
        ) : null}
        <span
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--text-faint)",
            marginTop: 4,
          }}
        >
          {time}
        </span>
      </span>
      {unread && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: "var(--accent)",
            marginTop: 6,
            flex: "none",
          }}
        />
      )}
    </>
  );

  return (
    <div
      className={"tw-bell-row" + (href ? " is-link" : "")}
      style={{ borderBottom: last ? "none" : "1px solid var(--line)" }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {href ? (
          <Link
            href={href}
            className="tw-bell-body"
            onClick={() => {
              onRead?.();
              onNavigate();
            }}
          >
            {contenido}
          </Link>
        ) : (
          <span className="tw-bell-body" onClick={onRead}>
            {contenido}
          </span>
        )}
        {actions ? (
          // Alineado con el texto: 30 del icono + 12 de hueco. Usar un
          // botón del aviso también cuenta como leerlo.
          <div style={{ margin: "-4px 0 12px 42px" }} onClickCapture={onRead}>
            {actions}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="tw-bell-del"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Borrar este aviso"
        title="Borrar"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

function NoticeRow({
  n,
  last,
  onNavigate,
  onDelete,
  onRead,
}: {
  n: Notice;
  last: boolean;
  onNavigate: () => void;
  onDelete: () => void;
  onRead?: () => void;
}) {
  return (
    <RowShell
      href={n.href}
      tone={n.tone}
      icon={n.icon}
      emoji={n.type === "kudos" ? "👏" : undefined}
      title={n.text}
      time={n.time}
      unread={n.unread}
      last={last}
      actions={<NoticeActions n={n} onNavigate={onNavigate} />}
      onNavigate={onNavigate}
      onDelete={onDelete}
      onRead={onRead}
    />
  );
}

function FollowersRow({
  items,
  last,
  onNavigate,
  onDelete,
  onRead,
}: {
  items: Notice[];
  last: boolean;
  onNavigate: () => void;
  onDelete: () => void;
  onRead?: () => void;
}) {
  const unread = items.some((n) => n.unread);
  return (
    <RowShell
      href="/comunidad"
      tone={unread ? "accent" : "muted"}
      icon={items[0].icon}
      title={`${items.length} nuevos seguidores`}
      sub={followerNames(items)}
      time={items[0].time}
      unread={unread}
      last={last}
      onNavigate={onNavigate}
      onDelete={onDelete}
      onRead={onRead}
    />
  );
}

/* ── Botones en línea ───────────────────────────────────────────── */

const stop = (e: MouseEvent) => e.stopPropagation();

function ActionsRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {children}
    </div>
  );
}

function Done({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--accent)",
      }}
    >
      <IconCheck size={14} />
      {children}
    </span>
  );
}

function Err({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "block", width: "100%", fontSize: 12, color: "var(--error)" }}>
      {children}
    </span>
  );
}

/** Enlace-botón de cada tipo: [texto, destino]. */
function linkAction(n: Notice): [string, string] | null {
  const md = n.matchdayId;
  const t = n.tournamentId;
  switch (n.type) {
    case "lineup_published":
      return md ? ["Ver alineación", `/jornada/${md}/alineacion`] : null;
    case "matchday_created":
      return md ? ["Ver jornada", `/jornada/${md}`] : null;
    case "lineup_reminder":
      return md ? ["Hacer alineación", `/jornada/${md}/alineacion`] : null;
    case "member_joined":
    case "player_claimed":
      return ["Ver plantilla", "/equipo"];
    case "schedule_set":
      return ["Ver horario", "/club/horarios"];
    case "time_poll_open":
    case "time_poll_reminder":
      return n.href ? ["Votar", n.href] : null;
    case "time_poll_fixed":
      return n.href ? [n.href === "/club/horarios" ? "Ver horario" : "Ver jornada", n.href] : null;
    case "tournament_bracket":
      return t ? ["Ver cuadro", `/torneos/${t}`] : null;
    case "tournament_schedule":
      return t ? ["Ver horario", `/torneos/${t}`] : null;
    case "tournament_signup":
      return n.href ? ["Ver inscripción", n.href] : null;
    case "tournament_payment_due":
      return t ? ["Pagar inscripción", `/torneos/${t}/inscripcion`] : null;
    case "kudos":
      return n.href ? ["Ver", n.href] : null;
    default:
      return null;
  }
}

function NoticeActions({ n, onNavigate }: { n: Notice; onNavigate: () => void }) {
  if (n.type === "availability_reminder" && n.matchdayId) {
    return <AvailabilityActions matchdayId={n.matchdayId} onNavigate={onNavigate} />;
  }
  if (n.type === "new_follower" && n.actor) {
    return <FollowBackAction actor={n.actor} />;
  }
  const link = linkAction(n);
  if (!link) return null;
  return (
    <ActionsRow>
      <BtnLink
        href={link[1]}
        size="sm"
        variant="ghost"
        onClick={(e) => {
          stop(e);
          onNavigate();
        }}
      >
        {link[0]}
      </BtnLink>
    </ActionsRow>
  );
}

/** «Voy» · «Duda» · «No puedo» desde el propio aviso. */
function AvailabilityActions({
  matchdayId,
  onNavigate,
}: {
  matchdayId: string;
  onNavigate: () => void;
}) {
  const [info, setInfo] = useState<{
    playerId: string;
    status: AvailStatus | null;
    upcoming: boolean;
  } | null>(null);
  const [answered, setAnswered] = useState<AvailStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyMatchdayAvailability(matchdayId)
      .then((r) => {
        if (alive) setInfo(r);
      })
      .catch(() => {
        if (alive) setInfo(null);
      });
    return () => {
      alive = false;
    };
  }, [matchdayId]);

  if (answered === "yes" || answered === "no") {
    return <Done>Respondiste: {STATUS_LABEL[answered]}</Done>;
  }
  // Sin ficha en ese equipo, o la jornada ya no está por jugar: sin botones.
  if (!info || !info.upcoming) return null;
  if (info.status === "yes" || info.status === "no") {
    return <Done>Respondiste: {STATUS_LABEL[info.status]}</Done>;
  }

  async function responder(status: "yes" | "no") {
    if (!info || busy) return;
    setBusy(true);
    setError(null);
    const res = await guardedWrite("responder a la convocatoria", () =>
      respondAvailability(matchdayId, info.playerId, status)
    );
    setBusy(false);
    if (res.ok) setAnswered(status);
    else setError(res.reason);
  }

  return (
    <ActionsRow>
      <Btn
        size="sm"
        variant="tint"
        disabled={busy}
        onClick={(e) => {
          stop(e);
          void responder("yes");
        }}
      >
        Voy
      </Btn>
      <BtnLink
        href={`/jornada/${matchdayId}/disponibilidad`}
        size="sm"
        variant="ghost"
        onClick={(e) => {
          stop(e);
          onNavigate();
        }}
      >
        Duda
      </BtnLink>
      <Btn
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={(e) => {
          stop(e);
          void responder("no");
        }}
      >
        No puedo
      </Btn>
      {error ? <Err>{error}</Err> : null}
    </ActionsRow>
  );
}

/** «Seguir también» a quien te acaba de seguir. */
function FollowBackAction({ actor }: { actor: NotifActor }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return <Done>Le sigues</Done>;
  if (actor.following) return null;

  async function seguir() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await guardedWrite("seguir también", () => followTarget("user", actor.id));
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.reason);
  }

  return (
    <ActionsRow>
      <Btn
        size="sm"
        variant="tint"
        disabled={busy}
        onClick={(e) => {
          stop(e);
          void seguir();
        }}
      >
        Seguir también
      </Btn>
      {error ? <Err>{error}</Err> : null}
    </ActionsRow>
  );
}
