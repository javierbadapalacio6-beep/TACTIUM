// Subtítulos «de curso» (Creator Club de Diego NXT, 13-10): las reglas que dictan las lecciones,
// aplicadas a nuestro karaoke (palabras con tiempos de Whisper). Solo se usan en las composiciones
// con `curso: true`; los reels publicados siguen con TextoCinetico.
//
// Reglas (cap-02, cap-03, pr-03, pr-11 de las transcripciones):
//  · UNA línea, 1-3 palabras, ≤ 13 caracteres; se parte como habla la persona (en pausas y fin de frase),
//    sin dejar una palabra débil colgando al final («de», «la»…).
//  · Justo DEBAJO DE LA CARA (cuello/pecho), centrado; no abajo, donde chocan perfil, descripción y botones.
//  · Fuente base apagada (no blanco puro) + palabra clave en fuente display (serif) más grande y de color;
//    color semántico (rojo para lo negativo). Máximo 2 fuentes.
//  · Entrada de 6-9 fotogramas: desenfoque → nítido + desplazamiento + opacidad, curva «out cubic»; la
//    animación termina cuando acaba la palabra (el trozo empieza un poco ANTES de que se diga).
//  · No repetir la misma animación en todas las frases (3 variantes); las frases de solo conectores
//    («de tu», «y») entran sin animación.
//  · Sombra suave con desenfoque (no contorno pesado).
import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import type { Palabra } from "../Karaoke";
import { limpia } from "../Karaoke";
import { SERIF } from "./Cinetico";

const MAX_CHARS = 13;
const MAX_PALABRAS = 3;
const PAUSA_MS = 180; // un hueco así entre palabras cierra el trozo
const ADELANTO_MS = 120; // el trozo aparece un poco antes de decirse (margen para la animación)
const ENTRADA_F = 8; // ≈ 0,27 s a 30 fps
const DEBILES = new Set("a al con de del el en la las lo los mi mis o e ni para por que se su sus sin tu tus un una unos unas y".split(" "));

const norm = (t: string) => limpia(t).toLowerCase();
const cierra = (t: string) => /[.!?…,;:]$/.test(t);

/** Parte las palabras en trozos que cumplen las reglas de subtítulo. */
export const trocear = (ws: Palabra[]): Palabra[][] => {
  const trozos: Palabra[][] = [];
  let cur: Palabra[] = [];
  const largo = (p: Palabra[]) => p.map((w) => limpia(w.t)).join(" ").length;
  const cerrar = () => {
    if (!cur.length) return;
    // No acabar con una palabra débil: pasa al trozo siguiente.
    const ult = cur[cur.length - 1];
    if (cur.length > 1 && DEBILES.has(norm(ult.t)) && !cierra(ult.t)) {
      trozos.push(cur.slice(0, -1));
      cur = [ult];
    } else {
      trozos.push(cur);
      cur = [];
    }
  };
  ws.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    const hueco = prev ? w.a - prev.b : 0;
    if (cur.length && (hueco > PAUSA_MS || cur.length >= MAX_PALABRAS || largo([...cur, w]) > MAX_CHARS)) cerrar();
    cur.push(w);
    if (cierra(w.t) && i < ws.length - 1) cerrar();
  });
  if (cur.length) trozos.push(cur);
  return trozos;
};

type Variante = "blur" | "baja" | "escala" | "sin";

const Trozo: React.FC<{ palabras: Palabra[]; claves: string[]; semantico: Record<string, string>; variante: Variante; durMs: number }> = ({
  palabras, claves, semantico, variante, durMs,
}) => {
  const f = useCurrentFrame();
  const total = ms(durMs);
  const p = variante === "sin" ? 1 : Easing.out(Easing.cubic)(Math.min(1, f / ENTRADA_F));
  const opacidad = interpolate(f, [0, variante === "sin" ? 3 : 5], [0, 1], { extrapolateRight: "clamp" }) * interpolate(f, [total - 3, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dy = variante === "blur" ? (1 - p) * 30 : variante === "baja" ? -(1 - p) * 38 : 0;
  const escala = variante === "escala" ? 1 + (1 - p) * 0.14 : 1;
  const blur = variante === "sin" ? 0 : (1 - p) * 14;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 880, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 22, opacity: opacidad, transform: `translateY(${dy}px) scale(${escala})`, filter: `blur(${blur}px)` }}>
      {palabras.map((w, i) => {
        const t = norm(w.t);
        const esClave = claves.some((c) => norm(c) === t);
        const color = semantico[t] ?? (esClave ? T.color.accent : "#DCE7E1");
        return (
          <span
            key={i}
            style={{
              fontFamily: esClave ? SERIF : T.font.sans,
              fontStyle: esClave ? "italic" : "normal",
              fontWeight: esClave ? 400 : 600,
              fontSize: esClave ? 132 : 88,
              letterSpacing: esClave ? -2 : -1,
              lineHeight: 1,
              color,
              textShadow: "0 4px 22px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.55)",
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </span>
        );
      })}
    </div>
  );
};

const VARIANTES: Variante[] = ["blur", "baja", "escala"];

/** Subtítulos de una escena. `ws` va en ms DE LA ESCENA; `durMs` es lo que dura la escena. */
export const SubtitulosCurso: React.FC<{ ws: Palabra[]; claves?: string[]; semantico?: Record<string, string>; durMs: number }> = ({
  ws, claves = [], semantico = {}, durMs,
}) => {
  const trozos = trocear(ws);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {trozos.map((tz, i) => {
        const desde = Math.max(0, tz[0].a - ADELANTO_MS);
        const sig = trozos[i + 1];
        const hasta = sig ? Math.max(desde + 250, sig[0].a - ADELANTO_MS) : Math.min(durMs, tz[tz.length - 1].b + 350);
        const soloConectores = tz.every((w) => DEBILES.has(norm(w.t)));
        const variante: Variante = soloConectores ? "sin" : VARIANTES[i % VARIANTES.length];
        return (
          <Sequence key={i} from={ms(desde)} durationInFrames={Math.max(4, ms(hasta - desde))} layout="none" name={`sub-${i + 1}`}>
            <Trozo palabras={tz} claves={claves} semantico={semantico} variante={variante} durMs={hasta - desde} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
