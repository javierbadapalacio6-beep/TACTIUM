import type { ICONS } from "@/components/Icon";
import type { DbNotification } from "@/lib/queries";
import type { Notice } from "./NoticeList";

/**
 * De la fila de `notifications` a lo que pinta la campana y `/avisos`.
 * Compartido por las dos superficies para que el aviso se lea igual.
 */

/** Evento de ventana: algo cambió en los avisos (leídos, borrados) y la
 *  campana debe volver a contar. Lo lanza `/avisos`; lo escucha `AppShell`. */
export const NOTICES_CHANGED = "tw:notices-changed";

export function announceNoticesChanged() {
  try {
    window.dispatchEvent(new Event(NOTICES_CHANGED));
  } catch {
    /* sin ventana */
  }
}

export function iconForNotif(type: string): keyof typeof ICONS {
  if (["member_joined", "joined_team", "player_claimed"].includes(type)) return "userPlus";
  if (["matchday_created", "lineup_published"].includes(type)) return "calendar";
  if (type.includes("reminder")) return "clock";
  if (type.includes("follow") || type === "kudos") return "users";
  if (type === "tournament_payment_due") return "creditCard";
  if (type.startsWith("tournament")) return "trophy";
  return "calendar";
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

export function toNotice(n: DbNotification): Notice {
  return {
    id: n.id,
    type: n.type,
    href: n.href,
    icon: iconForNotif(n.type),
    text: n.title,
    time: timeAgo(n.created_at),
    createdAt: n.created_at,
    unread: n.read_at == null,
    matchdayId: n.matchdayId,
    tournamentId: n.tournamentId,
    actor: n.actor,
    clubId: n.clubId,
    tone: n.type.includes("reminder") ? "warning" : n.read_at == null ? "accent" : "muted",
  };
}

/** Al leerse, el aviso deja de ir en acento (salvo los recordatorios). */
export function asRead(n: Notice): Notice {
  return { ...n, unread: false, tone: n.tone === "warning" ? "warning" : "muted" };
}
