import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Chip, usePop, useSceneFade, Wordmark } from "../ui";

const STACK = [
  "2 APPS NATIVAS",
  "WEB APP",
  "LANDING",
  "AGENTE DE FEDERACIÓN",
  "IAP + STRIPE",
  "PUSH + EMAILS",
];

export const S8Cierre: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames, 18);
  const bigOp = usePop(20);
  const logoSt = usePop(175);
  const tagOp = interpolate(frame, [225, 248], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const creditOp = interpolate(frame, [275, 300], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ opacity: fade, alignItems: "center", justifyContent: "center", gap: 44 }}
    >
      <div
        style={{
          ...bigOp,
          fontFamily: F.mono,
          fontSize: 52,
          fontWeight: 700,
          color: C.ink,
          letterSpacing: 6,
        }}
      >
        12 MESES · <span style={{ color: C.green }}>1 DESARROLLADOR</span>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", maxWidth: 1400 }}>
        {STACK.map((s, i) => (
          <Chip key={s} delay={50 + i * 16} accent={i === 0}>
            {s}
          </Chip>
        ))}
      </div>

      <div style={{ ...logoSt, display: "flex", alignItems: "center", gap: 30, marginTop: 20 }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: -50,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,223,130,0.2), transparent 65%)",
            }}
          />
          <Img src={staticFile("img/logo-t.png")} style={{ width: 150, position: "relative" }} />
        </div>
        <Wordmark size={92} />
      </div>

      <div
        style={{
          opacity: tagOp,
          fontFamily: F.sans,
          fontWeight: 700,
          fontSize: 42,
          color: C.ink,
        }}
      >
        El pádel, <span style={{ color: C.green }}>en serio.</span>
      </div>

      <div
        style={{
          opacity: creditOp,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontFamily: F.mono, fontSize: 26, color: C.green, letterSpacing: 4 }}>
          tactium.io
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 19, color: C.n60, letterSpacing: 2 }}>
          DISEÑADO, CONSTRUIDO Y DESPLEGADO POR JAVIER BADA · AGO 2025 → AGO 2026
        </div>
      </div>
    </AbsoluteFill>
  );
};
