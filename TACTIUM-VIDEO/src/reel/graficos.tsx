// Gráficos de dato. Los cinco que construyen el mensaje de los guiones.
//
// Todos leen los tokens: ni un color ni una medida escritos a mano. Y todos
// respetan la misma regla de movimiento del sistema (§7): nada rebota, nada
// gira. El movimiento confirma, no decora — así que aquí solo hay `outQuart`.
//
// Viven en la franja entre la zona segura de arriba y el subtítulo, que empieza
// al 62%. Por eso el ancla vertical por defecto es el 38% de la altura.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { T, ms } from "./tokens";

const EASE = Easing.bezier(0.25, 1, 0.5, 1);

/** 0 → 1 en `durMs`, con la curva del sistema. */
const entrada = (frame: number, durMs = T.motion.base) =>
  interpolate(frame, [0, ms(durMs)], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const ANCLA_Y = 0.38;

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: T.font.mono,
      fontSize: 30,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: T.color.accent,
      marginBottom: T.space[4],
    }}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Número grande — «diecisiete». El gancho en imagen.
// ─────────────────────────────────────────────────────────────────────────────
export const NumeroGrande: React.FC<{
  valor: number;
  eyebrow?: string;
  pie?: string;
}> = ({ valor, eyebrow, pie }) => {
  const frame = useCurrentFrame();
  const t = entrada(frame, 600);
  const n = Math.round(interpolate(t, [0, 1], [0, valor]));
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: T.canvas.h * ANCLA_Y,
        paddingLeft: T.safe.sides,
        paddingRight: T.safe.sides,
        textAlign: "center",
      }}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div
        style={{
          fontFamily: T.font.sans,
          fontWeight: 900,
          fontSize: 260,
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
          color: T.color.accent,
          // Sin rebote: solo entra y se asienta.
          transform: `translateY(${(1 - t) * 16}px)`,
          opacity: t,
        }}
      >
        {n}
      </div>
      {pie ? (
        <div
          style={{
            fontFamily: T.font.sans,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: "-0.02em",
            color: T.color.ink,
            marginTop: T.space[4],
            opacity: t,
          }}
        >
          {pie}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Resalte — señala una zona de la captura y apaga el resto.
//     `zona` va en % del lienzo para no depender del tamaño de la captura.
// ─────────────────────────────────────────────────────────────────────────────
export const Resalte: React.FC<{
  zona: { x: number; y: number; w: number; h: number };
  etiqueta?: string;
}> = ({ zona, etiqueta }) => {
  const frame = useCurrentFrame();
  const t = entrada(frame);
  const left = (zona.x / 100) * T.canvas.w;
  const top = (zona.y / 100) * T.canvas.h;
  const width = (zona.w / 100) * T.canvas.w;
  const height = (zona.h / 100) * T.canvas.h;
  return (
    <AbsoluteFill style={{ opacity: t }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          border: `4px solid ${T.color.accent}`,
          borderRadius: T.radius.lg,
          // El apagado del resto sale de un solo box-shadow hacia fuera: no hay
          // cuatro rectángulos que cuadrar, y no es un glow (va hacia dentro).
          boxShadow: `0 0 0 9999px rgba(3,15,15,${0.72 * t})`,
        }}
      />
      {etiqueta ? (
        <div
          style={{
            position: "absolute",
            left,
            top: top + height + T.space[3],
            width,
            textAlign: "center",
            fontFamily: T.font.mono,
            fontSize: 30,
            letterSpacing: "0.1em",
            color: T.color.accent,
          }}
        >
          {etiqueta}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Contador — 60 → 2. El remate del A3, dicho en números.
// ─────────────────────────────────────────────────────────────────────────────
export const Contador: React.FC<{
  de: number;
  a: number;
  unidad: string;
  eyebrow?: string;
}> = ({ de, a, unidad, eyebrow }) => {
  const frame = useCurrentFrame();
  // Arranca tras un respiro: primero se lee la cifra de partida.
  const t = interpolate(frame, [ms(400), ms(1400)], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const n = Math.round(interpolate(t, [0, 1], [de, a]));
  const llegado = t >= 1;
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: T.canvas.h * ANCLA_Y,
        textAlign: "center",
      }}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div
        style={{
          fontFamily: T.font.sans,
          fontWeight: 900,
          fontSize: 220,
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
          // Cambia de color solo al llegar: el verde marca el destino, no el camino.
          color: llegado ? T.color.accent : T.color.ink,
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: 40,
          letterSpacing: "0.1em",
          color: T.color.muted,
          marginTop: T.space[3],
        }}
      >
        {unidad}
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Lista con ticks — enumerar sin que parezca una lista leída.
// ─────────────────────────────────────────────────────────────────────────────
export type ItemTick = { texto: string; enMs?: number };

export const ListaTicks: React.FC<{ items: ItemTick[]; pasoMs?: number }> = ({
  items,
  pasoMs = 450,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "flex-start",
        justifyContent: "flex-start",
        paddingTop: T.canvas.h * 0.3,
        paddingLeft: T.safe.sides + T.space[6],
        paddingRight: T.safe.sides,
      }}
    >
      {items.map((item, i) => {
        // `enMs` cuando el ítem tiene que caer sobre una palabra concreta de la
        // locución; el paso uniforme solo sirve si se enumeran de corrido.
        const t = entrada(frame - ms(item.enMs ?? i * pasoMs));
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: T.space[4],
              marginBottom: T.space[6],
              opacity: t,
              transform: `translateX(${(1 - t) * -18}px)`,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: T.radius.pill,
                background: T.color.accent,
                color: T.color.inverse,
                fontFamily: T.font.sans,
                fontWeight: 900,
                fontSize: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontFamily: T.font.sans,
                fontWeight: 700,
                fontSize: 52,
                letterSpacing: "-0.02em",
                color: T.color.ink,
              }}
            >
              {item.texto}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Cortinilla de dato — separa dos ideas sin transición de efecto.
//     Es opaca: tapa el plano. Ahí está la gracia.
// ─────────────────────────────────────────────────────────────────────────────
export const Cortinilla: React.FC<{ cifra: string; pie?: string }> = ({ cifra, pie }) => {
  const frame = useCurrentFrame();
  const t = entrada(frame, T.motion.fast);
  return (
    <AbsoluteFill
      style={{
        background: T.color.bg,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        paddingLeft: T.safe.sides,
        paddingRight: T.safe.sides,
      }}
    >
      <div
        style={{
          fontFamily: T.font.sans,
          fontWeight: 900,
          fontSize: 150,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: T.color.accent,
          opacity: t,
        }}
      >
        {cifra}
      </div>
      {pie ? (
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: 34,
            letterSpacing: "0.1em",
            color: T.color.muted,
            marginTop: T.space[6],
            opacity: t,
          }}
        >
          {pie}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
