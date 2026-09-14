import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Eyebrow, H1, useEnter, useSceneFade } from "../ui";

type NodeSpec = {
  id: string;
  title: string;
  sub: string;
  badge?: string;
  x: number;
  y: number;
  w: number;
  delay: number;
  accent?: boolean;
};

// Coordenadas sobre un lienzo de 1700x640 anclado abajo-izquierda en (110, 330).
const NODES: NodeSpec[] = [
  { id: "app", title: "App móvil", sub: "React Native + Expo", badge: "OTA · EAS", x: 90, y: 0, w: 400, delay: 40 },
  { id: "web", title: "Web app", sub: "Next.js", badge: "Vercel", x: 650, y: 0, w: 380, delay: 58 },
  { id: "landing", title: "Landing", sub: "Next.js + GSAP", badge: "Vercel", x: 1180, y: 0, w: 380, delay: 76 },
  { id: "supa", title: "Supabase", sub: "Postgres · RLS · Edge Functions · Cron", x: 480, y: 250, w: 700, delay: 110, accent: true },
  { id: "stripe", title: "Stripe", sub: "pagos web", x: 40, y: 500, w: 340, delay: 185 },
  { id: "rc", title: "RevenueCat", sub: "IAP iOS / Android", x: 460, y: 500, w: 360, delay: 203 },
  { id: "resend", title: "Resend", sub: "emails transaccionales", x: 900, y: 500, w: 380, delay: 221 },
  { id: "fcp", title: "Agente FCP", sub: "Node.js · datos federados", x: 1360, y: 500, w: 340, delay: 239 },
];

const EDGES: Array<[string, string, number]> = [
  ["app", "supa", 135],
  ["web", "supa", 148],
  ["landing", "supa", 161],
  ["stripe", "supa", 255],
  ["rc", "supa", 268],
  ["resend", "supa", 281],
  ["fcp", "supa", 294],
];

const center = (n: NodeSpec, edge: "top" | "bottom") => ({
  cx: n.x + n.w / 2,
  cy: edge === "top" ? n.y : n.y + 110,
});

export const S6Arquitectura: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: "absolute", top: 100, left: 110, display: "flex", flexDirection: "column", gap: 22 }}>
        <Eyebrow>04 · Arquitectura</Eyebrow>
        <H1 size={72}>Una sola base de datos para todo el ecosistema</H1>
      </div>

      <div style={{ position: "absolute", left: 110, top: 330, width: 1700, height: 640 }}>
        <svg width={1700} height={640} style={{ position: "absolute", inset: 0 }}>
          {EDGES.map(([fromId, toId, delay]) => {
            const from = byId[fromId];
            const to = byId[toId];
            const a = center(from, from.y < to.y ? "bottom" : "top");
            const b = center(to, from.y < to.y ? "top" : "bottom");
            const progress = interpolate(frame, [delay, delay + 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
            return (
              <line
                key={`${fromId}-${toId}`}
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke={C.deep}
                strokeWidth={2.5}
                strokeDasharray={len}
                strokeDashoffset={len * (1 - progress)}
                opacity={progress === 0 ? 0 : 0.9}
              />
            );
          })}
        </svg>

        {NODES.map((n) => (
          <ArchNode key={n.id} spec={n} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ArchNode: React.FC<{ spec: NodeSpec }> = ({ spec }) => {
  const st = useEnter(spec.delay, 26);
  return (
    <div
      style={{
        ...st,
        position: "absolute",
        left: spec.x,
        top: spec.y,
        width: spec.w,
        height: 110,
        borderRadius: 18,
        background: spec.accent ? "rgba(0,223,130,0.10)" : "rgba(16,35,34,0.92)",
        border: `1.5px solid ${spec.accent ? C.green : C.n40}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 28px",
        gap: 6,
        boxShadow: spec.accent ? "0 0 60px rgba(0,223,130,0.12)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 30, color: C.ink }}>
          {spec.title}
        </div>
        {spec.badge ? (
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 16,
              color: C.green,
              border: `1px solid ${C.deep}`,
              borderRadius: 6,
              padding: "2px 10px",
            }}
          >
            {spec.badge}
          </div>
        ) : null}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 19, color: spec.accent ? C.green : C.n60 }}>
        {spec.sub}
      </div>
    </div>
  );
};
