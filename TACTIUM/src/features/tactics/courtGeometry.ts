// Geometría de la pista de pádel en coordenadas "world" (metros).
//
// La pista reglamentaria mide 10 m de ancho (x) × 20 m de largo (y), con la
// red horizontal en el centro. Toda la pizarra trabaja en metros y proyecta a
// pantalla con un único factor de escala (ver `toScreen`), de modo que una
// jugada se ve idéntica en un iPhone SE y en un iPad (encaja con el
// `ResponsiveFrame` passthrough de la app).
//
//   x = 0  → banda izquierda      x = 10 → banda derecha
//   y = 0  → fondo rival          y = 20 → nuestro fondo      y = 10 → red

export const COURT_W = 10;
export const COURT_H = 20;
export const NET_Y = COURT_H / 2; // 10
// Líneas de saque reglamentarias: a 6,95 m de la red (≈3,05 m de la pared de
// fondo). Quedan ATRÁS, cerca del cristal — la zona de saque es grande y la
// línea central que las une es larga.
export const SERVICE_FROM_NET = 6.95;
export const CENTER_X = COURT_W / 2; // 5

/** Proyección world (m) → screen (px) con letterbox para conservar el ratio. */
export interface CourtLayout {
  scale: number; // px por metro
  offX: number; // margen izquierdo (px)
  offY: number; // margen superior (px)
  w: number; // ancho disponible (px)
  h: number; // alto disponible (px)
}

/** Calcula la escala/offset que centra la pista 10×20 dentro de (w, h). */
export const computeLayout = (w: number, h: number): CourtLayout => {
  const scale = Math.min(w / COURT_W, h / COURT_H);
  return {
    scale,
    offX: (w - COURT_W * scale) / 2,
    offY: (h - COURT_H * scale) / 2,
    w,
    h,
  };
};

export const toScreenX = (xm: number, l: CourtLayout) => l.offX + xm * l.scale;
export const toScreenY = (ym: number, l: CourtLayout) => l.offY + ym * l.scale;

/** Punto en metros. */
export interface WorldPoint {
  x: number;
  y: number;
}

export type TeamSide = 'us' | 'them' | 'ball';

export interface Token {
  id: string;
  team: TeamSide;
  label: string;
  x: number; // metros
  y: number; // metros
}

// Posición base de "ataque en bloque" (jugada 1.1 del manual) como estado
// inicial del spike. A1/A2 = nuestra pareja en la red inferior; R1/R2 = rivales.
export const INITIAL_TOKENS: Token[] = [
  { id: 'A1', team: 'us', label: '1', x: 7.2, y: 12.0 },
  { id: 'A2', team: 'us', label: '2', x: 2.8, y: 12.0 },
  { id: 'R1', team: 'them', label: '1', x: 7.2, y: 3.0 },
  { id: 'R2', team: 'them', label: '2', x: 2.8, y: 3.0 },
  { id: 'B', team: 'ball', label: '', x: 5.0, y: 11.0 },
];

// Radios de ficha en METROS (escalan con la pista). El de jugador es
// deliberadamente generoso para un objetivo táctil cómodo.
export const PLAYER_RADIUS_M = 0.62;
export const BALL_RADIUS_M = 0.34;

/** Segmentos de línea de la pista, en metros. */
export const COURT_LINES: ReadonlyArray<
  readonly [WorldPoint, WorldPoint]
> = [
  // Red (centro)
  [{ x: 0, y: NET_Y }, { x: COURT_W, y: NET_Y }],
  // Líneas de servicio (a 3 m de la red a cada lado)
  [{ x: 0, y: NET_Y - SERVICE_FROM_NET }, { x: COURT_W, y: NET_Y - SERVICE_FROM_NET }],
  [{ x: 0, y: NET_Y + SERVICE_FROM_NET }, { x: COURT_W, y: NET_Y + SERVICE_FROM_NET }],
  // Línea central de saque (une las dos líneas de servicio pasando por la red)
  [
    { x: CENTER_X, y: NET_Y - SERVICE_FROM_NET },
    { x: CENTER_X, y: NET_Y + SERVICE_FROM_NET },
  ],
];
