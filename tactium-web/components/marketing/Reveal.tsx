"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

/**
 * Aparece al entrar en pantalla (una vez). Con `prefers-reduced-motion` no
 * anima nada: el contenido está ahí desde el principio.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  style,
  as = "div",
  onMouseMove,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "li" | "article";
  onMouseMove?: (e: MouseEvent<HTMLElement>) => void;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Plain = as;
    return (
      <Plain className={className} style={style} onMouseMove={onMouseMove}>
        {children}
      </Plain>
    );
  }
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      style={style}
      onMouseMove={onMouseMove}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </Tag>
  );
}
