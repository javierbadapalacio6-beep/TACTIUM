"use client";

import { useEffect, useRef } from "react";

// Fondo 3D del hero (copiado tal cual de tactium-landing; si tocas uno,
// toca el otro). Motor propio sobre <canvas>, cero dependencias.
// Fondo 3D del hero: una pista de pádel en wireframe (verde neón) que gira sola
// y hace parallax con el ratón. Motor 3D propio sobre <canvas> (sin three.js ni
// dependencias nuevas). `pointer-events:none` → nunca roba clics al formulario.
// Respeta `prefers-reduced-motion` (se queda quieta en un ángulo bonito).
export function PadelCourt3D({ centerX = 0.6 }: { centerX?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Color de acento desde los tokens (fallback al verde TACTIUM).
    const accentHex =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim() || "#00DF82";
    const rgb = hexToRgb(accentHex) ?? { r: 0, g: 223, b: 130 };
    const A = (a: number) => `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;

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

    // ── Modelo de la pista (metros, centrada en el origen) ──────────────────
    // X = largo (±10), Z = ancho (±5), Y = alto (0..4).
    const L = 10,
      Wd = 5,
      Ht = 4,
      gh = 3;
    type Seg = [number, number, number, number, number, number, number];
    const S: Seg[] = [];
    const seg = (
      a: [number, number, number],
      b: [number, number, number],
      k = 0
    ) => S.push([a[0], a[1], a[2], b[0], b[1], b[2], k]);
    // Suelo
    seg([-L, 0, -Wd], [L, 0, -Wd], 1);
    seg([L, 0, -Wd], [L, 0, Wd], 1);
    seg([L, 0, Wd], [-L, 0, Wd], 1);
    seg([-L, 0, Wd], [-L, 0, -Wd], 1);
    // Techo del cajón
    seg([-L, Ht, -Wd], [L, Ht, -Wd], 3);
    seg([L, Ht, -Wd], [L, Ht, Wd], 3);
    seg([L, Ht, Wd], [-L, Ht, Wd], 3);
    seg([-L, Ht, Wd], [-L, Ht, -Wd], 3);
    // Verticales (esquinas de cristal)
    seg([-L, 0, -Wd], [-L, Ht, -Wd], 3);
    seg([L, 0, -Wd], [L, Ht, -Wd], 3);
    seg([L, 0, Wd], [L, Ht, Wd], 3);
    seg([-L, 0, Wd], [-L, Ht, Wd], 3);
    // Media altura de cristal en fondos
    seg([-L, gh, -Wd], [-L, gh, Wd], 3);
    seg([L, gh, -Wd], [L, gh, Wd], 3);
    // Red + postes
    seg([0, 0, -Wd], [0, 0, Wd], 2);
    seg([0, 0, -Wd], [0, 1, -Wd], 2);
    seg([0, 0, Wd], [0, 1, Wd], 2);
    seg([0, 1, -Wd], [0, 1, Wd], 2);
    // Líneas de saque + central
    seg([-5, 0, -Wd], [-5, 0, Wd], 1);
    seg([5, 0, -Wd], [5, 0, Wd], 1);
    seg([-5, 0, 0], [5, 0, 0], 1);

    // Partículas de atmósfera
    const P: [number, number, number, number][] = [];
    for (let i = 0; i < 60; i++)
      P.push([
        (Math.random() * 2 - 1) * 16,
        Math.random() * 9,
        (Math.random() * 2 - 1) * 9,
        Math.random(),
      ]);

    // ── Estado de cámara ────────────────────────────────────────────────────
    let rotY = 0.5,
      tilt = -0.5,
      targetRotY = 0.5,
      targetTilt = -0.5,
      paraX = 0;
    const camDist = 30;

    const project = (x: number, y: number, z: number) => {
      const cy = Math.cos(rotY),
        sy = Math.sin(rotY);
      const x1 = x * cy + z * sy,
        z1 = -x * sy + z * cy;
      const ct = Math.cos(tilt),
        st = Math.sin(tilt);
      const y2 = y * ct - z1 * st,
        z2 = y * st + z1 * ct;
      const zc = z2 + camDist;
      const f = Math.min(W, H) * (W > 900 ? 0.9 : 0.62);
      const s = f / zc;
      return [W * centerX + x1 * s, H * 0.55 - y2 * s, zc, s] as const;
    };
    const shade = (kind: number, depth: number) => {
      const a = 0.22 + 0.78 * depth;
      if (kind === 2) return `rgba(255,255,255,${(0.42 * a).toFixed(3)})`;
      if (kind === 3) return A(+(0.28 * a).toFixed(3));
      return A(+(0.8 * a).toFixed(3));
    };

    const drawBall = (time: number) => {
      const bx = Math.sin(time * 0.6) * 7;
      const bz = Math.cos(time * 0.45) * 3.4;
      const by = Math.abs(Math.sin(time * 1.7)) * 3 + 0.25;
      const p = project(bx, by, bz);
      const r = Math.max(4, 130 / p[2]);
      const sp = project(bx, 0.02, bz);
      ctx.beginPath();
      ctx.ellipse(sp[0], sp[1], r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.save();
      ctx.shadowBlur = 24;
      ctx.shadowColor = accentHex;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(
        p[0] - r * 0.3,
        p[1] - r * 0.3,
        r * 0.2,
        p[0],
        p[1],
        r
      );
      g.addColorStop(0, "#eafff6");
      g.addColorStop(0.5, accentHex);
      g.addColorStop(1, A(0.85));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    };

    let raf = 0;
    const render = (ms: number) => {
      const time = ms * 0.001;
      if (!reduce) targetRotY += 0.0015;
      rotY += (targetRotY + paraX - rotY) * 0.06;
      tilt += (targetTilt - tilt) * 0.06;

      ctx.clearRect(0, 0, W, H);

      // Partículas
      for (const q of P) {
        const p = project(q[0], q[1], q[2]);
        if (p[2] <= 0.1) continue;
        const d = Math.max(0, Math.min(1, (camDist + 14 - p[2]) / 28));
        ctx.globalAlpha = 0.08 + 0.28 * d * q[3];
        ctx.fillStyle = accentHex;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 0.7 + 1.5 * d, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Segmentos (lejos → cerca)
      const drawn: [number, ReturnType<typeof project>, ReturnType<typeof project>, number][] =
        [];
      for (const s of S) {
        const a = project(s[0], s[1], s[2]);
        const b = project(s[3], s[4], s[5]);
        if (a[2] <= 0.1 || b[2] <= 0.1) continue;
        drawn.push([(a[2] + b[2]) / 2, a, b, s[6]]);
      }
      drawn.sort((m, n) => n[0] - m[0]);
      ctx.lineCap = "round";
      for (const it of drawn) {
        const [zc, a, b, kind] = it;
        const depth = Math.max(0, Math.min(1, (camDist + 16 - zc) / 30));
        ctx.strokeStyle = shade(kind, depth);
        ctx.lineWidth = (kind === 2 ? 1.2 : kind === 3 ? 1 : 1.7) * (0.6 + depth);
        ctx.save();
        if (kind !== 2) {
          ctx.shadowBlur = 10 * depth;
          ctx.shadowColor = accentHex;
        }
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.restore();
      }

      drawBall(reduce ? 2.1 : time);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    // Parallax con el ratón (global, sin capturar eventos del canvas)
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      paraX += (nx * 0.45 - paraX) * 0.5;
      targetTilt = -0.5 - ny * 0.22;
    };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [centerX]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
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
