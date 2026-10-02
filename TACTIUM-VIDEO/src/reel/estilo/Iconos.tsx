// Iconos de línea para acompañar a la palabra clave (uno por golpe, nunca más).
// Dibujados en SVG con el trazo de la marca: nítidos a cualquier tamaño y animables.
// Sin logos de terceros: WhatsApp se representa con un bocadillo de chat con contador,
// y la Federación nunca con su escudo (son marcas de otros).
import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { ms } from "../tokens";
import { T } from "../tokens";
import { SVG_ICONOS } from "./iconos-svg";

export type IconoNombre =
  | "pala" | "pelota" | "chat" | "libreta" | "crono" | "aviso" | "check"
  | "calendario" | "trofeo" | "ticket" | "euro" | "cantabria";

const ROJO = "#FF5A5F";

/** Algunos iconos suenan al entrar (bajito, de los packs): refuerzan sin llenar. */
const SONIDO: Partial<Record<IconoNombre, string>> = { chat: "sfx/pop.mp3", crono: "sfx/reloj.mp3", libreta: "sfx/boli.mp3" };

/**
 * Los iconos salen de bibliotecas con licencia comercial (Phosphor, MIT; la pala de pádel,
 * Material Symbols de Google, Apache 2.0), en `iconos-svg.ts`. Se tiñen con `color`.
 * El chat lleva además el globo rojo del contador (así se reconoce WhatsApp sin su logo).
 */
const dibujo = (n: IconoNombre, c: string, extra?: string): React.ReactNode => {
  // Bandera de Cantabria (blanca arriba, roja abajo) con sus colores reales, no en verde.
  if (n === "cantabria") {
    return (
      <>
        <rect x={3} y={9} width={42} height={30} rx={4} fill="#FFFFFF" />
        <path d="M3 24h42v11a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#D5002B" />
        <rect x={3} y={9} width={42} height={30} rx={4} fill="none" stroke="rgba(3,15,15,0.35)" strokeWidth={1} />
      </>
    );
  }
  const ic = SVG_ICONOS[n];
  const k = ic.vb / 48; // el contador se coloca en coordenadas de 48
  return (
    <>
      <g style={{ color: n === "aviso" ? ROJO : c }} dangerouslySetInnerHTML={{ __html: ic.body }} />
      {n === "chat" ? (
        <g transform={`scale(${k})`}>
          <circle cx={37} cy={11} r={12.5} fill={ROJO} stroke="#030F0F" strokeWidth={1.5} />
          <text x={37} y={15.8} textAnchor="middle" fontFamily={T.font.sans} fontWeight={900} fontSize={extra && extra.length > 1 ? 13 : 15} fill="#fff">{extra ?? "!"}</text>
        </g>
      ) : null}
    </>
  );
};

/**
 * El icono junto a la palabra clave: entra a la vez que ella, escalando desde el 60 %
 * con la curva del sistema (§7: nada rebota) y un halo verde muy suave.
 */
export const Icono: React.FC<{ nombre: IconoNombre; aMs: number; size: number; tono?: "oscuro" | "claro"; extra?: string }> = ({
  nombre,
  aMs,
  size,
  tono = "oscuro",
  extra,
}) => {
  const frame = useCurrentFrame();
  const now = (frame / T.canvas.fps) * 1000;
  const t = interpolate(now, [aMs - 80, aMs + 240], [0, 1], { easing: Easing.bezier(0.25, 1, 0.5, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const color = tono === "claro" ? "#03624C" : T.color.accent;
  const son = SONIDO[nombre];
  return (
    <>
    {son ? (
      <Sequence from={Math.max(0, ms(aMs - 40))} layout="none">
        <Audio src={staticFile(son)} volume={0.3} />
      </Sequence>
    ) : null}
    <svg
      viewBox={nombre === "cantabria" ? "0 0 48 48" : `0 0 ${SVG_ICONOS[nombre].vb} ${SVG_ICONOS[nombre].vb}`}
      width={size}
      height={size}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginRight: size * 0.28,
        opacity: t,
        transform: `scale(${0.6 + 0.4 * t})`,
        filter: tono === "claro" ? undefined : `drop-shadow(0 0 ${size * 0.18}px rgba(0,223,130,${0.35 * t}))`,
        overflow: "visible",
      }}
    >
      {dibujo(nombre, color, extra)}
    </svg>
    </>
  );
};
