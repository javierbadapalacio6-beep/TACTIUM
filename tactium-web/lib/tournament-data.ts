/** Datos de torneos. Salen de `Torneos` y `Torneo Detalle` (tandas 9 y 10). */

export type TournamentState =
  | "borrador"
  | "abierto"
  | "proximo"
  | "en_juego"
  | "finalizado"
  | "cancelado";

export const STATE_LABEL: Record<TournamentState, string> = {
  borrador: "Borrador",
  abierto: "Inscripción abierta",
  proximo: "Próximo",
  en_juego: "En juego",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export type TournamentType =
  | "Americano"
  | "Cuadro"
  | "Grupos + Cuadro"
  | "Cuadro con consolación";

export const TYPE_NOTE: Record<TournamentType, string> = {
  Americano: "Clasificación por puntos, sets y juegos",
  Cuadro: "Cuadro a una vida hasta la final, con cabezas de serie",
  "Grupos + Cuadro": "Fase de grupos y después eliminatorias",
  "Cuadro con consolación":
    "El perdedor de la primera ronda pasa al cuadro de consolación",
};

export interface Tournament {
  id: string;
  name: string;
  club: string;
  place: string;
  dates: string | null;
  type: TournamentType;
  categories: string[];
  genders: string[];
  fee: string | null;
  state: TournamentState;
  pairs: number;
  maxPairs: number;
  code: string;
  /** El usuario está inscrito. */
  mine?: boolean;
}

export const TOURNAMENTS: Tournament[] = [
  {
    id: "t-primavera",
    name: "Torneo de primavera",
    club: "Club Smash",
    place: "Santander",
    dates: "Sáb 15 – Dom 16 ago",
    type: "Grupos + Cuadro",
    categories: ["1ª", "2ª", "3ª"],
    genders: ["Masculino", "Femenino"],
    fee: "15 €",
    state: "abierto",
    pairs: 18,
    maxPairs: 32,
    code: "K7P2QX",
    mine: true,
  },
  {
    id: "t-americano",
    name: "Americano de verano",
    club: "Club Halcones",
    place: "Santander",
    dates: "Sáb 12 – Dom 13 abr",
    type: "Americano",
    categories: ["Libre"],
    genders: ["Mixto"],
    fee: "10 €",
    state: "en_juego",
    pairs: 16,
    maxPairs: 16,
    code: "AMR44V",
  },
  {
    id: "t-cantabria",
    name: "Trofeo Cantabria",
    club: "Club Smash",
    place: "Torrelavega",
    dates: "Sáb 21 dic",
    type: "Cuadro con consolación",
    categories: ["1ª", "2ª"],
    genders: ["Masculino"],
    fee: "18 €",
    state: "proximo",
    pairs: 8,
    maxPairs: 16,
    code: "CNT9ZK",
  },
  {
    id: "t-verano",
    name: "Open de verano",
    club: "Bahía Pádel",
    place: "Santoña",
    dates: "Sáb 5 jul",
    type: "Cuadro",
    categories: ["2ª", "3ª"],
    genders: ["Femenino"],
    fee: null,
    state: "finalizado",
    pairs: 12,
    maxPairs: 12,
    code: "VRN2TT",
    mine: true,
  },
  {
    id: "t-borrador",
    name: "Torneo de otoño",
    club: "Club Halcones",
    place: "Santander",
    dates: null,
    type: "Grupos + Cuadro",
    categories: [],
    genders: [],
    fee: null,
    state: "borrador",
    pairs: 0,
    maxPairs: 32,
    code: "OTN7QP",
  },
];

export function tournamentById(id: string) {
  return TOURNAMENTS.find((t) => t.id === id) ?? null;
}

export const MATCH_FORMATS = [
  "3 sets",
  "2 sets + súper tie-break",
  "Set único a 9",
] as const;

export const CATEGORIES = ["1ª", "2ª", "3ª", "4ª", "Libre"] as const;
export const GENDERS = ["Masculino", "Femenino", "Mixto", "Libre"] as const;

/** Franjas de 1 h para la disponibilidad del inscrito. Los DÍAS ya no son
 *  fijos: se derivan de las fechas reales del torneo (ver buildSignupDays). */
export const SIGNUP_HOURS = ["18:00", "19:00", "20:00", "21:00"] as const;
export const MAX_BLOCKED_HOURS = 8;

/* ── Detalle: grupos, clasificación y cuadro ────────────────────── */
export interface GroupPair {
  pair: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  pts: number;
  /** Clasifica para el cuadro. */
  through: boolean;
}

export const GROUPS: { name: string; pairs: GroupPair[] }[] = [
  {
    name: "GRUPO A",
    pairs: [
      { pair: "Diego · Marco", played: 3, won: 3, lost: 0, setsFor: 6, setsAgainst: 1, gamesFor: 42, gamesAgainst: 24, pts: 9, through: true },
      { pair: "Iván · Pablo", played: 3, won: 2, lost: 1, setsFor: 4, setsAgainst: 3, gamesFor: 36, gamesAgainst: 31, pts: 6, through: true },
      { pair: "Nacho · Luis", played: 3, won: 1, lost: 2, setsFor: 3, setsAgainst: 4, gamesFor: 30, gamesAgainst: 35, pts: 3, through: false },
      { pair: "Jorge · Hugo", played: 3, won: 0, lost: 3, setsFor: 1, setsAgainst: 6, gamesFor: 22, gamesAgainst: 40, pts: 0, through: false },
    ],
  },
  {
    name: "GRUPO B",
    pairs: [
      { pair: "Álvaro · Sergio", played: 3, won: 3, lost: 0, setsFor: 6, setsAgainst: 0, gamesFor: 40, gamesAgainst: 18, pts: 9, through: true },
      { pair: "Rubén · Tomás", played: 3, won: 2, lost: 1, setsFor: 4, setsAgainst: 2, gamesFor: 34, gamesAgainst: 27, pts: 6, through: true },
      { pair: "Carlos · Bruno", played: 3, won: 1, lost: 2, setsFor: 2, setsAgainst: 5, gamesFor: 26, gamesAgainst: 36, pts: 3, through: false },
      { pair: "Adrián · Óscar", played: 3, won: 0, lost: 3, setsFor: 0, setsAgainst: 6, gamesFor: 16, gamesAgainst: 40, pts: 0, through: false },
    ],
  },
];

export interface BracketTie {
  a: string;
  b: string;
  score: string;
  /** 0 = gana a, 1 = gana b, -1 = sin jugar. */
  winner: number;
}

export const KO_ROUNDS: { round: string; ties: BracketTie[] }[] = [
  {
    round: "CUARTOS",
    ties: [
      { a: "Diego · Marco", b: "Adrián · Óscar", score: "6-2 6-1", winner: 0 },
      { a: "Rubén · Tomás", b: "Nacho · Luis", score: "7-5 6-4", winner: 0 },
      { a: "Álvaro · Sergio", b: "Carlos · Bruno", score: "6-3 6-2", winner: 0 },
      { a: "Iván · Pablo", b: "Jorge · Hugo", score: "6-4 3-6 10-8", winner: 0 },
    ],
  },
  {
    round: "SEMIS",
    ties: [
      { a: "Diego · Marco", b: "Rubén · Tomás", score: "6-4 6-3", winner: 0 },
      { a: "Álvaro · Sergio", b: "Iván · Pablo", score: "", winner: -1 },
    ],
  },
  {
    round: "FINAL",
    ties: [{ a: "Diego · Marco", b: "Por determinar", score: "", winner: -1 }],
  },
];

export const CONSOLATION_ROUNDS: { round: string; ties: BracketTie[] }[] = [
  {
    round: "SEMIS · CONSOLACIÓN",
    ties: [
      { a: "Adrián · Óscar", b: "Nacho · Luis", score: "6-3 6-4", winner: 1 },
      { a: "Carlos · Bruno", b: "Jorge · Hugo", score: "", winner: -1 },
    ],
  },
  {
    round: "FINAL · CONSOLACIÓN",
    ties: [{ a: "Nacho · Luis", b: "Por determinar", score: "", winner: -1 }],
  },
];

/* ── Horario: rejilla pistas × horas ────────────────────────────── */
export const SCHEDULE_COURTS = ["Pista 1", "Pista 2", "Pista 3", "Pista 4"];
export const SCHEDULE_HOURS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "17:00",
  "18:00",
  "19:00",
];

export interface ScheduledMatch {
  id: string;
  round: string;
  a: string;
  b: string;
  category: string;
  /** Índice de hora y pista; null = sin asignar. */
  hour: number | null;
  court: number | null;
}

export const SCHEDULED: ScheduledMatch[] = [
  { id: "m1", round: "CUARTOS", a: "Diego · Marco", b: "Adrián · Óscar", category: "1ª M", hour: 0, court: 0 },
  { id: "m2", round: "CUARTOS", a: "Rubén · Tomás", b: "Nacho · Luis", category: "1ª M", hour: 0, court: 1 },
  { id: "m3", round: "CUARTOS", a: "Álvaro · Sergio", b: "Carlos · Bruno", category: "1ª M", hour: 1, court: 0 },
  { id: "m4", round: "CUARTOS", a: "Iván · Pablo", b: "Jorge · Hugo", category: "1ª M", hour: 1, court: 1 },
  { id: "m5", round: "SEMIS", a: "Diego · Marco", b: "Rubén · Tomás", category: "1ª M", hour: 3, court: 0 },
  { id: "m6", round: "SEMIS", a: "Álvaro · Sergio", b: "Iván · Pablo", category: "1ª M", hour: null, court: null },
  { id: "m7", round: "FINAL", a: "Por determinar", b: "Por determinar", category: "1ª M", hour: null, court: null },
];

export const SCHEDULE_CONFIG = {
  minutesPerMatch: 60,
  restBetween: 60,
};

/* ── Inscripciones ──────────────────────────────────────────────── */
export interface Signup {
  pair: string;
  category: string;
  gender: string;
  pts: number;
  paid: boolean;
  phone: string;
  email: string;
}

export const SIGNUPS: Signup[] = [
  { pair: "Diego Ruiz · Marco Bilbao", category: "1ª", gender: "Masculino", pts: 8780, paid: true, phone: "600 111 222", email: "diego@halcones.es" },
  { pair: "Álvaro Peña · Sergio Mata", category: "1ª", gender: "Masculino", pts: 6200, paid: true, phone: "600 333 444", email: "alvaro@halcones.es" },
  { pair: "Iván Sáez · Pablo Herrán", category: "1ª", gender: "Masculino", pts: 6690, paid: false, phone: "600 555 666", email: "ivan@halcones.es" },
  { pair: "Nacho Vega · Luis Cano", category: "2ª", gender: "Masculino", pts: 6460, paid: true, phone: "600 777 888", email: "nacho@halcones.es" },
  { pair: "Sara León · Ana Ruiz", category: "1ª", gender: "Femenino", pts: 5900, paid: true, phone: "600 999 000", email: "sara@halcones.es" },
];
