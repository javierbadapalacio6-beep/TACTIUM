"use client";

import { useEffect, useState, type ReactNode, type ElementType } from "react";

// Entrada suave (fade + slide-up) al montar, con retardo opcional para
// escalonar listas. Autocontenida (CSS inline, sin librerías) y respeta
// prefers-reduced-motion. Es el primitivo de animación común de toda la app web.
export function Reveal({
  children,
  delay = 0,
  y = 12,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  as?: ElementType;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) {
      setShown(true);
      return;
    }
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay, reduce]);

  return (
    <Tag
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : `translateY(${y}px)`,
        transition:
          "opacity 520ms cubic-bezier(0.22,1,0.36,1), transform 520ms cubic-bezier(0.22,1,0.36,1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}
