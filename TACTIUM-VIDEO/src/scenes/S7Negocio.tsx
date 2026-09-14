import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Eyebrow, H1, Sub, useEnter, usePop, useSceneFade } from "../ui";

const Plan: React.FC<{ name: string; who: string; delay: number; featured?: boolean }> = ({
  name,
  who,
  delay,
  featured,
}) => {
  const st = usePop(delay);
  return (
    <div
      style={{
        ...st,
        width: 350,
        borderRadius: 22,
        border: `1.5px solid ${featured ? C.green : C.n40}`,
        background: featured ? "rgba(0,223,130,0.08)" : "rgba(16,35,34,0.9)",
        padding: "38px 34px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: featured ? "0 0 70px rgba(0,223,130,0.14)" : undefined,
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 5, color: featured ? C.green : C.n80 }}>
        {name}
      </div>
      <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 28, color: C.ink, lineHeight: 1.3 }}>
        {who}
      </div>
      <div style={{ height: 2, background: featured ? C.deep : C.n40, marginTop: 6 }} />
      <div style={{ fontFamily: F.mono, fontSize: 19, color: C.n60 }}>suscripción mensual o anual</div>
    </div>
  );
};

export const S7Negocio: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);
  const torneoSt = useEnter(230, 30);
  const noteOp = interpolate(frame, [300, 325], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade, padding: "110px 110px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Eyebrow>05 · Modelo de negocio</Eyebrow>
        <H1 size={76}>Freemium con prueba invertida</H1>
        <Sub delay={20}>
          Entras gratis y montas tu estructura; las acciones productivas activan la suscripción.
        </Sub>
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: 70 }}>
        <Plan name="STARTER" who="Clubes que empiezan" delay={80} />
        <Plan name="PRO" who="Clubes en competición" delay={120} featured />
        <Plan name="ELITE" who="Grandes estructuras" delay={160} />
        <div
          style={{
            ...torneoSt,
            width: 430,
            borderRadius: 22,
            border: `1.5px dashed ${C.deep}`,
            padding: "38px 34px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 5, color: C.n80 }}>
            PAGO POR TORNEO
          </div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 28, color: C.ink, lineHeight: 1.3 }}>
            Para quien solo organiza competiciones, sin suscripción
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 60,
          opacity: noteOp,
          fontFamily: F.mono,
          fontSize: 24,
          color: C.n60,
          letterSpacing: 2,
        }}
      >
        COMPRAS IN-APP EN MÓVIL (APPLE / GOOGLE) · STRIPE EN LA WEB — MODELO SPOTIFY
      </div>
    </AbsoluteFill>
  );
};
