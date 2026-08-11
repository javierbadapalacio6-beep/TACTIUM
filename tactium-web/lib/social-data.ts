/** Comunidad, perfil público y estadísticas (tanda 12). */

export interface FeedItem {
  id: string;
  kind: "AMISTOSO" | "JORNADA" | "TORNEO";
  author: string;
  initials: string;
  time: string;
  text: string;
  score?: string;
  pair?: string;
  rival?: string;
  photo?: boolean;
}

export const FEED: FeedItem[] = [
  {
    id: "n1",
    kind: "AMISTOSO",
    author: "Sara León",
    initials: "SL",
    time: "hace 2 h",
    text: "Ha registrado un amistoso",
    score: "6-3 6-4",
    pair: "Sara · Marco",
    rival: "vs Diego · Álvaro",
    photo: true,
  },
  {
    id: "n2",
    kind: "JORNADA",
    author: "Halcones A",
    initials: "HA",
    time: "hace 1 d",
    text: "Cerró el acta de la J13",
    score: "3–2",
    rival: "vs Pádel Indoor",
  },
  {
    id: "n3",
    kind: "TORNEO",
    author: "Club Smash",
    initials: "CS",
    time: "hace 2 d",
    text: "Ha abierto inscripciones para el Torneo de primavera",
  },
  {
    id: "n4",
    kind: "AMISTOSO",
    author: "Iván Sáez",
    initials: "IS",
    time: "hace 3 d",
    text: "Ha registrado un entrenamiento",
    score: "7-5 6-2",
    pair: "Iván · Jorge",
    rival: "vs Pablo · Luis",
  },
];

export interface PublicProfile {
  username: string;
  name: string;
  initials: string;
  role: "Capitán" | "Jugador" | "Club";
  club: string;
  followers: number;
  following: number;
  played: number;
  won: number;
  casual: number;
  teams: string[];
  isMe?: boolean;
}

export const PROFILES: PublicProfile[] = [
  {
    username: "diego",
    name: "Diego Ruiz",
    initials: "DR",
    role: "Capitán",
    club: "Club Halcones",
    followers: 128,
    following: 64,
    played: 96,
    won: 62,
    casual: 24,
    teams: ["Halcones A"],
    isMe: true,
  },
  {
    username: "sara",
    name: "Sara León",
    initials: "SL",
    role: "Jugador",
    club: "Club Halcones",
    followers: 214,
    following: 98,
    played: 74,
    won: 51,
    casual: 31,
    teams: ["Halcones Femenino"],
  },
  {
    username: "marco",
    name: "Marco Bilbao",
    initials: "MB",
    role: "Jugador",
    club: "Club Halcones",
    followers: 87,
    following: 42,
    played: 88,
    won: 54,
    casual: 19,
    teams: ["Halcones A"],
  },
];

export function profileByUsername(u: string) {
  return PROFILES.find((p) => p.username === u) ?? null;
}

export const CLUBS_DIRECTORY = [
  { username: "halcones", name: "Club Halcones", initials: "CH", city: "Santander", members: 84 },
  { username: "smash", name: "Club Smash", initials: "CS", city: "Santander", members: 120 },
  { username: "bahia", name: "Bahía Pádel", initials: "BP", city: "Santoña", members: 56 },
];

/* ── Estadísticas ───────────────────────────────────────────────── */
export const MY_STATS = {
  matches: 96,
  won: 62,
  lost: 34,
  streak: 3,
  bestStreak: 7,
  casual: 24,
  training: 8,
  bestMate: { name: "Marco Bilbao", initials: "MB", together: 28, won: 21 },
};

/** Con quién más juego. Magnitud → una sola escala, no categorías. */
export const MATES = [
  { name: "Marco Bilbao", played: 28, won: 21 },
  { name: "Iván Sáez", played: 19, won: 12 },
  { name: "Álvaro Peña", played: 14, won: 8 },
  { name: "Nacho Vega", played: 11, won: 6 },
  { name: "Jorge Lastra", played: 7, won: 3 },
];

/** Reparto de partidos por pista. */
export const BY_COURT = [
  { court: "Pista 1", matches: 34 },
  { court: "Pista 2", matches: 26 },
  { court: "Pista 3", matches: 19 },
  { court: "Pista 4", matches: 12 },
  { court: "Pista 5", matches: 5 },
];
