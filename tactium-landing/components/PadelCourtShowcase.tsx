"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// ============================================================================
// PadelCourtShowcase — pista interactiva + banquillo de reservas
// ============================================================================
//
// Cuenta visualmente cómo funciona la app: 2 jugadores nuestros en la pista,
// 5 reservas en el banquillo. Cada 5 s un jugador entra del banquillo y otro
// sale — exactamente lo que el capitán hace en la app para crear variantes.
//
// Arquitectura SVG con 2 capas anidadas por ficha:
//   <g ref=outer> ← position lógica (court/bench). Manejado por gsap.set + tweens.
//     <g ref=inner> ← perturbaciones visuales (idle y, magnetic x + skewX).
//   </g>
// Ningún transform compite con otro.

type Side = "us" | "rival" | "bench";

interface Player {
  id: string;
  name: string;
  pts: number;
  position: "drive" | "reves";
  side: Side;
  // Home guardada en ref imperativa — para que el swap actualice sin
  // disparar re-render de React (que mataría las animaciones GSAP).
  initialHome: { x: number; y: number };
}

// Coordenadas en el espacio del viewBox 600x540.
const HOMES = {
  // Pista — lado "NOSOTROS" (parte inferior de la pista)
  ourDrive: { x: 175, y: 320 },
  ourReves: { x: 425, y: 320 },
  // Pista — lado RIVAL (no entra en swaps)
  rivalDrive: { x: 175, y: 100 },
  rivalReves: { x: 425, y: 100 },
  // Banquillo — 5 huecos espaciados horizontalmente
  bench: [
    { x: 90, y: 490 },
    { x: 210, y: 490 },
    { x: 330, y: 490 },
    { x: 450, y: 490 },
    { x: 570, y: 490 },
  ],
} as const;

const INITIAL_PLAYERS: Player[] = [
  // Nuestros (pista)
  { id: "u1", name: "Carlos M.", pts: 412, position: "drive", side: "us", initialHome: HOMES.ourDrive },
  { id: "u2", name: "Javier R.", pts: 398, position: "reves", side: "us", initialHome: HOMES.ourReves },
  // Rival (pista, estáticos)
  { id: "r1", name: "Rival D.", pts: 380, position: "drive", side: "rival", initialHome: HOMES.rivalDrive },
  { id: "r2", name: "Rival R.", pts: 370, position: "reves", side: "rival", initialHome: HOMES.rivalReves },
  // Banquillo (5 reservas)
  { id: "b1", name: "Marcos L.", pts: 405, position: "drive", side: "bench", initialHome: HOMES.bench[0] },
  { id: "b2", name: "David S.", pts: 390, position: "reves", side: "bench", initialHome: HOMES.bench[1] },
  { id: "b3", name: "Hugo P.", pts: 375, position: "drive", side: "bench", initialHome: HOMES.bench[2] },
  { id: "b4", name: "Iván G.", pts: 362, position: "reves", side: "bench", initialHome: HOMES.bench[3] },
  { id: "b5", name: "Ana T.", pts: 358, position: "drive", side: "bench", initialHome: HOMES.bench[4] },
];

export function PadelCourtShowcase() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const outerRefs = useRef<Record<string, SVGGElement | null>>({});
  const innerRefs = useRef<Record<string, SVGGElement | null>>({});
  // Estado mutable del "dónde está ahora" cada jugador. Lo manejamos
  // imperativamente (ref) para que las animaciones GSAP no reinicien al
  // cambiar la lógica de la pista.
  const placement = useRef<
    Record<string, { x: number; y: number; side: "court-us" | "bench" }>
  >({});
  const [players] = useState<Player[]>(INITIAL_PLAYERS);
  const [hovered, setHovered] = useState<string | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      if (!svgRef.current || !containerRef.current || !contextSafe) return;

      // ── 1. Inicializa posiciones home (outer groups) ───────────────────
      players.forEach((p) => {
        const outer = outerRefs.current[p.id];
        if (outer) {
          gsap.set(outer, { x: p.initialHome.x, y: p.initialHome.y });
          placement.current[p.id] = {
            x: p.initialHome.x,
            y: p.initialHome.y,
            side: p.side === "us" ? "court-us" : p.side === "bench" ? "bench" : "court-us",
          };
        }
      });

      // ── 2. Idle micro-float (inner groups, eje Y) ──────────────────────
      players.forEach((p, idx) => {
        const inner = innerRefs.current[p.id];
        if (!inner) return;
        gsap.to(inner, {
          y: idx % 2 === 0 ? 6 : -6,
          duration: 2.4 + (idx % 4) * 0.3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: (idx % 5) * 0.2,
        });
      });

      // ── 3. Magnetic attraction al cursor (inner groups, X + skew) ──────
      const onMouseMove = contextSafe((event: MouseEvent) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vx = ((event.clientX - rect.left) / rect.width) * 600;
        const vy = ((event.clientY - rect.top) / rect.height) * 540;

        players.forEach((p) => {
          const inner = innerRefs.current[p.id];
          if (!inner) return;
          // Usa placement actual (no initialHome) — así cuando un jugador
          // entra al banquillo, su magnetic origen es su nueva posición.
          const pos = placement.current[p.id] ?? {
            x: p.initialHome.x,
            y: p.initialHome.y,
          };
          const dx = vx - pos.x;
          const dy = vy - pos.y;
          const dist = Math.hypot(dx, dy) || 1;
          const RADIUS = 200;
          const MAX_OFFSET = 14;
          const factor = Math.max(0, 1 - dist / RADIUS);
          const offsetX = (dx / dist) * MAX_OFFSET * factor;
          gsap.to(inner, {
            x: offsetX,
            skewX: offsetX * 0.4,
            duration: 0.55,
            ease: "power2.out",
            overwrite: "auto",
          });
        });
      });

      const container = containerRef.current;
      container.addEventListener("mousemove", onMouseMove);

      const onMouseLeave = contextSafe(() => {
        players.forEach((p) => {
          const inner = innerRefs.current[p.id];
          if (inner) {
            gsap.to(inner, {
              x: 0,
              skewX: 0,
              duration: 0.8,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
        });
      });
      container.addEventListener("mouseleave", onMouseLeave);

      // ── 4. Rotación pista ↔ banquillo cada 5.5 s ───────────────────────
      // Coge un jugador de "court-us" y otro de "bench", intercambia sus
      // posiciones (animando outer) y actualiza el placement ref. Cambio
      // permanente — la siguiente rotación parte de la nueva alineación.
      const rotate = () => {
        const courtIds = Object.entries(placement.current)
          .filter(([, v]) => v.side === "court-us")
          .map(([id]) => id);
        const benchIds = Object.entries(placement.current)
          .filter(([, v]) => v.side === "bench")
          .map(([id]) => id);
        if (courtIds.length === 0 || benchIds.length === 0) return;

        const courtId = courtIds[Math.floor(Math.random() * courtIds.length)];
        const benchId = benchIds[Math.floor(Math.random() * benchIds.length)];
        const outerCourt = outerRefs.current[courtId];
        const outerBench = outerRefs.current[benchId];
        if (!outerCourt || !outerBench) return;

        const courtPos = placement.current[courtId];
        const benchPos = placement.current[benchId];

        // Indicador visual del cambio en proceso — un sutil scale up en el
        // inner durante el cruce, para que el ojo siga la transición.
        const innerCourt = innerRefs.current[courtId];
        const innerBench = innerRefs.current[benchId];

        const tl = gsap.timeline();
        if (innerCourt && innerBench) {
          tl.to(
            [innerCourt, innerBench],
            { scale: 1.12, duration: 0.25, ease: "power2.out", transformOrigin: "center" },
            0,
          );
        }
        tl.to(
          outerCourt,
          {
            x: benchPos.x,
            y: benchPos.y,
            duration: 0.9,
            ease: "power3.inOut",
          },
          0.1,
        ).to(
          outerBench,
          {
            x: courtPos.x,
            y: courtPos.y,
            duration: 0.9,
            ease: "power3.inOut",
          },
          0.1,
        );
        if (innerCourt && innerBench) {
          tl.to(
            [innerCourt, innerBench],
            { scale: 1, duration: 0.35, ease: "power2.out" },
            "-=0.2",
          );
        }

        // Actualiza placement — el siguiente swap leerá las nuevas
        // posiciones desde aquí.
        placement.current[courtId] = { x: benchPos.x, y: benchPos.y, side: "bench" };
        placement.current[benchId] = { x: courtPos.x, y: courtPos.y, side: "court-us" };
      };

      const rotateInterval = window.setInterval(rotate, 5500);

      return () => {
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("mouseleave", onMouseLeave);
        window.clearInterval(rotateInterval);
      };
    },
    { scope: containerRef },
  );

  return (
    <section
      id="court"
      className="relative py-20 sm:py-28 border-t border-[var(--color-hair)] overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,223,130,0.10), transparent 70%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
            EN ACCIÓN
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Pista y banquillo,{" "}
            <span className="text-[var(--color-accent)]">en vivo</span>
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
            Pasa el cursor sobre las fichas. Cada pocos segundos un jugador
            entra del banquillo y otro sale — igual que cuando armas tu
            alineación en la app.
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative mx-auto max-w-3xl aspect-[600/540] rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-hair-strong)] overflow-hidden cursor-default"
        >
          <svg
            ref={svgRef}
            viewBox="0 0 600 540"
            className="w-full h-full block"
            role="img"
            aria-label="Pista de pádel y banquillo interactivos"
          >
            <defs>
              <linearGradient id="court-bg" x1="0" y1="0" x2="0" y2="420">
                <stop offset="0%" stopColor="#0a1f1c" />
                <stop offset="50%" stopColor="#0d2826" />
                <stop offset="100%" stopColor="#0a1f1c" />
              </linearGradient>
              <linearGradient id="bench-bg" x1="0" y1="430" x2="0" y2="540">
                <stop offset="0%" stopColor="#0c1f1c" />
                <stop offset="100%" stopColor="#091715" />
              </linearGradient>
              <radialGradient id="player-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00DF82" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#00DF82" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Fondo pista (0–420) y banquillo (430–540) */}
            <rect x="0" y="0" width="600" height="420" fill="url(#court-bg)" />
            <rect x="0" y="430" width="600" height="110" fill="url(#bench-bg)" />

            {/* Pista */}
            <rect
              x="40"
              y="40"
              width="520"
              height="340"
              rx="6"
              fill="none"
              stroke="rgba(232, 245, 239, 0.30)"
              strokeWidth="2"
            />
            <line x1="40" y1="140" x2="560" y2="140" stroke="rgba(232, 245, 239, 0.20)" strokeWidth="1.5" />
            <line x1="40" y1="280" x2="560" y2="280" stroke="rgba(232, 245, 239, 0.20)" strokeWidth="1.5" />
            <line x1="300" y1="140" x2="300" y2="280" stroke="rgba(232, 245, 239, 0.20)" strokeWidth="1.5" />
            {/* Red central */}
            <line
              x1="40"
              y1="210"
              x2="560"
              y2="210"
              stroke="#00DF82"
              strokeOpacity="0.55"
              strokeWidth="2.5"
              strokeDasharray="2 4"
            />
            {/* Etiquetas de lado */}
            <text x="50" y="395" fill="rgba(232,245,239,0.35)" fontFamily="monospace" fontSize="10" letterSpacing="2">
              NOSOTROS
            </text>
            <text x="50" y="30" fill="rgba(232,245,239,0.35)" fontFamily="monospace" fontSize="10" letterSpacing="2">
              RIVAL
            </text>

            {/* Separador pista ↔ banquillo */}
            <line
              x1="40"
              y1="430"
              x2="560"
              y2="430"
              stroke="rgba(232, 245, 239, 0.15)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <text x="50" y="450" fill="rgba(232,245,239,0.45)" fontFamily="monospace" fontSize="10" letterSpacing="2">
              BANQUILLO
            </text>
            <text x="555" y="450" textAnchor="end" fill="rgba(232,245,239,0.30)" fontFamily="monospace" fontSize="10" letterSpacing="2">
              5 RESERVAS
            </text>

            {/* Fichas — outer/inner anidados */}
            {players.map((p) => (
              <PlayerToken
                key={p.id}
                player={p}
                isHovered={hovered === p.id}
                onHover={(h) => setHovered(h ? p.id : null)}
                outerRefCallback={(el) => {
                  outerRefs.current[p.id] = el;
                }}
                innerRefCallback={(el) => {
                  innerRefs.current[p.id] = el;
                }}
              />
            ))}
          </svg>

          {/* Tooltip flotante */}
          {hovered ? (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 py-1.5 rounded-full bg-[var(--color-bg-raised)] border border-[var(--color-accent-40)] text-xs font-mono tracking-wide text-[var(--color-text)]"
              aria-live="polite"
            >
              <span className="text-[var(--color-accent)]">●</span>{" "}
              {players.find((p) => p.id === hovered)?.name}{" "}
              <span className="text-[var(--color-text-muted)]">
                · {players.find((p) => p.id === hovered)?.pts} pts ·{" "}
                {players.find((p) => p.id === hovered)?.position}
              </span>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs font-mono tracking-widest text-[var(--color-text-faint)]">
          DEMO INTERACTIVA · POWERED BY GSAP
        </p>
      </div>
    </section>
  );
}

// ─── PlayerToken ────────────────────────────────────────────────────────────
// Outer group: posición lógica (GSAP-managed).
// Inner group: idle + magnetic + hover/scale.
// Las fichas del banquillo son visualmente más pequeñas y dim para denotar
// jerarquía (NIVEL primero pista > banquillo > rival).

interface PlayerTokenProps {
  player: Player;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
  outerRefCallback: (el: SVGGElement | null) => void;
  innerRefCallback: (el: SVGGElement | null) => void;
}

function PlayerToken({
  player,
  isHovered,
  onHover,
  outerRefCallback,
  innerRefCallback,
}: PlayerTokenProps) {
  const initials = player.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Tamaño/intensidad según el rol. Bench más pequeño; rival outline gris.
  const isBench = player.side === "bench";
  const isRival = player.side === "rival";
  const baseR = isBench ? 16 : 22;
  const hoverR = isBench ? 20 : 26;
  const strokeColor = isRival ? "rgba(232,245,239,0.45)" : "#00DF82";
  const textColor = isRival ? "rgba(232,245,239,0.55)" : "#00DF82";
  const tokenOpacity = isBench ? 0.85 : 1;

  return (
    <g ref={outerRefCallback}>
      <g
        ref={innerRefCallback}
        style={{
          cursor: "pointer",
          opacity: tokenOpacity,
          transition: "filter 200ms ease, opacity 200ms ease",
          filter: isHovered
            ? `drop-shadow(0 0 16px ${isRival ? "rgba(232,245,239,0.35)" : "rgba(0,223,130,0.6)"})`
            : "none",
        }}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        <circle
          r="38"
          fill="url(#player-glow)"
          opacity={isRival ? 0 : isHovered ? 1 : isBench ? 0.18 : 0.35}
          style={{ transition: "opacity 200ms ease" }}
        />
        <circle
          r={isHovered ? hoverR : baseR}
          fill="#081818"
          stroke={strokeColor}
          strokeWidth={isHovered ? 2.5 : 1.5}
          style={{ transition: "r 200ms ease, stroke-width 200ms ease" }}
        />
        <text
          textAnchor="middle"
          dy="0.35em"
          fill={textColor}
          fontFamily="monospace"
          fontSize={isBench ? 11 : 13}
          fontWeight="700"
          letterSpacing="0.5"
        >
          {initials}
        </text>
      </g>
    </g>
  );
}
