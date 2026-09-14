import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Chip, usePop, useSceneFade, Wordmark } from "../ui";

export const S1Hook: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);

  // 0-4s: el "antes" — herramientas de siempre, en gris; luego se apagan.
  const chaosOpacity = interpolate(frame, [70, 88], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoSt = usePop(95);
  const wordOp = interpolate(frame, [118, 138], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagOp = interpolate(frame, [150, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          opacity: chaosOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 26,
            letterSpacing: 8,
            color: C.n60,
            textTransform: "uppercase",
          }}
        >
          Así se gestiona hoy el pádel de equipos
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          <Chip delay={8}>WhatsApp</Chip>
          <Chip delay={20}>Hojas de cálculo</Chip>
          <Chip delay={32}>Capturas y papel</Chip>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 34,
        }}
      >
        <div style={{ ...logoSt, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: -70,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,223,130,0.22), transparent 65%)",
            }}
          />
          <Img src={staticFile("img/logo-t.png")} style={{ width: 260, position: "relative" }} />
        </div>
        <div style={{ opacity: wordOp }}>
          <Wordmark size={110} />
        </div>
        <div
          style={{
            opacity: tagOp,
            fontFamily: F.sans,
            fontWeight: 500,
            fontSize: 36,
            color: C.n80,
          }}
        >
          El sistema operativo del pádel de equipos
        </div>
      </div>
    </AbsoluteFill>
  );
};
