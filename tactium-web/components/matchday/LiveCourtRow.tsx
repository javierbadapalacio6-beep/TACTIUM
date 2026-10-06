import Link from "next/link";

import type { CourtOutcome, LiveSet } from "@/lib/live";

/**
 * Una pista en directo: «P2 · En juego» a la izquierda, nuestra pareja y el
 * rival en dos líneas y los juegos por set a la derecha (el set en curso
 * resaltado). Patrón de las listas en directo de Sofascore, con tokens de
 * TACTIUM. Lo comparten la jornada del equipo y la página pública.
 */
export function LiveCourtRow({
  n,
  pair,
  rival,
  outcome,
  forfeit,
  sets,
  currentIdx,
  action,
  actionTone,
  href,
}: {
  n: number;
  pair: string;
  rival: string;
  outcome: CourtOutcome;
  forfeit: boolean;
  sets: LiveSet[];
  /** Índice del set en curso (−1 si no hay). */
  currentIdx: number;
  action?: string | null;
  actionTone?: "accent" | "warning";
  href?: string | null;
}) {
  const status = forfeit
    ? "W.O."
    : outcome === "live"
      ? "En juego"
      : outcome === "won" || outcome === "lost"
        ? "Final"
        : "—";
  const statusColor =
    outcome === "live"
      ? "var(--error)"
      : outcome === "won"
        ? "var(--accent)"
        : outcome === "lost"
          ? "var(--text-muted)"
          : "var(--text-faint)";
  const body = (
    <>
      <div>
        <div className="tw-live-court mono">P{n}</div>
        <div className="tw-live-status" style={{ color: statusColor }}>
          {status}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="tw-live-name" style={outcome === "won" ? { color: "var(--accent)" } : undefined}>
          {pair}
        </div>
        <div className="tw-live-name is-rival">{rival}</div>
        {action ? (
          <div className="tw-live-action" style={actionTone === "warning" ? { color: "var(--warning)" } : undefined}>
            {action} ›
          </div>
        ) : null}
      </div>
      <div className="tw-live-sets mono" aria-label={sets.map((s) => `${s.us}-${s.them}`).join(", ") || "Sin juegos"}>
        {sets.map((s, i) => {
          const cur = i === currentIdx;
          return (
            <div key={i} className={"tw-live-set" + (cur ? " is-current" : "")}>
              <span className={!cur && s.us > s.them ? "is-win" : undefined}>{s.us}</span>
              <span className={!cur && s.them > s.us ? "is-win" : undefined}>{s.them}</span>
            </div>
          );
        })}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="tw-live-row" aria-label={`Pista ${n}: ${pair}. ${status}`}>
      {body}
    </Link>
  ) : (
    <div className="tw-live-row">{body}</div>
  );
}
