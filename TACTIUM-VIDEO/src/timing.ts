// Duraciones provisionales por escena (segundos). Cuando exista la locución real
// (public/voz/bloque-N.*), cada duración se ajusta a su audio y `audio` deja de ser null.
export const FPS = 30;

export type Scene = {
  id: string;
  seconds: number;
  audio: string | null; // p. ej. "voz/bloque-1.m4a"
};

export const SCENES: Scene[] = [
  { id: "hook", seconds: 9, audio: null },
  { id: "problema", seconds: 12, audio: null },
  { id: "app", seconds: 28, audio: null },
  { id: "federacion", seconds: 16, audio: null },
  { id: "web", seconds: 18, audio: null },
  { id: "arquitectura", seconds: 22, audio: null },
  { id: "negocio", seconds: 15, audio: null },
  { id: "cierre", seconds: 15, audio: null },
];

export const totalFrames = () =>
  SCENES.reduce((acc, s) => acc + Math.round(s.seconds * FPS), 0);
