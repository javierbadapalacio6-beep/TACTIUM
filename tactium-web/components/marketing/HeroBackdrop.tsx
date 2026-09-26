"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { PadelCourt3D } from "@/components/PadelCourt3D";

const CourtScene = dynamic(() => import("./CourtScene"), {
  ssr: false,
  loading: () => null,
});

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Fondo del hero. Three.js cuando se puede; si no hay WebGL cae a la pista en
 * `<canvas>` 2D de siempre. Con `prefers-reduced-motion` la escena se queda
 * quieta. Fuera de pantalla se detiene el bucle de render.
 */
export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"pending" | "gl" | "canvas">("pending");
  const [still, setStill] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    setStill(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    setMode(hasWebGL() ? "gl" : "canvas");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="mk-hero-3d" aria-hidden="true">
      {mode === "gl" && <CourtScene active={active} still={still} />}
      {mode === "canvas" && <PadelCourt3D centerX={0.62} />}
    </div>
  );
}
