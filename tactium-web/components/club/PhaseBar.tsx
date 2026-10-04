"use client";

import { motion, useReducedMotion } from "motion/react";

import { PHASES, PHASE_LABEL, type PhaseIndex } from "@/lib/club-ops";

/**
 * Barra de las 5 fases de un torneo (Inscripción → Pago → Cuadros → En juego →
 * Final). La fase «Pago» va en ámbar: es la que pide una acción del club.
 */
export function PhaseBar({ phase, compact }: { phase: PhaseIndex; compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Fase: ${PHASE_LABEL[phase]}, ${phase + 1} de 5`}
      style={{ minWidth: compact ? 140 : undefined }}
    >
      <div style={{ display: "flex", gap: 3 }}>
        {PHASES.map((p, i) => (
          <span
            key={p}
            style={{
              flex: 1,
              height: compact ? 4 : 5,
              borderRadius: 3,
              background:
                i < phase
                  ? "var(--accent)"
                  : i === phase
                    ? phase === 1
                      ? "var(--warning)"
                      : "var(--accent)"
                    : "var(--line-strong)",
            }}
          />
        ))}
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
          {PHASES.map((p, i) => (
            <span
              key={p}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 11,
                color: i === phase ? "var(--text)" : "var(--text-faint)",
                fontWeight: i === phase ? 700 : 500,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Punto «en directo» que late (quieto con movimiento reducido). */
export function LiveDot() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: 4,
        background: "var(--accent)",
        marginRight: 6,
      }}
      animate={reduce ? undefined : { opacity: [1, 0.25, 1] }}
      transition={reduce ? undefined : { duration: 1.4, repeat: Infinity }}
    />
  );
}
