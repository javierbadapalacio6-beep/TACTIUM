import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Chip, Eyebrow, H1, Phone, Sub, useSceneFade } from "../ui";

const FEATURES: Array<[string, number]> = [
  ["Plantilla y disponibilidad", 55],
  ["Alineaciones por jornada", 115],
  ["Temporada, cruces y resultados", 175],
  ["Torneos: grupos + eliminatoria", 280],
  ["Escáner IA de calendarios", 420],
  ["Capa social y amistosos", 540],
  ["Notificaciones push", 630],
];

export const S3App: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);
  const swapAt = 460;
  const groupA = interpolate(frame, [swapAt, swapAt + 20], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const groupB = 1 - groupA;

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 110,
          width: 760,
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        <Eyebrow>01 · App móvil — iOS y Android</Eyebrow>
        <H1 size={82}>
          Todo tu equipo,
          <br />
          en una sola app
        </H1>
        <Sub delay={30}>
          Una única base de código con React Native y Expo, para capitanes, clubes y jugadores.
        </Sub>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, width: 720 }}>
          {FEATURES.map(([label, delay], i) => (
            <Chip key={label} delay={delay} accent={i === 3 || i === 4}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Grupo A: gestión del equipo */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 100,
          display: "flex",
          gap: 44,
          alignItems: "flex-start",
          opacity: groupA,
        }}
      >
        <div style={{ marginTop: 70 }}>
          <Phone src="img/alineacion.jpg" width={330} delay={20} tilt={-4} floatPhase={0} />
        </div>
        <Phone src="img/jornada-resultados.png" width={360} delay={45} tilt={3} floatPhase={40} />
      </div>

      {/* Grupo B: club y social */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 100,
          display: "flex",
          gap: 44,
          alignItems: "flex-start",
          opacity: groupB,
        }}
      >
        <div style={{ marginTop: 70 }}>
          <Phone src="img/equipos-club.png" width={330} delay={swapAt + 10} tilt={-3} floatPhase={70} />
        </div>
        <Phone src="img/amistoso-stats.jpg" width={360} delay={swapAt + 30} tilt={4} floatPhase={20} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 110,
          fontFamily: F.mono,
          fontSize: 22,
          color: C.n60,
          letterSpacing: 3,
          opacity: interpolate(frame, [60, 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        CAPTURAS REALES DE LA APP EN PRODUCCIÓN
      </div>
    </AbsoluteFill>
  );
};
