/**
 * Datos del equipo: plantilla, jornadas, alineación, temporadas y amistosos.
 *
 * Constantes con la forma exacta que tendrán las consultas a Supabase.
 * Sale del proyecto de Claude Design (tandas 3 a 7).
 */

/* ── Plantilla ─────────────────────────────────────────────────── */
export type Position = "Drive" | "Revés" | "Ambos";
export type Availability = "yes" | "no" | "unset";

export interface Player {
  id: string;
  name: string;
  alias?: string;
  pts: number;
  pos: Position;
  /** Baja: no entra en alineación aunque esté disponible. */
  out?: boolean;
  avail: Availability;
  /** El jugador vinculado a la cuenta que mira la pantalla. */
  isMe?: boolean;
}

export const PLAYERS: Player[] = [
  { id: "p1", name: "Diego Ruiz", alias: "Die", pts: 4600, pos: "Drive", avail: "yes", isMe: true },
  { id: "p2", name: "Marco Bilbao", alias: "Marco", pts: 4180, pos: "Revés", avail: "yes" },
  { id: "p3", name: "Iván Sáez", pts: 3950, pos: "Ambos", avail: "yes" },
  { id: "p4", name: "Álvaro Peña", pts: 3720, pos: "Drive", avail: "yes" },
  { id: "p5", name: "Nacho Vega", pts: 3480, pos: "Revés", avail: "yes" },
  { id: "p6", name: "Jorge Lastra", pts: 3200, pos: "Drive", avail: "yes" },
  { id: "p7", name: "Luis Cano", pts: 2980, pos: "Ambos", avail: "yes" },
  { id: "p8", name: "Pablo Herrán", pts: 2740, pos: "Revés", avail: "yes" },
  { id: "p9", name: "Hugo Palacio", pts: 2610, pos: "Ambos", avail: "yes" },
  { id: "p10", name: "Sergio Mata", pts: 2480, pos: "Drive", avail: "yes" },
  { id: "p11", name: "Rubén Ortiz", pts: 2350, pos: "Revés", avail: "yes" },
  { id: "p12", name: "Carlos Pérez", pts: 2200, pos: "Drive", avail: "yes" },
  { id: "p13", name: "Adrián Solana", pts: 2050, pos: "Revés", avail: "no" },
  { id: "p14", name: "Tomás Reyes", pts: 1920, pos: "Ambos", avail: "no" },
  { id: "p15", name: "Bruno Cuesta", pts: 1780, pos: "Drive", avail: "unset" },
  { id: "p16", name: "Óscar Vidal", pts: 1640, pos: "Revés", avail: "unset", out: true },
];

export const TEAM = {
  name: "Halcones A",
  category: "1ª MASCULINA",
  club: "Club Halcones",
  courts: 5,
  strengthOrder: "Se valida" as const,
};

export function availableCount() {
  return PLAYERS.filter((p) => p.avail === "yes" && !p.out).length;
}

/* ── Jornadas ──────────────────────────────────────────────────── */
export type MatchdayState = "pending" | "played" | "closed";

export interface CourtResult {
  court: number;
  /** Ids de nuestra pareja. */
  ours: [string, string] | null;
  rivalPair: [string, string];
  /** Sets como pares [nuestros, suyos]. */
  sets: [number, number][];
  walkover?: "us" | "them";
}

export interface Matchday {
  id: string;
  round: number;
  rival: string;
  date: string;
  time: string;
  home: boolean;
  venue: string;
  state: MatchdayState;
  /** Resultado global en pistas ganadas. */
  score?: [number, number];
  hasLineup: boolean;
  results?: CourtResult[];
}

export const MATCHDAYS: Matchday[] = [
  {
    id: "j14",
    round: 14,
    rival: "CD Pádel Norte",
    date: "sáb 12 jul",
    time: "10:00",
    home: true,
    venue: "Club Smash, Pista Central",
    state: "pending",
    hasLineup: false,
  },
  {
    id: "j15",
    round: 15,
    rival: "Pádel Sur",
    date: "sáb 19 jul",
    time: "11:30",
    home: false,
    venue: "Pádel Sur Indoor",
    state: "pending",
    hasLineup: false,
  },
  {
    id: "j16",
    round: 16,
    rival: "CD Este",
    date: "sáb 26 jul",
    time: "10:00",
    home: true,
    venue: "Club Smash, Pista 3",
    state: "pending",
    hasLineup: false,
  },
  {
    id: "j17",
    round: 17,
    rival: "Raqueta Club",
    date: "sáb 2 ago",
    time: "09:30",
    home: false,
    venue: "Raqueta Club",
    state: "pending",
    hasLineup: false,
  },
  {
    id: "j13",
    round: 13,
    rival: "Pádel Indoor",
    date: "sáb 5 jul",
    time: "10:00",
    home: true,
    venue: "Club Smash, Pista Central",
    state: "closed",
    score: [3, 2],
    hasLineup: true,
  },
  {
    id: "j12",
    round: 12,
    rival: "CD Bahía",
    date: "sáb 28 jun",
    time: "11:00",
    home: false,
    venue: "CD Bahía",
    state: "closed",
    score: [2, 3],
    hasLineup: true,
  },
];

export const NEXT_MATCHDAY = MATCHDAYS.find((m) => m.state === "pending")!;

export function matchdayById(id: string) {
  return MATCHDAYS.find((m) => m.id === id) ?? null;
}

/** Parejas del rival por pista, en el orden del acta. */
export const RIVAL_PAIRS: string[] = [
  "D. Ferrer · S. Nogal",
  "J. Ortiz · R. Salas",
  "A. Cuesta · M. Peral",
  "C. Roiz · T. Vidal",
  "L. Bada · F. Riaño",
];

/** Estado del acta cerrada, para el banner de resultado. */
export type ActaOutcome = "win" | "lose" | "draw";

export const ACTA_COPY: Record<
  ActaOutcome,
  { label: string; note: string; color: string; bg: string; border: string }
> = {
  win: {
    label: "ACTA CERRADA · GANADA",
    note: "Sumas 3 puntos en la clasificación.",
    color: "var(--accent)",
    bg: "var(--accent-10)",
    border: "var(--accent-40)",
  },
  lose: {
    label: "ACTA CERRADA · PERDIDA",
    note: "El rival suma 3 puntos.",
    color: "var(--error)",
    bg: "var(--error-soft)",
    border: "var(--error)",
  },
  draw: {
    label: "ACTA CERRADA · EMPATE",
    note: "Un punto para cada equipo.",
    color: "var(--warning)",
    bg: "var(--warning-soft)",
    border: "var(--warning)",
  },
};

/** Suma de juegos de un acta, para el resumen de desempate. */
export function gameTotals(results: CourtResult[]): [number, number] {
  return results.reduce<[number, number]>(
    (acc, r) => {
      r.sets.forEach(([a, b]) => {
        acc[0] += a;
        acc[1] += b;
      });
      return acc;
    },
    [0, 0]
  );
}

/** Pistas ganadas por cada lado, contando los W.O. */
export function courtTotals(results: CourtResult[]): [number, number] {
  let us = 0;
  let them = 0;
  for (const r of results) {
    if (r.walkover === "us") {
      us++;
      continue;
    }
    if (r.walkover === "them") {
      them++;
      continue;
    }
    const setsUs = r.sets.filter(([a, b]) => a > b).length;
    const setsThem = r.sets.filter(([a, b]) => b > a).length;
    if (setsUs === 0 && setsThem === 0) continue;
    if (setsUs > setsThem) us++;
    else them++;
  }
  return [us, them];
}

/** Jornadas futuras, en orden. */
export const UPCOMING = MATCHDAYS.filter((m) => m.state === "pending");

/* ── Alineación ────────────────────────────────────────────────── */
/** Pareja por pista: dos ids o hueco vacío. */
export type Pair = [string | null, string | null];

export interface LineupVariant {
  id: string;
  name: string;
  official: boolean;
  pairs: Pair[];
}

export const LINEUP_VARIANTS: LineupVariant[] = [
  {
    id: "v1",
    name: "Variante 1",
    official: true,
    pairs: [
      ["p1", "p2"],
      ["p4", "p5"],
      ["p6", "p8"],
      ["p10", "p11"],
      ["p12", "p3"],
    ],
  },
  {
    id: "v2",
    name: "Variante 2",
    official: false,
    pairs: [
      ["p1", "p5"],
      ["p4", "p2"],
      ["p6", "p11"],
      ["p10", "p8"],
      [null, null],
    ],
  },
];

export function playerById(id: string | null): Player | null {
  if (!id) return null;
  return PLAYERS.find((p) => p.id === id) ?? null;
}

export function pairPoints(pair: Pair): number {
  return pair.reduce((sum, id) => sum + (playerById(id)?.pts ?? 0), 0);
}

/* ── Temporadas ────────────────────────────────────────────────── */
export type SeasonFormat = "Liga regular" | "Liga + Playoff" | "Eliminatorias";

export interface Season {
  id: string;
  name: string;
  format: SeasonFormat;
  rounds: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  active: boolean;
  archived?: boolean;
}

export const SEASONS: Season[] = [
  {
    id: "s2526",
    name: "Temporada 25/26",
    format: "Liga + Playoff",
    rounds: 22,
    played: 13,
    won: 8,
    drawn: 1,
    lost: 4,
    active: true,
  },
  {
    id: "s2425",
    name: "Temporada 24/25",
    format: "Liga regular",
    rounds: 20,
    played: 20,
    won: 12,
    drawn: 2,
    lost: 6,
    active: false,
    archived: true,
  },
  {
    id: "s2324",
    name: "Temporada 23/24",
    format: "Liga regular",
    rounds: 18,
    played: 18,
    won: 7,
    drawn: 1,
    lost: 10,
    active: false,
    archived: true,
  },
];

export const ACTIVE_SEASON = SEASONS.find((s) => s.active)!;

export function winRate(s: Season): number {
  if (!s.played) return 0;
  return Math.round((s.won / s.played) * 100);
}

/* ── Amistosos ─────────────────────────────────────────────────── */
export type CasualKind = "equipos" | "colegas" | "entreno";

export interface CasualMatch {
  id: string;
  kind: CasualKind;
  date: string;
  ourPair: string;
  rivalPair: string;
  sets: [number, number][];
  won: boolean;
  photo?: boolean;
  code: string;
}

export const CASUAL_KIND_LABEL: Record<CasualKind, string> = {
  equipos: "AMISTOSO · EQUIPO VS EQUIPO",
  colegas: "AMISTOSO · ENTRE COLEGAS",
  entreno: "AMISTOSO · ENTRENAMIENTO",
};

export const CASUAL_MATCHES: CasualMatch[] = [
  {
    id: "c1",
    kind: "colegas",
    date: "sáb 5 jul",
    ourPair: "Sara · Marco",
    rivalPair: "vs Diego · Álvaro",
    sets: [
      [6, 3],
      [6, 4],
    ],
    won: true,
    photo: true,
    code: "K7M2XQ",
  },
  {
    id: "c2",
    kind: "equipos",
    date: "mié 9 jul",
    ourPair: "Sara · Iván",
    rivalPair: "vs Nacho · Luis",
    sets: [
      [4, 6],
      [6, 7],
    ],
    won: false,
    code: "P3R9WD",
  },
  {
    id: "c3",
    kind: "entreno",
    date: "lun 7 jul",
    ourPair: "Sara · Jorge",
    rivalPair: "vs Pablo · Álvaro",
    sets: [
      [7, 5],
      [6, 2],
    ],
    won: true,
    code: "T5N8LM",
  },
];

export const SOLO_STATS = {
  matches: 24,
  winRate: 67,
  streak: 3,
  bestStreak: 7,
  casual: 18,
  training: 6,
};

/** Marcador legible: "6-3 6-4". */
export function formatSets(sets: [number, number][]): string {
  return sets.map(([a, b]) => `${a}-${b}`).join(" ");
}
