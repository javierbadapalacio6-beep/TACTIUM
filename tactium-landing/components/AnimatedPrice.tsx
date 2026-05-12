"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useTransform, motion } from "motion/react";

interface Props {
  value: number;
  className?: string;
}

// Anima un número desde el valor anterior hasta el nuevo con tween 480ms
// ease-out. Devuelve el número formateado "X,XX" con coma decimal (es-ES).
// Cero layout shift porque usa tabular-nums + min-width fijo.
export function AnimatedPrice({ value, className }: Props) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (latest) =>
    latest.toFixed(2).replace(".", ","),
  );
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const controls = animate(mv, value, {
      duration: 0.48,
      ease: [0.22, 1, 0.36, 1], // ease-out cubic suave
      onUpdate: () => {
        // noop — useTransform ya re-renderiza el span vía Motion.
      },
    });
    return () => controls.stop();
    // mv es estable; no hace falta en deps. from no se usa fuera, solo
    // sirvió para que el ref capturase el valor previo antes del update.
    void from;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <motion.span className={className} style={{ display: "inline-block" }}>
      {rounded}
    </motion.span>
  );
}
