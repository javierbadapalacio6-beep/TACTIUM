import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Eyebrow, H1, useEnter, useSceneFade } from "../ui";

const Mess: React.FC<{
  delay: number;
  x: number;
  y: number;
  tilt: number;
  title: string;
  body: string;
  collapseFrom: number;
}> = ({ delay, x, y, tilt, title, body, collapseFrom }) => {
  const frame = useCurrentFrame();
  const st = useEnter(delay, 50);
  const collapse = interpolate(frame, [collapseFrom, collapseFrom + 24], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 400,
        opacity: (st.opacity as number) * collapse,
        transform: `${st.transform} rotate(${tilt}deg) scale(${0.9 + collapse * 0.1})`,
        background: "#131A19",
        border: `1px solid ${C.n40}`,
        borderRadius: 16,
        padding: "22px 26px",
        filter: "saturate(0.35)",
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 20, color: C.n60, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 26, color: C.n80, lineHeight: 1.35 }}>
        {body}
      </div>
    </div>
  );
};

export const S2Problema: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);
  const collapseFrom = durationInFrames - 95;
  const finalOp = interpolate(frame, [collapseFrom + 26, collapseFrom + 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: "absolute", top: 90, left: 110, display: "flex", flexDirection: "column", gap: 22 }}>
        <Eyebrow>El problema</Eyebrow>
        <H1 size={76}>Demasiadas piezas sueltas</H1>
      </div>

      <Mess delay={20} x={130} y={330} tilt={-3} collapseFrom={collapseFrom}
        title="GRUPO DEL EQUIPO · 23:47" body="“¿Quién puede jugar el sábado? Necesito 4 parejas YA”" />
      <Mess delay={35} x={620} y={430} tilt={2} collapseFrom={collapseFrom}
        title="disponibilidad_v3_FINAL(2).xlsx" body="Una hoja de cálculo por jornada. Nadie la actualiza." />
      <Mess delay={50} x={1130} y={330} tilt={-2} collapseFrom={collapseFrom}
        title="RESULTADOS" body="El acta del partido, en una foto borrosa que se pierde en el chat." />
      <Mess delay={65} x={330} y={640} tilt={3} collapseFrom={collapseFrom}
        title="TORNEO DEL CLUB" body="Cuadros a boli, horarios en un corcho y llamadas de teléfono." />
      <Mess delay={80} x={950} y={660} tilt={-1} collapseFrom={collapseFrom}
        title="FEDERACIÓN" body="Rankings y cuadros repartidos en webs antiguas, sin buscador." />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: finalOp }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 60, height: 3, background: C.green }} />
          <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 64, color: C.ink }}>
            Merecía una herramienta <span style={{ color: C.green }}>a la altura</span>
          </div>
          <div style={{ width: 60, height: 3, background: C.green }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
