"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
} from "motion/react";
import { useEffect, type ReactNode } from "react";

/**
 * Piezas de movimiento compartidas por la entrada, el onboarding y el paywall.
 *
 * Todas respetan `prefers-reduced-motion`: con él activo el contenido está
 * quieto desde el principio (sin desplazamientos ni conteos), no «salta».
 */

/** Curva de la casa (`--ease` de globals.css). */
export const EASE = [0.16, 1, 0.3, 1] as const;

/* ── Contenedor + elementos escalonados ─────────────────────────── */

export function Stagger({
  children,
  gap = 0.06,
  delay = 0,
  ...rest
}: { children: ReactNode; gap?: number; delay?: number } & Omit<
  HTMLMotionProps<"div">,
  "children"
>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
};

/** Hijo de `Stagger`. Hereda el arranque del padre. */
export function StaggerItem({
  children,
  ...rest
}: { children: ReactNode } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div variants={ITEM_VARIANTS} {...rest}>
      {children}
    </motion.div>
  );
}

/* ── Barra de progreso del onboarding ───────────────────────────── */

/**
 * «PASO N DE 2» con su barra. En la web hay dos pasos (lo tuyo y tu gente):
 * no hay paso de avisos porque la web no tiene push.
 */
export function StepProgress({
  step,
  total = 2,
  aside,
}: {
  step: number;
  total?: number;
  /** Acción discreta a la derecha («Lo haré luego», «Atrás»…). */
  aside?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        role="progressbar"
        aria-label={`Paso ${step} de ${total}`}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
          gap: 6,
        }}
      >
        {Array.from({ length: total }, (_, i) => {
          const filled = i < step;
          // El tramo del paso actual es el que se dibuja; los anteriores ya
          // llegan llenos.
          const current = i === step - 1;
          return (
            <span
              key={i}
              style={{
                height: 4,
                borderRadius: 2,
                background: "var(--line-strong)",
                overflow: "hidden",
                display: "block",
              }}
            >
              {filled && (
                <motion.span
                  initial={reduce || !current ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
                  style={{
                    display: "block",
                    height: "100%",
                    background: "var(--accent)",
                    transformOrigin: "left center",
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span className="eyebrow eyebrow-accent">
          Paso {step} de {total}
        </span>
        {aside}
      </div>
    </div>
  );
}

/* ── Número que cuenta hacia arriba ─────────────────────────────── */

export function CountUp({
  to,
  duration = 0.9,
  className,
  style,
}: {
  to: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? to : 0);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());

  useEffect(() => {
    if (reduce) {
      mv.set(to);
      return;
    }
    const ctrl = animate(mv, to, { duration, ease: EASE });
    return () => ctrl.stop();
  }, [to, duration, reduce, mv]);

  return (
    <motion.span className={className} style={style} aria-label={String(to)}>
      {rounded}
    </motion.span>
  );
}
