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
import { Ancho, ANCHO } from "./reel/Ancho";
import { MuestraV1, MUESTRA_MS } from "./reel/estilo/MuestraV1";
import { ReelJuego, REELS_JUEGO, durJuego } from "./reel/estilo/ReelJuego";
import { ReelHablado, HABLADOS, durHablado } from "./reel/estilo/ReelHablado";
import { Portada, PORTADAS } from "./reel/estilo/Portada";
import { CIERRE_MS } from "./reel/Reel";
import { Memoria, durMemoria, FPS as FPS_MEMORIA } from "./memoria/Memoria";

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
const AnchoComp: React.FC<{ piezaId: string }> = ({ piezaId }) => {
  const pieza = PIEZAS.find((p) => p.id === piezaId);
  return pieza ? <Ancho pieza={pieza} /> : null;
};

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
    {/* Memoria técnica del Trabajo Final (Racks Academy): voz IA + escenas sincronizadas. */}
    <Composition id="memoria-tpf" component={Memoria} durationInFrames={durMemoria()} fps={FPS_MEMORIA} width={1920} height={1080} />
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
    {/* La misma pieza en horizontal (16:9): tu plano entero a un lado, el panel al otro. */}
    {PIEZAS.map((p) => (
      <Composition
        key={`ancho-${p.id}`}
        id={`ancho-${p.id}`}
        component={AnchoComp}
        defaultProps={{ piezaId: p.id }}
        durationInFrames={durDePieza(p)}
        fps={T.canvas.fps}
        width={ANCHO.w}
        height={ANCHO.h}
      />
    ))}
    {/* Reel de juego: clips reales + estilo cinético, sin voz. */}
    {REELS_JUEGO.map((r) => (
      <Composition
        key={r.id}
        id={r.id}
        component={ReelJuego}
        defaultProps={{ id: r.id }}
        durationInFrames={Math.round(((durJuego(r) + CIERRE_MS) / 1000) * T.canvas.fps)}
        fps={T.canvas.fps}
        width={ANCHO.w}
        height={ANCHO.h}
      />
    ))}
    {/* Reels hablados con estilo cinético (16:9): `hablado-<id>`. */}
    {HABLADOS.map((r) => (
      <Composition
        key={`hablado-${r.id}`}
        id={`hablado-${r.id}`}
        component={ReelHablado}
        defaultProps={{ id: r.id }}
        durationInFrames={Math.round(((durHablado(r) + CIERRE_MS) / 1000) * T.canvas.fps)}
        fps={T.canvas.fps}
        width={ANCHO.w}
        height={ANCHO.h}
      />
    ))}
    {/* Portadas de los reels (cover_url): `portada-<pieza>`, un solo fotograma. */}
    {PORTADAS.map((p) => (
      <Composition key={`portada-${p.id}`} id={`portada-${p.id}`} component={Portada} defaultProps={{ id: p.id }}
        durationInFrames={1} fps={T.canvas.fps} width={T.canvas.w} height={T.canvas.h} />
    ))}
    {/* Los mismos hablados en 9:16 (el formato que se publica en Reels): `hablado-<id>-vertical`. */}
    {HABLADOS.map((r) => (
      <Composition
        key={`hablado-${r.id}-vertical`}
        id={`hablado-${r.id}-vertical`}
        component={ReelHablado}
        defaultProps={{ id: r.id, vertical: true }}
        durationInFrames={Math.round(((durHablado(r) + CIERRE_MS) / 1000) * T.canvas.fps)}
        fps={T.canvas.fps}
        width={T.canvas.w}
        height={T.canvas.h}
      />
    ))}
    {/* Y en 9:16 los reels de juego hechos solo con clips verticales. */}
    {REELS_JUEGO.filter((r) => r.vertical).map((r) => (
      <Composition
        key={`${r.id}-vertical`}
        id={`${r.id}-vertical`}
        component={ReelJuego}
        defaultProps={{ id: r.id, vertical: true }}
        durationInFrames={Math.round(((durJuego(r) + CIERRE_MS) / 1000) * T.canvas.fps)}
        fps={T.canvas.fps}
        width={T.canvas.w}
        height={T.canvas.h}
      />
    ))}
    {/* Muestra del estilo cinético (texto grande en el hueco, tarjetas, descifrado…). */}
    <Composition
      id="estilo-V1"
      component={MuestraV1}
      durationInFrames={Math.round(((MUESTRA_MS + CIERRE_MS) / 1000) * T.canvas.fps)}
      fps={T.canvas.fps}
      width={ANCHO.w}
      height={ANCHO.h}
    />
  </>
);
