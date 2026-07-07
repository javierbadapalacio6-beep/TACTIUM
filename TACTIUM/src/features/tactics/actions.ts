// Motor de "guion de acciones": una jugada se describe con frases de pádel
// (Globo al revés, Chiquita al centro, Caminar a la red…) y este módulo las
// convierte en FOTOGRAMAS para la pizarra, reutilizando el mismo formato que
// la animación (ver plays.ts).
//
// Convenciones (mirando a la red):
//   · REVÉS = lado IZQUIERDO (x→0).  DRIVE = lado DERECHO (x→10).  CENTRO x=5.
//   · Nuestra pareja abajo (y>10): A1 = drive (derecha), A2 = revés (izquierda).
//   · Rivales arriba (y<10): R1 = derecha, R2 = izquierda.  Bola = índice 4.

import { COURT_W, COURT_H } from './courtGeometry';
import type { Frame, BallLeg } from './plays';

export type Formation = 'ataque' | 'defensa' | 'saque';
export type ActorId = 'A1' | 'A2' | 'R1' | 'R2';
export type ShotType =
  | 'saque'
  | 'resto'
  | 'globo'
  | 'chiquita'
  | 'dejada'
  | 'bandeja'
  | 'vibora'
  | 'remate'
  | 'volea';
export type MoveType = 'caminar' | 'subir' | 'bajar' | 'cruzar';
export type Dir = 'reves' | 'drive' | 'centro' | 'cruzado' | 'paralelo';
export type Depth = 'normal' | 'profundo' | 'corto';
export type Zone = 'red' | 'fondo' | 'centro';

export interface ShotAction {
  kind: 'shot';
  shot: ShotType;
  dir: Dir;
  depth: Depth;
}
export interface MoveAction {
  kind: 'move';
  move: MoveType;
  actor: ActorId;
  zone: Zone;
}
export type Action = ShotAction | MoveAction;

const NET = COURT_H / 2; // 10
const ORDER: ActorId[] = ['A1', 'A2', 'R1', 'R2'];
const BALL = 4;

// ── Paletas para el compositor ──────────────────────────────────────
export const SHOTS: { key: ShotType; label: string; lob: boolean }[] = [
  { key: 'saque', label: 'Saque', lob: false },
  { key: 'resto', label: 'Resto', lob: false },
  { key: 'globo', label: 'Globo', lob: true },
  { key: 'chiquita', label: 'Chiquita', lob: true },
  { key: 'dejada', label: 'Dejada', lob: true },
  { key: 'bandeja', label: 'Bandeja', lob: true },
  { key: 'vibora', label: 'Víbora', lob: true },
  { key: 'remate', label: 'Remate', lob: false },
  { key: 'volea', label: 'Volea', lob: false },
];
export const DIRS: { key: Dir; label: string }[] = [
  { key: 'reves', label: 'al revés' },
  { key: 'drive', label: 'al drive' },
  { key: 'centro', label: 'al centro' },
  { key: 'cruzado', label: 'cruzado' },
  { key: 'paralelo', label: 'paralelo' },
];
export const DEPTHS: { key: Depth; label: string }[] = [
  { key: 'normal', label: 'normal' },
  { key: 'profundo', label: 'profundo' },
  { key: 'corto', label: 'corto' },
];
export const MOVES: { key: MoveType; label: string }[] = [
  { key: 'caminar', label: 'Caminar' },
  { key: 'subir', label: 'Subir a la red' },
  { key: 'bajar', label: 'Bajar al fondo' },
  { key: 'cruzar', label: 'Cruzar de lado' },
];
export const ZONES: { key: Zone; label: string }[] = [
  { key: 'red', label: 'a la red' },
  { key: 'fondo', label: 'al fondo' },
  { key: 'centro', label: 'al centro' },
];

const SHOT_LABEL: Record<ShotType, string> = {
  saque: 'Saque',
  resto: 'Resto',
  globo: 'Globo',
  chiquita: 'Chiquita',
  dejada: 'Dejada',
  bandeja: 'Bandeja',
  vibora: 'Víbora',
  remate: 'Remate',
  volea: 'Volea',
};
const DIR_LABEL: Record<Dir, string> = {
  reves: 'al revés',
  drive: 'al drive',
  centro: 'al centro',
  cruzado: 'cruzado',
  paralelo: 'paralelo',
};
const MOVE_LABEL: Record<MoveType, string> = {
  caminar: 'Caminar',
  subir: 'Subir a la red',
  bajar: 'Bajar al fondo',
  cruzar: 'Cruzar de lado',
};
const ZONE_LABEL: Record<Zone, string> = {
  red: 'a la red',
  fondo: 'al fondo',
  centro: 'al centro',
};
const LOB_SHOTS = new Set<ShotType>([
  'globo',
  'chiquita',
  'dejada',
  'bandeja',
  'vibora',
]);

/** Texto legible de una acción (los nombres se inyectan desde la pantalla). */
export const describeAction = (
  action: Action,
  names: Record<ActorId, string>,
): string => {
  if (action.kind === 'shot') {
    const depth =
      action.depth !== 'normal' ? ` (${action.depth})` : '';
    return `${SHOT_LABEL[action.shot]} ${DIR_LABEL[action.dir]}${depth}`;
  }
  const zone = action.move === 'caminar' ? ` ${ZONE_LABEL[action.zone]}` : '';
  return `${MOVE_LABEL[action.move]} · ${names[action.actor]}${zone}`;
};

// ── Posiciones de formación ─────────────────────────────────────────
function formationFrame(f: Formation): Frame {
  // Orden de salida: [A1(drive/dcha), A2(revés/izq), R1(dcha), R2(izq), B]
  if (f === 'defensa') {
    return [
      { x: 7, y: 18 },
      { x: 3, y: 18 },
      { x: 7, y: 8 },
      { x: 3, y: 8 },
      { x: 5, y: 17.4 },
    ];
  }
  if (f === 'saque') {
    return [
      { x: 6.2, y: 17 }, // A1 saca
      { x: 3, y: 12 },
      { x: 7, y: 4 },
      { x: 3, y: 8 },
      { x: 6.2, y: 17 }, // bola con el sacador
    ];
  }
  // ataque (por defecto): nuestra pareja en la red
  return [
    { x: 7, y: 12 },
    { x: 3, y: 12 },
    { x: 7, y: 3 },
    { x: 3, y: 3 },
    { x: 5, y: 12.4 },
  ];
}

const clampX = (x: number) => Math.max(0.4, Math.min(COURT_W - 0.4, x));
const clampY = (y: number) => Math.max(0.4, Math.min(COURT_H - 0.4, y));

// X destino según dirección (revés=izq, drive=dcha, centro).
function dirX(dir: Dir, fromX: number): number {
  switch (dir) {
    case 'reves':
      return 2.5;
    case 'drive':
      return 7.5;
    case 'centro':
      return 5;
    case 'cruzado':
      return fromX < 5 ? 7.5 : 2.5;
    case 'paralelo':
      return fromX < 5 ? 2.5 : 7.5;
  }
}

// Distancia desde la red hacia el fondo del lado objetivo (0=red, ~9=fondo).
function shotDepthFromNet(shot: ShotType, depth: Depth): number {
  let d: number;
  switch (shot) {
    case 'globo': d = 8.5; break;
    case 'bandeja': d = 7.5; break;
    case 'vibora': d = 8; break;
    case 'remate': d = 8; break;
    case 'volea': d = 5; break;
    case 'saque': d = 6; break;
    case 'resto': d = 6.5; break;
    case 'chiquita': d = 1.6; break;
    case 'dejada': d = 0.8; break;
    default: d = 5;
  }
  if (depth === 'profundo') d = 8.7;
  else if (depth === 'corto') d = 1.6;
  return d;
}

/**
 * Construye los fotogramas de una jugada a partir de la formación y el guion.
 * La bola viaja de su posición actual al destino de cada golpe; los jugadores
 * se mueven solo con acciones de movimiento.
 */
export function buildPlay(
  formation: Formation,
  script: Action[],
): { frames: Frame[]; ballLegs: BallLeg[] } {
  let state: Frame = formationFrame(formation).map((p) => ({ ...p }));
  const frames: Frame[] = [state.map((p) => ({ ...p }))];
  const ballLegs: BallLeg[] = [];

  for (const action of script) {
    const next = state.map((p) => ({ ...p }));
    if (action.kind === 'shot') {
      const ball = next[BALL];
      const targetTop = ball.y > NET; // si la bola está abajo, va arriba
      const tx = clampX(dirX(action.dir, ball.x));
      const dFromNet = shotDepthFromNet(action.shot, action.depth);
      const ty = clampY(targetTop ? NET - dFromNet : NET + dFromNet);
      next[BALL] = { x: tx, y: ty };
      ballLegs.push(LOB_SHOTS.has(action.shot) ? 'lob' : 'straight');
    } else {
      const idx = ORDER.indexOf(action.actor);
      const cur = next[idx];
      const ours = idx === 0 || idx === 1;
      const redY = ours ? 11.6 : 8.4;
      const fondoY = ours ? 18.4 : 1.6;
      const centroY = ours ? 15 : 5;
      if (action.move === 'subir') next[idx] = { x: cur.x, y: redY };
      else if (action.move === 'bajar') next[idx] = { x: cur.x, y: fondoY };
      else if (action.move === 'cruzar')
        next[idx] = { x: clampX(COURT_W - cur.x), y: cur.y };
      else {
        // caminar a zona
        const y =
          action.zone === 'red'
            ? redY
            : action.zone === 'fondo'
              ? fondoY
              : centroY;
        next[idx] = { x: cur.x, y };
      }
      ballLegs.push('straight');
    }
    state = next;
    frames.push(state.map((p) => ({ ...p })));
  }

  return { frames, ballLegs };
}
