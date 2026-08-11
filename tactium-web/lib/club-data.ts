/** Datos del club. Salen de `Club TACTIUM.dc.html` (tanda 8). */

export interface ClubTeamFull {
  id: string;
  name: string;
  category: string;
  gender: "Masculino" | "Femenino" | "Mixto";
  captain: string | null;
  won: number;
  drawn: number;
  lost: number;
  players: number;
  /** Sin categoría/grupo asignado todavía. */
  unconfigured?: boolean;
}

export const CLUB = {
  name: "Club Halcones",
  city: "Santander · Cantabria",
  plan: "Club · 6 equipos",
  planPrice: "29,99 €/mes",
  planUntil: "31/08",
  hasActiveSubscription: true,
};

export const CLUB_TEAMS_FULL: ClubTeamFull[] = [
  { id: "t1", name: "Halcones A", category: "1ª", gender: "Masculino", captain: "Diego Ruiz", won: 8, drawn: 1, lost: 3, players: 16 },
  { id: "t2", name: "Halcones B", category: "2ª", gender: "Masculino", captain: "Luis Cano", won: 5, drawn: 2, lost: 5, players: 14 },
  { id: "t3", name: "Halcones Femenino", category: "1ª", gender: "Femenino", captain: "Sara León", won: 9, drawn: 0, lost: 3, players: 12 },
  { id: "t4", name: "Halcones Veteranos", category: "2ª", gender: "Masculino", captain: "Pablo Herrán", won: 6, drawn: 1, lost: 5, players: 13 },
  { id: "t5", name: "Halcones Juvenil", category: "3ª", gender: "Mixto", captain: null, won: 0, drawn: 0, lost: 0, players: 8, unconfigured: true },
  { id: "t6", name: "Halcones C", category: "3ª", gender: "Masculino", captain: "Jorge Lastra", won: 4, drawn: 2, lost: 6, players: 11 },
];

export interface ClubFixture {
  team: string;
  rival: string;
  date: string;
  time: string | null;
  home: boolean;
  court: string | null;
}

export const CLUB_FIXTURES: ClubFixture[] = [
  { team: "Halcones A", rival: "CD Pádel Norte", date: "sáb 12 jul", time: "10:00", home: true, court: "Pista Central" },
  { team: "Halcones B", rival: "CP Castro", date: "sáb 12 jul", time: "12:00", home: true, court: "Pista 2" },
  { team: "Halcones Femenino", rival: "Bahía Pádel", date: "sáb 12 jul", time: null, home: true, court: null },
  { team: "Halcones Veteranos", rival: "Astillero", date: "dom 13 jul", time: "10:00", home: true, court: "Pista 1" },
  { team: "Halcones C", rival: "Laredo", date: "sáb 12 jul", time: null, home: false, court: null },
];

export interface ClubResult {
  team: string;
  rival: string;
  score: [number, number];
}

export const CLUB_RESULTS: ClubResult[] = [
  { team: "Halcones A", rival: "Torrelavega", score: [3, 2] },
  { team: "Halcones B", rival: "Racquet Club Bahía", score: [2, 3] },
  { team: "Halcones Femenino", rival: "CP Castro", score: [3, 2] },
  { team: "Halcones Veteranos", rival: "Laredo", score: [2, 2] },
];

/** Franjas favoritas declaradas por cada equipo. */
export const FAVOURITE_SLOTS: Record<string, string[]> = {
  "Halcones A": ["SÁB 10:00", "SÁB 11:30"],
  "Halcones B": ["SÁB 12:00", "DOM 09:00"],
  "Halcones Femenino": [],
  "Halcones Veteranos": ["DOM 09:00", "DOM 10:30"],
  "Halcones C": ["SÁB 18:00"],
};

export const DAYS = ["SÁB", "DOM"] as const;
export const HOURS = ["09:00", "10:00", "11:30", "12:00", "18:00", "19:30"] as const;
