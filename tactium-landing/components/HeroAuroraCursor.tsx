"use client";

import { useEffect, useRef } from "react";

// Hace que la aurora principal del Hero siga el cursor con un lerp
// suavizado. Solo escucha mousemove en el viewport del Hero y escribe
// CSS variables para que el blur/radial-gradient se desplace via CSS
// (sin re-renders de React, sin layout thrash).
//
// Respeta prefers-reduced-motion: si activo, no hace nada y la aurora
// queda estática como antes.
export function HeroAuroraCursor() {
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 50, y: 30 });
  const currentRef = useRef({ x: 50, y: 30 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hero = document.getElementById("hero");
    if (!hero) return;

    const tick = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      // Lerp factor pequeño = arrastre lento, "vapor". 0.08 = sensacion premium.
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      hero.style.setProperty("--aurora-x", `${cur.x}%`);
      hero.style.setProperty("--aurora-y", `${cur.y}%`);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      // Solo trackear cuando el cursor esta dentro del bounding box del hero
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      targetRef.current.x = ((e.clientX - rect.left) / rect.width) * 100;
      targetRef.current.y = ((e.clientY - rect.top) / rect.height) * 100;
    };

    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return null;
}
