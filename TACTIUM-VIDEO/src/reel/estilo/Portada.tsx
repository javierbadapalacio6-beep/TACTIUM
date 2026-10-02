// Portadas de los reels (1080×1920): un fotograma bueno + un titular grande.
//
// El perfil enseña cada reel recortado a 3:4 (franja central, y 240-1680) y el titular
// tiene que leerse ahí, en pequeño: por eso va grande, a dos líneas como mucho, con la
// palabra clave en verde. Se publica como `cover_url` del reel (segundo archivo de la fila).
//
//   npx remotion still src/index.ts portada-T1 renders/portadas/T1.jpg
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { T } from "../tokens";
import { SERIF } from "./Cinetico";

export type PortadaDef = {
  id: string; // pieza del calendario (T1, A2…)
  /** Fotograma: un vídeo y el segundo exacto, o una imagen. */
  fondo: { video: string; s: number; zoom?: number; origen?: string } | { img: string };
  antetitulo: string;
  /** Líneas del titular; la palabra entre *asteriscos* va en verde (o en serif si `serif`). */
  titulo: string[];
  serif?: boolean;
};

export const PORTADAS: PortadaDef[] = [
  { id: "T1", fondo: { video: "plano/T1-alineacion.mp4", s: 7.6 }, antetitulo: "Tutorial · capitanes", titulo: ["La alineación", "en *20 segundos*"] },
  { id: "A2", fondo: { video: "plano/A2-orden.mp4", s: 4.6 }, antetitulo: "Capitanes", titulo: ["Tu orden de parejas", "es un *caos*"], serif: true },
  { id: "A3", fondo: { video: "plano/A3-dos-minutos.mp4", s: 4.6 }, antetitulo: "Capitanes", titulo: ["De una hora", "a *2 minutos*"] },
  { id: "R2", fondo: { video: "plano/R2-capitan.mp4", s: 16.6 }, antetitulo: "Si eres capitán", titulo: ["*84 mensajes*", "sin leer"] },
  { id: "J1", fondo: { video: "broll/juego-02.mp4", s: 2.4 }, antetitulo: "Pádel federado", titulo: ["Lo que *no se ve*", "de un partido"] },
  { id: "J2", fondo: { video: "broll/juego-20.mp4", s: 2.9 }, antetitulo: "Pádel federado", titulo: ["El capitán", "*también juega*"], serif: true },
];


const Linea: React.FC<{ texto: string; serif?: boolean }> = ({ texto, serif }) => (
  <div style={{ whiteSpace: "nowrap" }}>
    {texto.split(/(\*[^*]+\*)/).filter(Boolean).map((t, i) => {
      const clave = t.startsWith("*");
      const limpio = clave ? t.slice(1, -1) : t;
      return clave ? (
        <span key={i} style={{ color: T.color.accent, fontFamily: serif ? SERIF : undefined, fontStyle: serif ? "italic" : undefined, fontWeight: serif ? 400 : 900, letterSpacing: serif ? "-0.01em" : undefined }}>{limpio}</span>
      ) : (
        <span key={i}>{limpio}</span>
      );
    })}
  </div>
);

export const Portada: React.FC<{ id: string }> = ({ id }) => {
  const p = PORTADAS.find((x) => x.id === id)!;
  const f = p.fondo;
  // El titular más largo manda el tamaño: que quepa en 880 px sin partir líneas.
  const largo = Math.max(...p.titulo.map((l) => l.replace(/\*/g, "").length));
  const tam = Math.min(132, Math.round(880 / (largo * 0.56)));
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {"img" in f ? (
        <Img src={staticFile(f.img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <OffthreadVideo src={staticFile(f.video)} trimBefore={Math.round(f.s * T.canvas.fps)} muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${f.zoom ?? 1})`, transformOrigin: f.origen ?? "center" }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(3,15,15,0) 40%, rgba(3,15,15,0.78) 62%, rgba(3,15,15,0.88) 100%)" }} />
      {/* Dentro del recorte 3:4 del perfil (y 240-1680) y de la zona segura de Reels. */}
      <div style={{ position: "absolute", left: 90, right: 90, top: 1150 }}>
        <div style={{ fontFamily: T.font.mono, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase", color: T.color.accent, marginBottom: 22 }}>
          {p.antetitulo}
        </div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: tam, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#fff" }}>
          {p.titulo.map((l, i) => <Linea key={i} texto={l} serif={p.serif} />)}
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 1600, fontFamily: T.font.mono, fontSize: 26, letterSpacing: "0.14em", color: "rgba(255,255,255,0.7)" }}>
        tactium.io
      </div>
    </AbsoluteFill>
  );
};
