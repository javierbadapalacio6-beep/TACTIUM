import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Card, Eyebrow, H1, Sub, useEnter, useSceneFade } from "../ui";

const Node: React.FC<{ title: string; sub: string; delay: number; accent?: boolean }> = ({
  title,
  sub,
  delay,
  accent,
}) => {
  const st = useEnter(delay, 30);
  return (
    <div
      style={{
        ...st,
        width: 330,
        padding: "26px 28px",
        borderRadius: 18,
        background: accent ? "rgba(0,223,130,0.08)" : "rgba(16,35,34,0.85)",
        border: `1.5px solid ${accent ? C.green : C.n40}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 30, color: C.ink }}>{title}</div>
      <div style={{ fontFamily: F.mono, fontSize: 20, color: accent ? C.green : C.n60 }}>{sub}</div>
    </div>
  );
};

const Arrow: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dash = -((frame - delay) * 1.6);
  return (
    <svg width="90" height="24" style={{ opacity: op, flexShrink: 0 }}>
      <line
        x1="0"
        y1="12"
        x2="74"
        y2="12"
        stroke={C.green}
        strokeWidth="3"
        strokeDasharray="10 8"
        strokeDashoffset={dash}
      />
      <path d="M72 4 L88 12 L72 20 Z" fill={C.green} />
    </svg>
  );
};

export const S4Federacion: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);
  const checkOp = interpolate(frame, [280, 302], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "110px 110px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Eyebrow>02 · Competición federada</Eyebrow>
        <H1 size={78}>Conectado a la Federación Cántabra</H1>
        <Sub delay={20}>
          Un agente propio sincroniza los datos oficiales y los sirve dentro del ecosistema.
        </Sub>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 90 }}>
        <Node delay={45} title="FCP" sub="web oficial · rankings y cuadros" />
        <Arrow delay={75} />
        <Node delay={90} title="Agente de datos" sub="Node.js · scraping + sync" />
        <Arrow delay={120} />
        <Node delay={135} title="Supabase" sub="tablas fcp_* · una sola BD" />
        <Arrow delay={165} />
        <Node delay={180} title="App + Web" sub="buscador · playoffs · rankings" accent />
      </div>

      <Card delay={230} style={{ marginTop: 80, width: 900, padding: "26px 34px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div style={{ fontFamily: F.mono, fontSize: 24, color: C.n80 }}>
            Inscripción · Jugador federado
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 24, color: C.ink }}>
            PUNTOS: <span style={{ color: C.green, fontWeight: 700 }}>1.250</span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 24, color: C.ink }}>
            CATEGORÍA: 2ª
          </div>
          <div
            style={{
              opacity: checkOp,
              fontFamily: F.mono,
              fontSize: 24,
              color: C.inverse,
              background: C.green,
              borderRadius: 8,
              padding: "6px 16px",
              fontWeight: 700,
            }}
          >
            ✓ ELEGIBLE
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  );
};
