import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from "remotion";
import "./fonts";
import { FPS, SCENES, totalFrames } from "./timing";
import { Background } from "./ui";
import { S1Hook } from "./scenes/S1Hook";
import { S2Problema } from "./scenes/S2Problema";
import { S3App } from "./scenes/S3App";
import { S4Federacion } from "./scenes/S4Federacion";
import { S5Web } from "./scenes/S5Web";
import { S6Arquitectura } from "./scenes/S6Arquitectura";
import { S7Negocio } from "./scenes/S7Negocio";
import { S8Cierre } from "./scenes/S8Cierre";
import { PIEZAS } from "./reel/piezas";
import { Reel, Guias, durDePieza } from "./reel/Reel";
import { T } from "./reel/tokens";

const COMPONENTS: Record<string, React.FC<{ durationInFrames: number }>> = {
  hook: S1Hook,
  problema: S2Problema,
  app: S3App,
  federacion: S4Federacion,
  web: S5Web,
  arquitectura: S6Arquitectura,
  negocio: S7Negocio,
  cierre: S8Cierre,
};

const Video: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill>
      <Background />
      {SCENES.map((scene) => {
        const dur = Math.round(scene.seconds * FPS);
        const from = at;
        at += dur;
        const Comp = COMPONENTS[scene.id];
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur} name={scene.id}>
            {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
            <Comp durationInFrames={dur} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Reels verticales ────────────────────────────────────────────────────────
// Una composición por pieza. Los datos están en `reel/piezas.ts`; el componente
// no se toca para montar una pieza nueva.
const ReelComp: React.FC<{ piezaId: string; guias: boolean }> = ({ piezaId, guias }) => {
  const pieza = PIEZAS.find((p) => p.id === piezaId);
  if (!pieza) return null;
  return (
    <>
      <Reel pieza={pieza} />
      {guias ? <Guias /> : null}
    </>
  );
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="tactium-ecosistema"
      component={Video}
      durationInFrames={totalFrames()}
      fps={FPS}
      width={1920}
      height={1080}
    />
    {PIEZAS.map((p) => (
      <Composition
        key={p.id}
        id={`reel-${p.id}`}
        component={ReelComp}
        defaultProps={{ piezaId: p.id, guias: false }}
        durationInFrames={durDePieza(p)}
        fps={T.canvas.fps}
        width={T.canvas.w}
        height={T.canvas.h}
      />
    ))}
  </>
);
