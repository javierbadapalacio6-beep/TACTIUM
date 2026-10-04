"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Avatar, Card, Eyebrow } from "@/components/ui";
import { fetchKudosSummary } from "@/lib/match-data";
import { toggleActivityKudos } from "@/lib/queries";

/**
 * Piezas del bloque «Partido» en la web: el marcador (misma cabecera que la
 * Jornada), la fila de pista y el botón de kudos. Espejo de
 * TACTIUM/src/features/home/components/match/.
 */

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export function MatchScoreboard({
  eyebrow,
  left,
  right,
  crests = true,
  us,
  them,
  status,
  tone = "text",
  photoUrl,
  children,
}: {
  eyebrow?: string | null;
  left: string;
  right: string;
  crests?: boolean;
  us: number | null;
  them: number | null;
  status?: string | null;
  tone?: "accent" | "error" | "warning" | "text";
  photoUrl?: string | null;
  children?: ReactNode;
}) {
  const color = tone === "text" ? "var(--text)" : `var(--${tone})`;
  const side = (name: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0, textAlign: "center" }}>
      {crests && <Avatar initials={initialsOf(name)} size={48} />}
      <div className="truncate" title={name} style={{ maxWidth: "100%", fontSize: 15, fontWeight: 700 }}>
        {name}
      </div>
    </div>
  );
  return (
    <Card
      style={{
        padding: "18px 18px 20px",
        ...(photoUrl
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(3,15,15,.35), rgba(3,15,15,.92)), url(${photoUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : null),
      }}
    >
      {eyebrow && <Eyebrow style={{ textAlign: "center", marginBottom: 16 }}>{eyebrow}</Eyebrow>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 12 }}>
        {side(left)}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 96 }}>
          <span
            className="mono"
            aria-label={`Marcador ${us ?? 0} a ${them ?? 0}`}
            style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color }}
          >
            {us ?? "–"}–{them ?? "–"}
          </span>
          {status && <span style={{ fontSize: 12.5, fontWeight: 600, color }}>{status}</span>}
        </div>
        {side(right)}
      </div>
      {children}
    </Card>
  );
}

/** Fila de pista/partido: P1 · pareja · sets · estado. */
export function MatchRow({
  badge,
  title,
  sub,
  right,
  tone = "muted",
  me,
  onClick,
}: {
  badge: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  tone?: "win" | "loss" | "todo" | "muted";
  me?: boolean;
  onClick?: () => void;
}) {
  const color =
    tone === "win" ? "var(--accent)" : tone === "loss" ? "var(--error)" : tone === "todo" ? "var(--accent)" : "var(--text-faint)";
  const inner = (
    <>
      <span className="mono" style={{ width: 28, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
        {badge}
      </span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="truncate" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {title}
        </span>
        {sub && (
          <span className="mono truncate" style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-faint)" }}>
            {sub}
          </span>
        )}
      </span>
      {right && <span style={{ fontSize: 13, fontWeight: 700, color, whiteSpace: "nowrap" }}>{right}</span>}
    </>
  );
  const style = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "11px 12px",
    borderRadius: "var(--r-md)",
    background: "var(--bg-card)",
    border: me ? "1.5px solid var(--accent)" : "1px solid var(--line)",
    color: "var(--text)",
    font: "inherit",
  } as const;
  if (!onClick) return <div style={style}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} style={{ ...style, cursor: "pointer" }}>
      {inner}
    </button>
  );
}

/** Kudos en un detalle: contador opcional (se oculta si no hay dato). */
export function KudosButton({
  kind,
  targetId,
  targetUserId,
  userId,
  initialCount,
  initialGiven,
  onError,
}: {
  kind: "casual" | "league";
  targetId: string;
  targetUserId?: string | null;
  userId: string | null;
  initialCount?: number | null;
  initialGiven?: boolean | null;
  onError?: (msg: string) => void;
}) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState<number | null>(initialCount ?? null);
  const [given, setGiven] = useState(!!initialGiven);
  const busy = useRef(false);

  useEffect(() => {
    if (initialCount != null || !userId) return;
    let off = false;
    fetchKudosSummary(kind, targetId, userId).then((r) => {
      if (off || !r) return;
      setCount(r.count);
      setGiven(r.given);
    });
    return () => {
      off = true;
    };
  }, [kind, targetId, userId, initialCount]);

  if (!userId) return null;

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const pg = given;
    const pc = count;
    setGiven(!pg);
    if (pc != null) setCount(Math.max(0, pc + (pg ? -1 : 1)));
    const res = await toggleActivityKudos(kind, targetId, targetUserId ?? null);
    if (res.ok) {
      setGiven(res.data.given);
      setCount(res.data.count);
    } else {
      setGiven(pg);
      setCount(pc);
      onError?.(res.reason);
    }
    busy.current = false;
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={given}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        padding: "11px 14px",
        borderRadius: "var(--r-md)",
        background: given ? "var(--accent-10)" : "var(--bg-card)",
        border: `1px solid ${given ? "var(--accent-40)" : "var(--line)"}`,
        cursor: "pointer",
        font: "inherit",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
        <motion.span
          aria-hidden="true"
          animate={!given && !reduce ? { scale: [1, 1.22, 1] } : { scale: 1 }}
          transition={!given && !reduce ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          style={{ display: "inline-block" }}
        >
          👏
        </motion.span>
        {given ? "Kudos dado" : "Dar kudos"}
      </span>
      {count != null && (
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {count} kudos{given ? " · incluido el tuyo" : ""}
        </span>
      )}
    </button>
  );
}
