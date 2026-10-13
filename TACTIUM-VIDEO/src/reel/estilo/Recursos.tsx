// Recursos de los packs (MOTION GRAPICHS TACTIUM/PACKS) listos para usar en cualquier reel.
//
// Los archivos se preparan con `bash scripts/preparar-packs.sh` y quedan en
// public/broll/packs/ (fuera de git: material de terceros). Qué es cada cosa y cuándo usarla
// está en PACKS.md, sección «Revisión a fondo (08-10-2026)».
//
//   FondoPack  rejilla de color a pantalla completa; el color se cambia con hue-rotate
//   Grano      polvo / grunge de película fundido en «screen»
//   Topo       líneas de topografía (blancas sobre negro) teñidas
//   Papel      papel con alfa (la bola que llega, se despliega, cubre la pantalla y se va)
import React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, staticFile } from "remotion";
import { ms } from "../tokens";

/** Rejillas del pack FONDOS ABSTRACTOS. `hue` de partida (medido): azul 216°, oro 56°, rosa 350°, rojo 352°. */
export type Rejilla = "azul" | "oro" | "rosa" | "rojo";

/** Hue de la rejilla de partida: sirve para calcular cuánto girar hasta un color objetivo. */
export const HUE_REJILLA: Record<Rejilla, number> = { azul: 216, oro: 56, rosa: 350, rojo: 352 };

/** Grados de hue-rotate para llevar una rejilla a un tono objetivo (verde de marca ≈ 154°). */
export const girar = (rejilla: Rejilla, objetivo: number) => ((objetivo - HUE_REJILLA[rejilla] + 540) % 360) - 180;

/**
 * Rejilla en perspectiva con el brillo en la parte baja. Va a pantalla completa y se
 * desplaza sola (el vídeo es un bucle de 10 s); `desdeMs` empieza en otro punto para que
 * dos escenas seguidas con la misma rejilla no se vean iguales.
 */
export const FondoPack: React.FC<{
  rejilla: Rejilla;
  /** Tono objetivo en grados (154 = verde de marca, 182 = turquesa, 101 = lima, 0 = se queda como está). */
  tono?: number;
  sat?: number;
  brillo?: number;
  desdeMs?: number;
  opacidad?: number;
}> = ({ rejilla, tono, sat = 1, brillo = 1, desdeMs = 0, opacidad = 1 }) => (
  <AbsoluteFill style={{ opacity: opacidad }}>
    <OffthreadVideo
      src={staticFile(`broll/packs/grid-${rejilla}.mp4`)}
      muted
      trimBefore={ms(desdeMs)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: `hue-rotate(${tono === undefined ? 0 : girar(rejilla, tono)}deg) saturate(${sat}) brightness(${brillo})`,
      }}
    />
  </AbsoluteFill>
);

/** Polvo o grunge de película por encima del fondo y por debajo de la interfaz. */
export const Grano: React.FC<{ tipo?: "polvo" | "halftone"; opacidad?: number }> = ({ tipo = "polvo", opacidad = 0.3 }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity: opacidad, pointerEvents: "none" }}>
    {/* Los clips duran 5,3 s: en bucle de 5 s para cubrir cualquier pieza. */}
    <Loop durationInFrames={ms(5000)}>
      <OffthreadVideo src={staticFile(`broll/packs/${tipo}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </Loop>
  </AbsoluteFill>
);

/** Líneas de topografía (blancas). Con `tono` salen en color; sin él, blancas. */
export const Topo: React.FC<{ opacidad?: number; tono?: string }> = ({ opacidad = 0.5, tono }) => (
  <AbsoluteFill style={{ opacity: opacidad, mixBlendMode: "screen" }}>
    <Loop durationInFrames={ms(4600)}>
      <OffthreadVideo src={staticFile("broll/packs/topo.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </Loop>
    {tono ? <AbsoluteFill style={{ background: tono, mixBlendMode: "multiply" }} /> : null}
  </AbsoluteFill>
);

/**
 * Papel con alfa. `07`: una bola llega, se estira en una hoja que se queda (5,7 s).
 * `08`: la bola llega, se despliega, CUBRE la pantalla ~1,3 s y vuelve a arrugarse y se va (4,2 s).
 * Cubre entre 1,0 s y 2,5 s del clip (a velocidad 1): el corte de escena va en medio.
 * Se pone dentro de un <Sequence from=…> que marca cuándo empieza.
 */
export const Papel: React.FC<{ clip?: "07" | "08"; velocidad?: number; claro?: number }> = ({ clip = "08", velocidad = 1, claro = 1.25 }) => (
  <OffthreadVideo
    src={staticFile(`broll/packs/papel-${clip}.mov`)}
    muted
    transparent
    playbackRate={velocidad}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: `brightness(${claro}) contrast(0.92)` }}
  />
);
