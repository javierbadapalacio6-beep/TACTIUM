"use client";

/**
 * Guía sobre la propia pantalla («coach marks»), la misma que en la app (`TACTIUM/src/components/ui/CoachTour.tsx`):
 * velo oscuro con un hueco sobre el elemento que se explica, un globo con flecha, contador y «Saltar». Sale una
 * vez (se recuerda en el navegador) y se repite desde Ajustes. Los elementos se localizan por selector CSS;
 * si no existe (o no se ve), el paso sale como tarjeta centrada.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Btn } from "@/components/ui";

export interface CoachStep {
  /** Selector CSS del elemento. Sin él, tarjeta centrada. */
  target?: string;
  title: string;
  text: string;
  /** Pasos de la mecánica, numerados. */
  chips?: string[];
}

const key = (id: string, scope?: string | null) => `tutorial:coach:${id}${scope ? `:${scope}` : ""}`;

export function useCoach(id: string, scope: string | null | undefined, enabled: boolean, delayMs = 1200) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        if (!window.localStorage.getItem(key(id, scope))) setVisible(true);
      } catch {
        /* sin almacenamiento: no insistimos */
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [id, scope, enabled, delayMs]);
  const finish = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(key(id, scope), "1");
    } catch {
      /* sin almacenamiento */
    }
  }, [id, scope]);
  return { visible, finish };
}

type Box = { x: number; y: number; w: number; h: number };
const PAD = 6;

export function CoachTour({
  coach,
  steps,
}: {
  coach: { visible: boolean; finish: () => void };
  steps: CoachStep[];
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleH, setBubbleH] = useState(220);
  const step = steps[i];

  useEffect(() => {
    if (coach.visible) setI(0);
  }, [coach.visible]);

  useEffect(() => {
    if (!coach.visible || !step) return;
    const measure = () => {
      const el = step.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return setBox(null);
      setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    const el = step.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    const t = setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [coach.visible, i, step]);

  useEffect(() => {
    if (bubbleRef.current) setBubbleH(bubbleRef.current.offsetHeight);
  });

  useEffect(() => {
    if (!coach.visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && coach.finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [coach]);

  if (!coach.visible || !step) return null;
  const last = i === steps.length - 1;
  const W = typeof window !== "undefined" ? window.innerWidth : 1000;
  const H = typeof window !== "undefined" ? window.innerHeight : 800;
  const bw = Math.min(380, W - 32);

  const hole = box
    ? { x: Math.max(box.x - PAD, 0), y: Math.max(box.y - PAD, 0), w: box.w + PAD * 2, h: box.h + PAD * 2 }
    : null;
  const below = hole ? hole.y + hole.h + 14 + bubbleH <= H : false;
  const left = hole ? Math.min(Math.max(hole.x + hole.w / 2 - bw / 2, 16), W - bw - 16) : (W - bw) / 2;
  const top = hole
    ? below
      ? hole.y + hole.h + 14
      : Math.max(hole.y - 14 - bubbleH, 16)
    : Math.max((H - bubbleH) / 2, 16);

  return (
    <div role="dialog" aria-modal="true" aria-label={step.title} style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      {/* Velo: si hay elemento, el hueco lo hace el propio box-shadow */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", inset: 0, background: hole ? "transparent" : "rgba(4,10,8,0.72)" }}
      />
      {hole ? (
        <div
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y,
            width: hole.w,
            height: hole.h,
            borderRadius: 14,
            border: "2px solid var(--accent)",
            boxShadow: "0 0 0 9999px rgba(4,10,8,0.72)",
            pointerEvents: "none",
            transition: "all .2s ease",
          }}
        />
      ) : null}
      <div
        ref={bubbleRef}
        style={{
          position: "absolute",
          left,
          top,
          width: bw,
          padding: 16,
          borderRadius: "var(--r-lg, 16px)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "0 18px 50px rgba(0,0,0,.35)",
          display: "grid",
          gap: 6,
        }}
      >
        {hole ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              width: 14,
              height: 14,
              background: "var(--surface)",
              borderLeft: "1px solid var(--line)",
              borderTop: "1px solid var(--line)",
              transform: "rotate(45deg)",
              left: Math.min(Math.max(hole.x + hole.w / 2 - left - 7, 18), bw - 32),
              ...(below ? { top: -8 } : { bottom: -8, transform: "rotate(225deg)" }),
            }}
          />
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: "var(--text-faint)" }}>
            {i + 1}/{steps.length}
          </span>
          {!last ? (
            <button
              type="button"
              onClick={coach.finish}
              style={{ cursor: "pointer", border: 0, borderRadius: 999, padding: "3px 9px", background: "var(--accent-10)", color: "var(--accent)", fontWeight: 800, fontSize: 10.5, letterSpacing: 0.8 }}
            >
              SALTAR
            </button>
          ) : null}
        </div>
        <h3 style={{ margin: 0, fontSize: 17 }}>{step.title}</h3>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.45 }}>{step.text}</p>
        {step.chips ? (
          <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
            {step.chips.map((ch, n) => (
              <div key={ch} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 10, background: "var(--accent-10)" }}>
                <span style={{ width: 20, height: 20, borderRadius: 10, background: "var(--accent)", color: "#04110B", fontSize: 11.5, fontWeight: 800, display: "grid", placeItems: "center", flex: "none" }}>
                  {n + 1}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{ch}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {steps.map((_, n) => (
              <span key={n} style={{ width: n === i ? 18 : 6, height: 6, borderRadius: 3, background: n === i ? "var(--accent)" : "var(--line)" }} />
            ))}
          </div>
          <Btn variant="accent" onClick={() => (last ? coach.finish() : setI(i + 1))}>
            {last ? "Entendido" : "Siguiente"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
