import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Chip, Eyebrow, H1, Sub, useEnter, useSceneFade } from "../ui";

const Browser: React.FC<{
  url: string;
  delay: number;
  width: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ url, delay, width, children, style }) => {
  const st = useEnter(delay, 60);
  return (
    <div
      style={{
        ...st,
        width,
        borderRadius: 18,
        overflow: "hidden",
        border: `1.5px solid ${C.n40}`,
        background: "#0B1514",
        boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 20px",
          borderBottom: `1px solid ${C.n40}`,
          background: "#0E1918",
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c, opacity: 0.8 }} />
        ))}
        <div
          style={{
            marginLeft: 14,
            flex: 1,
            background: "#0A1211",
            border: `1px solid ${C.n40}`,
            borderRadius: 9,
            padding: "7px 16px",
            fontFamily: F.mono,
            fontSize: 19,
            color: C.n80,
          }}
        >
          🔒 {url}
        </div>
      </div>
      <div style={{ padding: 30 }}>{children}</div>
    </div>
  );
};

export const S5Web: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = useSceneFade(durationInFrames);
  const payPulse = 1 + Math.sin(Math.max(0, frame - 200) / 14) * 0.02;
  const paidOp = interpolate(frame, [330, 352], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 110,
          width: 700,
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        <Eyebrow>03 · Web app</Eyebrow>
        <H1 size={80}>
          Inscripción online,
          <br />
          pago incluido
        </H1>
        <Sub delay={25}>
          Cualquier jugador se apunta a un torneo desde el navegador, sin instalar nada.
        </Sub>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, width: 640 }}>
          <Chip delay={80} accent>Stripe Checkout</Chip>
          <Chip delay={120}>Dos categorías a la vez</Chip>
          <Chip delay={160}>Elegibilidad validada</Chip>
          <Chip delay={200}>Emails automáticos</Chip>
        </div>
      </div>

      <Browser
        url="tactium.io"
        delay={40}
        width={620}
        style={{ position: "absolute", right: 260, top: 210, opacity: 0.5, filter: "blur(1px)" }}
      >
        <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 40, color: C.ink }}>
          TACTIUM<span style={{ color: C.green }}>.</span>
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 22, color: C.n80, marginTop: 8 }}>
          La landing pública presenta el producto
        </div>
        <div style={{ height: 60 }} />
      </Browser>

      <Browser url="app.tactium.io/torneo/SMASH25" delay={80} width={680} style={{ position: "absolute", right: 100, top: 300 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: C.ink }}>
            Open SMASH Pádel Club
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["2ª MASCULINA", "3ª MIXTA"].map((c) => (
              <div
                key={c}
                style={{
                  fontFamily: F.mono,
                  fontSize: 19,
                  color: C.green,
                  border: `1px solid ${C.deep}`,
                  background: "rgba(0,223,130,0.08)",
                  borderRadius: 8,
                  padding: "6px 14px",
                }}
              >
                {c}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 24, color: C.n80 }}>Precio por persona</div>
            <div style={{ fontFamily: F.mono, fontSize: 34, fontWeight: 700, color: C.ink }}>25,00 €</div>
          </div>
          <div
            style={{
              transform: `scale(${payPulse})`,
              background: C.green,
              color: C.inverse,
              borderRadius: 12,
              padding: "16px 0",
              textAlign: "center",
              fontFamily: F.sans,
              fontWeight: 700,
              fontSize: 26,
            }}
          >
            Inscribirse y pagar
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 18, color: C.n60 }}>
              Pago seguro con Stripe
            </div>
            <div
              style={{
                opacity: paidOp,
                fontFamily: F.mono,
                fontSize: 18,
                color: C.green,
              }}
            >
              ✓ Confirmación enviada por email
            </div>
          </div>
        </div>
      </Browser>
    </AbsoluteFill>
  );
};
