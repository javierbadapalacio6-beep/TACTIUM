// Subtítulos palabra a palabra, sincronizados con lo que se dice de verdad.
//
// Los tiempos no se escriben a mano: salen de transcribir el plano con Whisper
// en local (`python scripts/transcribir.py <plano> public/plano/<plano>.mp4`),
// que deja `palabras/<plano>.json`. Si una pieza tiene transcripción, se usa
// esto; si no, siguen las `frases` de siempre.
//
// Por qué así y no frases enteras:
//  - Las frases a mano se desincronizaban (en V1 llegaron a ir 2 s tarde) y se
//    partían por donde caía («la normativa de / tu federación,»).
//  - Dos o tres palabras cada vez se leen de un vistazo, y la que estás diciendo
//    va en verde: el ojo sigue la voz sin esfuerzo.
//  - Sin caja: la caja oscura se salía de la columna en el 16:9. El contraste lo
//    da un contorno oscuro y una sombra, que funcionan sobre cualquier plano.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { T, ms } from "./tokens";
import type { Pieza } from "./piezas";
import { PALABRAS } from "./palabras";

export type Palabra = { t: string; a: number; b: number };
export type Transcripcion = { texto: string; palabras: Palabra[] };
export type Bloque = { palabras: Palabra[]; desdeMs: number; hastaMs: number };

/** Palabras con las que un bloque no debe acabar: cuelgan («con la», «de»). */
const DEBILES = new Set(
  "a al con de del el en la las lo los mi mis o e ni para por que se su sus sin tu tus un una unos unas y".split(" "),
);

/** Lo que se pinta: sin puntuación de los bordes («verano,» → «verano», «¿quién» → «quién»). */
export const limpia = (t: string) => t.replace(/^[¿¡"«(]+/, "").replace(/[.,;:!?…"»)]+$/, "");

const corta = (t: string) => /[.!?…]$/.test(t);
const pausa = (t: string) => /[,;:]$/.test(t);

/**
 * Las palabras de una pieza, en ms de la PIEZA: la transcripción es del plano
 * entero y la pieza puede empezar más tarde (`planoDesdeMs`) y durar menos.
 */
export const palabrasDe = (pieza: Pieza): Palabra[] | null => {
  if (!pieza.plano) return null;
  const clave = pieza.plano.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
  const tr = PALABRAS[clave];
  if (!tr) return null;
  const desde = pieza.planoDesdeMs ?? 0;
  return tr.palabras
    .map((p) => ({ ...p, a: p.a - desde, b: p.b - desde }))
    .filter((p) => p.b > 0 && p.a < pieza.duracionMs && limpia(p.t));
};

/**
 * Agrupa las palabras en bloques de 1 a 3. Se corta en los finales de frase, en
 * las comas y en las pausas de la voz; y nunca se deja colgando una palabra
 * débil al final de un bloque: pasa al siguiente.
 */
export const trocear = (
  palabras: Palabra[],
  { maxPalabras = 3, maxChars = 16, pausaMs = 260 } = {},
): Bloque[] => {
  const grupos: Palabra[][] = [];
  let cur: Palabra[] = [];
  const largo = (ps: Palabra[]) => ps.map((p) => limpia(p.t)).join(" ").length;

  palabras.forEach((p, i) => {
    cur.push(p);
    const sig = palabras[i + 1];
    const debil = DEBILES.has(limpia(p.t).toLowerCase());
    const cierra =
      !sig ||
      corta(p.t) ||
      pausa(p.t) ||
      sig.a - p.b > pausaMs ||
      cur.length >= maxPalabras ||
      // Por largo, sí; pero una palabra débil sola («tus») no se queda
      // flotando: se junta con la siguiente aunque haya que encoger la letra.
      (largo([...cur, sig]) > maxChars && !(cur.length === 1 && debil));
    if (!cierra) return;
    // Cierre por tamaño con una palabra débil al final: se la lleva el siguiente.
    const porTamano = sig && !corta(p.t) && !pausa(p.t) && sig.a - p.b <= pausaMs;
    if (porTamano && cur.length > 1 && debil) {
      const colgada = cur.pop()!;
      grupos.push(cur);
      cur = [colgada];
      return;
    }
    grupos.push(cur);
    cur = [];
  });
  if (cur.length) grupos.push(cur);

  return grupos.map((ps, i) => {
    const sig = grupos[i + 1];
    // Entra un pelín antes de la voz, para que el ojo llegue a tiempo, y se
    // queda hasta el siguiente bloque; si viene un silencio largo, se retira.
    const desdeMs = Math.max(0, ps[0].a - 80);
    const fin = ps[ps.length - 1].b + 450;
    const hastaMs = sig ? Math.min(Math.max(0, sig[0].a - 80), fin) : fin;
    return { palabras: ps, desdeMs, hastaMs: Math.max(hastaMs, desdeMs + 300) };
  });
};

/**
 * El texto del bloque que toca en este frame, sin posicionar (lo coloca quien lo
 * usa). `apagado`: hay un gráfico verde en pantalla, así que la palabra activa
 * no se pinta en verde (una sola nota de color por composición): va en blanco y
 * las demás bajan.
 */
export const Karaoke: React.FC<{
  bloques: Bloque[];
  size: number;
  maxWidth: number;
  apagado?: boolean;
}> = ({ bloques, size, maxWidth, apagado }) => {
  const frame = useCurrentFrame();
  const bloque = bloques.find((b) => frame >= ms(b.desdeMs) && frame < ms(b.hastaMs));
  if (!bloque) return null;

  const ahoraMs = (frame / T.canvas.fps) * 1000;
  // La activa es la última que ha empezado a sonar.
  let activa = -1;
  bloque.palabras.forEach((p, i) => {
    if (ahoraMs >= p.a - 40) activa = i;
  });

  // Aparece de golpe con un empujón corto hacia arriba: 120 ms.
  const t = interpolate(frame - ms(bloque.desdeMs), [0, ms(120)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Si el bloque no cabe, se encoge la letra antes que partir en dos líneas.
  const texto = bloque.palabras.map((p) => limpia(p.t)).join(" ");
  const estimado = texto.length * size * 0.56;
  const tamano = estimado > maxWidth ? Math.max(size * 0.72, (size * maxWidth) / estimado) : size;
  const contorno = Math.round(tamano * 0.13);

  return (
    <div
      style={{
        maxWidth,
        textAlign: "center",
        fontFamily: T.font.sans,
        fontWeight: 900,
        fontSize: tamano,
        lineHeight: 1.08,
        letterSpacing: "-0.02em",
        textWrap: "balance",
        opacity: t,
        transform: `translateY(${(1 - t) * 12}px) scale(${0.96 + 0.04 * t})`,
      }}
    >
      {bloque.palabras.map((p, i) => {
        const esActiva = i === activa;
        const desde = ms(p.a - 40);
        // La palabra activa da un golpecito al entrar: 1,08 → 1 en 150 ms.
        const golpe = esActiva
          ? interpolate(frame - desde, [0, ms(150)], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 1;
        const color = apagado
          ? esActiva || activa < 0
            ? T.sub.color
            : "rgba(232,245,239,0.62)"
          : esActiva
            ? T.sub.enfasis
            : T.sub.color;
        return (
          <React.Fragment key={i}>
            {/* El espacio normal se queda corto con el contorno: se abre a mano. */}
            {i > 0 ? " " : null}
            <span
              style={{
                display: "inline-block",
                marginLeft: i > 0 ? "0.14em" : 0,
                color,
                transform: `scale(${golpe})`,
                // Contorno por fuera de la letra (paint-order) + sombra: se lee
                // sobre una pared clara, sobre la piel y sobre el lienzo oscuro.
                WebkitTextStroke: `${contorno}px ${T.color.bg}`,
                paintOrder: "stroke fill",
                textShadow: `0 ${Math.round(tamano * 0.06)}px ${Math.round(tamano * 0.35)}px rgba(0,0,0,0.55)`,
              }}
            >
              {limpia(p.t)}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
