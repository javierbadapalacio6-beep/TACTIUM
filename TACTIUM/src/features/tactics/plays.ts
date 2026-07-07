// Jugadas de la pizarra: tipos + biblioteca precargada (manual del entrenador).
//
// Una jugada se modela como una secuencia de FOTOGRAMAS (tramos); cada
// fotograma es la posición en METROS de las 5 fichas, en el orden de
// INITIAL_TOKENS: [A1, A2, R1, R2, B]. La pizarra interpola entre fotogramas.
// `ballLegs[k]` indica el tipo de trayectoria de la BOLA en el tramo k
// (del fotograma k al k+1): recta ('straight') o globo en arco ('lob').

import { COURT_W, COURT_H } from './courtGeometry';
import type { Action, Formation } from './actions';

export type Frame = { x: number; y: number }[];
export type BallLeg = 'straight' | 'lob';

export interface LibraryPlay {
  id: string;
  name: string;
  category: string;
  level: string;
  frames: Frame[];
  ballLegs: BallLeg[];
}

export interface SavedPlay {
  id: string;
  name: string;
  frames: Frame[];
  ballLegs: BallLeg[];
  // IDs de los jugadores asignados a las 2 fichas "nuestras" (para restaurar
  // la pareja al cargar). null = usar el por defecto.
  assignedIds: (string | null)[];
  createdAt: number;
  // Guion de acciones + formación (si la jugada se creó con el compositor).
  script?: Action[];
  formation?: Formation;
}

// ── Seed del manual (coordenadas fraccionales 0–1) ───────────────────
// Orden de fichas que usa la pizarra. Debe coincidir con INITIAL_TOKENS.
const ORDER = ['A1', 'A2', 'R1', 'R2', 'B'] as const;
type FichaId = (typeof ORDER)[number];
type Pt = { x: number; y: number };

interface SeedStep {
  ficha: FichaId;
  to: Pt;
  lob?: boolean; // solo aplica a la bola: trayectoria en arco
}

interface SeedPlay {
  id: string;
  name: string;
  category: string;
  level: string;
  start: Record<FichaId, Pt>;
  steps: SeedStep[];
}

const SEED: SeedPlay[] = [
  {
    id: '1.3',
    name: 'La cuerda invisible',
    category: 'Posicionamiento',
    level: 'Iniciación',
    start: {
      A1: { x: 0.7, y: 0.6 }, A2: { x: 0.3, y: 0.6 },
      R1: { x: 0.72, y: 0.15 }, R2: { x: 0.28, y: 0.15 }, B: { x: 0.72, y: 0.15 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.7, y: 0.92 }, lob: true },
      { ficha: 'A1', to: { x: 0.7, y: 0.9 } },
      { ficha: 'A2', to: { x: 0.3, y: 0.9 } },
      { ficha: 'B', to: { x: 0.7, y: 0.1 }, lob: true },
      { ficha: 'A1', to: { x: 0.7, y: 0.6 } },
      { ficha: 'A2', to: { x: 0.3, y: 0.6 } },
    ],
  },
  {
    id: '2.1',
    name: 'Saque y subida a la red',
    category: 'Saque',
    level: 'Iniciación',
    start: {
      A1: { x: 0.6, y: 0.72 }, A2: { x: 0.3, y: 0.6 },
      R1: { x: 0.72, y: 0.15 }, R2: { x: 0.28, y: 0.4 }, B: { x: 0.6, y: 0.72 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.8, y: 0.38 } },
      { ficha: 'A1', to: { x: 0.62, y: 0.62 } },
      { ficha: 'B', to: { x: 0.62, y: 0.58 } },
    ],
  },
  {
    id: '2.8',
    name: 'La chiquita al resto',
    category: 'Resto',
    level: 'Avanzado',
    start: {
      A1: { x: 0.75, y: 0.22 }, A2: { x: 0.3, y: 0.3 },
      R1: { x: 0.6, y: 0.55 }, R2: { x: 0.28, y: 0.4 }, B: { x: 0.75, y: 0.22 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.55, y: 0.44 }, lob: true },
      { ficha: 'A1', to: { x: 0.7, y: 0.6 } },
      { ficha: 'A2', to: { x: 0.3, y: 0.6 } },
    ],
  },
  {
    id: '3.1',
    name: 'Bandeja',
    category: 'Remate',
    level: 'Intermedio',
    start: {
      A1: { x: 0.7, y: 0.6 }, A2: { x: 0.3, y: 0.6 },
      R1: { x: 0.7, y: 0.9 }, R2: { x: 0.3, y: 0.9 }, B: { x: 0.7, y: 0.9 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.7, y: 0.68 }, lob: true },
      { ficha: 'B', to: { x: 0.9, y: 0.08 }, lob: true },
      { ficha: 'A1', to: { x: 0.7, y: 0.6 } },
    ],
  },
  {
    id: '4.2',
    name: 'Formación Australiana',
    category: 'Sistema',
    level: 'Competición',
    start: {
      A1: { x: 0.52, y: 0.72 }, A2: { x: 0.7, y: 0.6 },
      R1: { x: 0.72, y: 0.18 }, R2: { x: 0.28, y: 0.18 }, B: { x: 0.52, y: 0.72 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.52, y: 0.34 } },
      { ficha: 'A1', to: { x: 0.28, y: 0.62 } },
      { ficha: 'A2', to: { x: 0.55, y: 0.58 } },
    ],
  },
  {
    id: '5.3',
    name: 'Abrir, abrir, cerrar',
    category: 'Patrón',
    level: 'Avanzado',
    start: {
      A1: { x: 0.68, y: 0.58 }, A2: { x: 0.32, y: 0.58 },
      R1: { x: 0.72, y: 0.9 }, R2: { x: 0.28, y: 0.9 }, B: { x: 0.68, y: 0.58 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.92, y: 0.88 } },
      { ficha: 'R1', to: { x: 0.9, y: 0.92 } },
      { ficha: 'B', to: { x: 0.08, y: 0.88 } },
      { ficha: 'R2', to: { x: 0.1, y: 0.92 } },
      { ficha: 'B', to: { x: 0.5, y: 0.9 } },
    ],
  },
  {
    id: '6.5',
    name: 'Bandeja → víbora → remate',
    category: 'Jugada ensayada',
    level: 'Competición',
    start: {
      A1: { x: 0.7, y: 0.6 }, A2: { x: 0.3, y: 0.6 },
      R1: { x: 0.8, y: 0.9 }, R2: { x: 0.3, y: 0.9 }, B: { x: 0.7, y: 0.66 },
    },
    steps: [
      { ficha: 'B', to: { x: 0.9, y: 0.08 }, lob: true },
      { ficha: 'B', to: { x: 0.72, y: 0.66 }, lob: true },
      { ficha: 'B', to: { x: 0.85, y: 0.12 }, lob: true },
      { ficha: 'B', to: { x: 0.6, y: 0.62 }, lob: true },
      { ficha: 'B', to: { x: 0.96, y: 0.06 } },
    ],
  },
];

// Convierte una jugada-seed (fracciones + pasos incrementales) a fotogramas
// completos en metros + el tipo de trayectoria de la bola por tramo.
function seedToPlay(seed: SeedPlay): { frames: Frame[]; ballLegs: BallLeg[] } {
  const cur: Record<FichaId, Pt> = {
    A1: { ...seed.start.A1 },
    A2: { ...seed.start.A2 },
    R1: { ...seed.start.R1 },
    R2: { ...seed.start.R2 },
    B: { ...seed.start.B },
  };
  const snapshot = (): Frame =>
    ORDER.map((id) => ({ x: cur[id].x * COURT_W, y: cur[id].y * COURT_H }));
  const frames: Frame[] = [snapshot()];
  const ballLegs: BallLeg[] = [];
  for (const step of seed.steps) {
    cur[step.ficha] = { x: step.to.x, y: step.to.y };
    frames.push(snapshot());
    ballLegs.push(step.ficha === 'B' && step.lob ? 'lob' : 'straight');
  }
  return { frames, ballLegs };
}

export const LIBRARY_PLAYS: LibraryPlay[] = SEED.map((s) => {
  const { frames, ballLegs } = seedToPlay(s);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    level: s.level,
    frames,
    ballLegs,
  };
});
