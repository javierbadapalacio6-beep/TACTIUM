"use client";

import { useEffect, useRef, useState } from "react";

import { LOGO_PATHS, LOGO_VIEWBOX } from "./LogoMark";

/**
 * Spinner de marca: el isotipo de TACTIUM girando en 3D.
 *
 * Para esperas que se hacen largas — no para cada carga. Un spinner que
 * aparece al instante en algo que tarda 200 ms sólo consigue que la pantalla
 * parpadee, así que `LogoSpinner` lo retrasa (ver su `delayMs`).
 *
 * No es un dibujo parecido al logo: son los TRAZOS REALES del isotipo
 * (`LogoMark`, calcado de `tactium-landing/public/brand/logo.svg`). Se
 * muestrean con la API de geometría de SVG (`getPointAtLength`), que resuelve
 * las curvas por nosotros, se extruyen en Z y se proyectan a mano con
 * perspectiva. Motor propio sobre <canvas>: cero dependencias 3D.
 *
 * Lee `--color-accent`, así que en tema claro se repinta a #00995E solo.
 * Con `prefers-reduced-motion` se queda quieto en un ángulo con volumen.
 */

const VIEWBOX = LOGO_VIEWBOX;
/** Un punto cada N unidades de contorno: suficiente para que no se vea facetado. */
const SAMPLE_STEP = 9;
/** Media profundidad de la extrusión, en unidades normalizadas. */
const DEPTH = 0.115;

type Pt = { x: number; y: number };

/** Muestrea cada trazo del logo a polígono, centrado y normalizado a [-1, 1]. */
function samplePaths(): Pt[][] {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.opacity = "0";
  svg.style.pointerEvents = "none";
  document.body.appendChild(svg);

  const half = VIEWBOX / 2;
  const out: Pt[][] = [];

  try {
    for (const d of LOGO_PATHS) {
      const el = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      el.setAttribute("d", d);
      svg.appendChild(el);

      const len = el.getTotalLength();
      if (!len) continue;
      const n = Math.max(24, Math.round(len / SAMPLE_STEP));
      const poly: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const p = el.getPointAtLength((i / n) * len);
        // Centrado y normalizado; la Y del SVG crece hacia abajo y aquí arriba.
        poly.push({ x: (p.x - half) / half, y: -(p.y - half) / half });
      }
      out.push(poly);
    }
  } finally {
    svg.remove();
  }

  return out;
}

export function TactiumLogo3D() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const accentHex =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim() || "#00DF82";
    const rgb = hexToRgb(accentHex) ?? { r: 0, g: 223, b: 130 };
    const A = (a: number) => `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;

    const polys = samplePaths();
    if (!polys.length) return;

    let W = 0,
      H = 0,
      DPR = 1;
    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const paraY = 0;
    let targetTilt = 0.16;

    let raf = 0;
    let tilt = 0.16;
    const t0 = performance.now();

    const render = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Giro continuo: es un spinner. El vaivén de la inclinación evita que
      // se vea de canto justo cuando pasa por el perfil.
      const spin = reduce ? -0.5 : t * 1.5 + paraY;
      targetTilt = reduce ? 0.16 : 0.16 + Math.sin(t * 0.9) * 0.12;
      tilt += (targetTilt - tilt) * 0.08;

      const cosY = Math.cos(spin),
        sinY = Math.sin(spin);
      const cosX = Math.cos(tilt),
        sinX = Math.sin(tilt);

      const scale = Math.min(W, H) * 0.42;
      const cx = W / 2;
      const cy = H / 2;
      const FOV = 3.4;

      const project = (x: number, y: number, z: number) => {
        // Y primero (el giro), luego X (la inclinación).
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const f = FOV / (FOV + z2);
        return { x: cx + x1 * f * scale, y: cy - y2 * f * scale, f };
      };

      // Cuánto vemos el canto: de frente casi nada, de perfil todo.
      const edgeOn = Math.abs(sinY);

      for (const poly of polys) {
        const front = poly.map((p) => project(p.x, p.y, DEPTH));
        const back = poly.map((p) => project(p.x, p.y, -DEPTH));

        // Costados de la extrusión: sólo se dibujan cuando hay canto que ver.
        if (edgeOn > 0.06) {
          ctx.strokeStyle = A(0.1 + edgeOn * 0.16);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < front.length; i += 3) {
            ctx.moveTo(front[i].x, front[i].y);
            ctx.lineTo(back[i].x, back[i].y);
          }
          ctx.stroke();
        }

        // Cara trasera, apagada: da el volumen sin ensuciar.
        traceP(ctx, back);
        ctx.strokeStyle = A(0.18);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Cara frontal: relleno tenue + contorno nítido.
        traceP(ctx, front);
        ctx.fillStyle = A(0.07);
        ctx.fill();
        ctx.strokeStyle = A(0.72);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      if (!reduce) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

/**
 * Spinner listo para usar: cuadrado, centrado y con RETARDO.
 *
 * El retardo es lo importante. Si la respuesta llega en 200 ms, enseñar y
 * quitar un spinner es un parpadeo que se percibe como que algo ha fallado;
 * sólo aparece cuando la espera empieza a notarse de verdad.
 */
export function LogoSpinner({
  size = 96,
  delayMs = 450,
  label = "Cargando…",
}: {
  size?: number;
  delayMs?: number;
  label?: string;
}) {
  const [show, setShow] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "grid",
        placeItems: "center",
        gap: 14,
        padding: "32px 0",
        opacity: show ? 1 : 0,
        transition: "opacity 240ms var(--ease)",
      }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        {show && <TactiumLogo3D />}
      </div>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function traceP(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length === 3) {
    return {
      r: parseInt(m[0] + m[0], 16),
      g: parseInt(m[1] + m[1], 16),
      b: parseInt(m[2] + m[2], 16),
    };
  }
  if (m.length === 6) {
    return {
      r: parseInt(m.slice(0, 2), 16),
      g: parseInt(m.slice(2, 4), 16),
      b: parseInt(m.slice(4, 6), 16),
    };
  }
  return null;
}
