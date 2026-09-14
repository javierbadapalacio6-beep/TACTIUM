import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, F } from "./theme";

// ---------- helpers de animación ----------

export const useEnter = (delay: number, distance = 40) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 140 } });
  return {
    opacity: s,
    transform: `translateY(${(1 - s) * distance}px)`,
  } as const;
};

export const usePop = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120, mass: 0.6 } });
  return { opacity: Math.min(1, s * 2), transform: `scale(${0.8 + s * 0.2})` } as const;
};

// Fundido de salida en los últimos `fade` frames de la escena.
export const useSceneFade = (durationInFrames: number, fade = 12) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [durationInFrames - fade, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

// ---------- fondo persistente ----------

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 240) * 40;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(3,98,76,0.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(3,98,76,0.16) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: "center",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 900px 600px at ${960 + drift}px 180px, rgba(0,223,130,0.07), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 1400px 900px at 50% 55%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- piezas tipográficas ----------

export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const st = useEnter(delay, 16);
  return (
    <div
      style={{
        ...st,
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: F.mono,
        fontSize: 24,
        letterSpacing: 6,
        color: C.green,
        textTransform: "uppercase",
      }}
    >
      <div style={{ width: 34, height: 2, background: C.green }} />
      {children}
    </div>
  );
};

export const H1: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  color?: string;
}> = ({ children, delay = 6, size = 88, color = C.ink }) => {
  const st = useEnter(delay);
  return (
    <div
      style={{
        ...st,
        fontFamily: F.sans,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.05,
        color,
        letterSpacing: -1,
      }}
    >
      {children}
    </div>
  );
};

export const Sub: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({
  children,
  delay = 12,
  size = 32,
}) => {
  const st = useEnter(delay, 24);
  return (
    <div
      style={{
        ...st,
        fontFamily: F.sans,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.4,
        color: C.n80,
        maxWidth: 900,
      }}
    >
      {children}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; delay?: number; accent?: boolean }> = ({
  children,
  delay = 0,
  accent = false,
}) => {
  const st = usePop(delay);
  return (
    <div
      style={{
        ...st,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 22px",
        borderRadius: 999,
        border: `1.5px solid ${accent ? C.green : C.n40}`,
        background: accent ? "rgba(0,223,130,0.10)" : "rgba(16,35,34,0.7)",
        fontFamily: F.mono,
        fontSize: 23,
        color: accent ? C.green : C.ink,
        whiteSpace: "nowrap",
      }}
    >
      {accent ? <span style={{ color: C.green }}>●</span> : null}
      {children}
    </div>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, style }) => {
  const st = useEnter(delay, 30);
  return (
    <div
      style={{
        ...st,
        background: "rgba(16,35,34,0.85)",
        border: `1px solid ${C.n40}`,
        borderRadius: 20,
        padding: 28,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------- mockup de móvil ----------

export const Phone: React.FC<{
  src: string;
  width?: number;
  delay?: number;
  tilt?: number;
  floatPhase?: number;
}> = ({ src, width = 340, delay = 0, tilt = 0, floatPhase = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 100, stiffness: 85 } });
  const float = Math.sin((frame + floatPhase) / 55) * 8;
  const h = width * 2.12;
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 120 + float}px) rotate(${tilt}deg)`,
        width,
        height: h,
        borderRadius: width * 0.135,
        padding: 10,
        background: "#0B1514",
        border: `1.5px solid ${C.n40}`,
        boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 60px rgba(0,223,130,0.07)`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.105,
          overflow: "hidden",
          background: C.bg,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      </div>
    </div>
  );
};

// Wordmark tipográfico: TACTiUM con la "i" minúscula y el punto verde (como el original).
export const Wordmark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 96,
  style,
}) => {
  const dot = size * 0.13;
  return (
    <div
      style={{
        fontFamily: F.sans,
        fontWeight: 900,
        fontSize: size,
        color: C.ink,
        letterSpacing: size * 0.02,
        display: "flex",
        alignItems: "baseline",
        lineHeight: 1,
        ...style,
      }}
    >
      TACT
      <span style={{ position: "relative", display: "inline-block" }}>
        ı
        <span
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: -size * 0.02,
            width: dot,
            height: dot,
            background: C.green,
          }}
        />
      </span>
      UM
    </div>
  );
};

// Lienzo estándar de escena con margen
export const Frame: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <AbsoluteFill style={{ padding: "90px 110px", ...style }}>{children}</AbsoluteFill>
);
