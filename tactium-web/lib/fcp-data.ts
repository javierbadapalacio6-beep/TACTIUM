/**
 * Datos de la Federación (tablas `fcp_*` en Supabase).
 *
 * Son datos PÚBLICOS: estas pantallas se ven sin sesión y son las que mejor
 * posicionan en buscadores.
 */

export interface Federation {
  slug: string;
  name: string;
  short: string;
  active: boolean;
}

export const FEDERATIONS: Federation[] = [
  { slug: "cantabra", name: "Federación Cántabra de Pádel", short: "FCP", active: true },
  { slug: "asturiana", name: "Federación Asturiana de Pádel", short: "FAP", active: false },
  { slug: "vasca", name: "Federación Vasca de Pádel", short: "FVP", active: false },
  { slug: "madrilena", name: "Federación Madrileña de Pádel", short: "FMP", active: false },
  { slug: "catalana", name: "Federació Catalana de Pàdel", short: "FCatP", active: false },
  { slug: "andaluza", name: "Federación Andaluza de Pádel", short: "FAnP", active: false },
];

export interface FcpTeamRow {
  id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  pts: number;
}

export interface FcpGroup {
  id: string;
  name: string;
  category: string;
  gender: "Masculino" | "Femenino" | "Mixto";
  season: string;
  round: number;
  rounds: number;
  teams: FcpTeamRow[];
  /** Plazas que suben a playoff y que bajan. */
  promote: number;
  relegate: number;
}

export const FCP_GROUPS: FcpGroup[] = [
  {
    id: "g-a-1m",
    name: "Grupo A",
    category: "1ª",
    gender: "Masculino",
    season: "25/26",
    round: 13,
    rounds: 22,
    promote: 2,
    relegate: 2,
    teams: [
      { id: "f1", name: "CD Pádel Norte", played: 13, won: 10, drawn: 1, lost: 2, setsFor: 42, setsAgainst: 23, pts: 31 },
      { id: "f2", name: "Halcones A", played: 13, won: 8, drawn: 1, lost: 4, setsFor: 38, setsAgainst: 27, pts: 25 },
      { id: "f3", name: "CP Castro", played: 13, won: 8, drawn: 0, lost: 5, setsFor: 36, setsAgainst: 29, pts: 24 },
      { id: "f4", name: "Racquet Club Bahía", played: 13, won: 7, drawn: 2, lost: 4, setsFor: 35, setsAgainst: 30, pts: 23 },
      { id: "f5", name: "Astillero Pádel", played: 13, won: 6, drawn: 1, lost: 6, setsFor: 32, setsAgainst: 33, pts: 19 },
      { id: "f6", name: "Torrelavega TC", played: 13, won: 5, drawn: 2, lost: 6, setsFor: 30, setsAgainst: 34, pts: 17 },
      { id: "f7", name: "Laredo Pádel", played: 13, won: 4, drawn: 1, lost: 8, setsFor: 27, setsAgainst: 37, pts: 13 },
      { id: "f8", name: "Santoña Indoor", played: 13, won: 2, drawn: 0, lost: 11, setsFor: 20, setsAgainst: 44, pts: 6 },
    ],
  },
  {
    id: "g-b-1f",
    name: "Grupo B",
    category: "1ª",
    gender: "Femenino",
    season: "25/26",
    round: 12,
    rounds: 20,
    promote: 2,
    relegate: 1,
    teams: [
      { id: "f9", name: "Halcones Femenino", played: 12, won: 9, drawn: 0, lost: 3, setsFor: 38, setsAgainst: 22, pts: 27 },
      { id: "f10", name: "Bahía Pádel Fem.", played: 12, won: 8, drawn: 1, lost: 3, setsFor: 35, setsAgainst: 24, pts: 25 },
      { id: "f11", name: "CP Castro Fem.", played: 12, won: 5, drawn: 1, lost: 6, setsFor: 28, setsAgainst: 31, pts: 16 },
      { id: "f12", name: "Laredo Fem.", played: 12, won: 2, drawn: 0, lost: 10, setsFor: 18, setsAgainst: 42, pts: 6 },
    ],
  },
];

export interface FcpFixture {
  round: number;
  date: string;
  home: string;
  away: string;
  score: [number, number] | null;
}

export const FCP_FIXTURES: FcpFixture[] = [
  { round: 13, date: "sáb 5 jul", home: "Halcones A", away: "Torrelavega TC", score: [3, 2] },
  { round: 13, date: "sáb 5 jul", home: "CD Pádel Norte", away: "Laredo Pádel", score: [4, 1] },
  { round: 13, date: "sáb 5 jul", home: "CP Castro", away: "Astillero Pádel", score: [3, 2] },
  { round: 14, date: "sáb 12 jul", home: "Halcones A", away: "CD Pádel Norte", score: null },
  { round: 14, date: "sáb 12 jul", home: "Racquet Club Bahía", away: "CP Castro", score: null },
];

export interface FcpPlayer {
  id: string;
  name: string;
  team: string;
  pts: number;
  played: number;
  won: number;
  position: number;
}

export const FCP_PLAYERS: FcpPlayer[] = [
  { id: "j1", name: "Diego Ruiz", team: "Halcones A", pts: 4600, played: 12, won: 8, position: 1 },
  { id: "j2", name: "Marco Bilbao", team: "Halcones A", pts: 4180, played: 13, won: 9, position: 2 },
  { id: "j3", name: "Iván Sáez", team: "Halcones A", pts: 3950, played: 11, won: 6, position: 3 },
  { id: "j4", name: "Adrián Villa", team: "CD Pádel Norte", pts: 4820, played: 13, won: 11, position: 1 },
  { id: "j5", name: "Sara León", team: "Halcones Femenino", pts: 3900, played: 12, won: 9, position: 1 },
];

export interface FcpPlayerMatch {
  round: number;
  rival: string;
  pair: string;
  score: string;
  won: boolean;
  playoff?: boolean;
}

export const FCP_PLAYER_MATCHES: FcpPlayerMatch[] = [
  { round: 13, rival: "Torrelavega TC", pair: "con Marco Bilbao", score: "6-3 6-4", won: true },
  { round: 12, rival: "Laredo Pádel", pair: "con Marco Bilbao", score: "4-6 6-7", won: false },
  { round: 11, rival: "Astillero Pádel", pair: "con Iván Sáez", score: "7-5 6-2", won: true },
  { round: 10, rival: "CP Castro", pair: "con Marco Bilbao", score: "6-4 3-6 10-8", won: true },
];

/** Cuadro del playoff de ascenso. */
export const FCP_PLAYOFF = [
  {
    round: "SEMIFINALES",
    ties: [
      { a: "CD Pádel Norte", b: "Bahía Pádel Fem.", score: "3–2", winner: 0 },
      { a: "Halcones A", b: "CP Castro", score: "3–1", winner: 0 },
    ],
  },
  {
    round: "FINAL",
    ties: [{ a: "CD Pádel Norte", b: "Halcones A", score: "", winner: -1 }],
  },
];

export function groupById(id: string) {
  return FCP_GROUPS.find((g) => g.id === id) ?? null;
}

export function fcpTeamById(id: string) {
  for (const g of FCP_GROUPS) {
    const t = g.teams.find((x) => x.id === id);
    if (t) return { team: t, group: g };
  }
  return null;
}

export function fcpPlayerById(id: string) {
  return FCP_PLAYERS.find((p) => p.id === id) ?? null;
}

/** Puntos por partido, con dos decimales y coma como separador. */
export function ptsPerMatch(t: FcpTeamRow): string {
  if (!t.played) return "0,00";
  return (t.pts / t.played).toFixed(2).replace(".", ",");
}
