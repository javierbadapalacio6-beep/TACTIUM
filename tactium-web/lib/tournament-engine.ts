/**
 * Motor de cuadros (web) — port fiel de la lógica de generación de la app
 * (`TACTIUM/src/core/services/tournaments.ts`). Mantener sincronizado: si el
 * algoritmo de siembra o de construcción del cuadro cambia en la app, cambiar
 * aquí igual (o, mejor a futuro, mover la generación a una RPC/edge compartida).
 *
 * Cubre todos los formatos: cuadro KO (`ko`/`ko_consolation`), GRUPOS + sus dos
 * feeds a eliminatorias (por posición oro/plata/bronce, o principal+consolación
 * con mejores terceros), LIGA (round-robin) y sociales AMERICANO/MEXICANO.
 *
 * Todas las mutaciones se llaman a través de `guardedWrite` desde el componente,
 * así que quedan inertes con el interruptor de escritura apagado.
 */
import { supabaseBrowser } from "@/lib/supabase/client";

interface Reg {
  id: string;
  status: string | null;
  seed_points: number | null;
  created_at: string;
  seed: number | null;
  group_no: number | null;
  p1_name: string;
  p2_name: string | null;
}
interface Match {
  id: string;
  bracket: string;
  group_no: number | null;
  round: number;
  status: string;
  home_reg: string | null;
  away_reg: string | null;
  home_reg2: string | null;
  away_reg2: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_reg: string | null;
  sets: number[][] | null;
}
interface Tour {
  id: string;
  format: string;
  seeding_mode: string | null;
  draw_seed: number | null;
}
type Row = Record<string, unknown>;

/* ── Matemática de cuadros ─────────────────────────────────────────── */
const nextPow2 = (n: number): number => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};
const nearestPow2 = (n: number): number => {
  if (n < 1) return 1;
  const lower = 2 ** Math.floor(Math.log2(n));
  const upper = 2 ** Math.ceil(Math.log2(n));
  return n - lower <= upper - n ? lower : upper; // empate → la menor (regla FEP)
};
export const recommendedSeeds = (n: number): number => {
  if (n < 4) return 0;
  return Math.min(nearestPow2(Math.round(n / 4)), nextPow2(n) / 2);
};

/* ── Sorteo reproducible (mulberry32) ──────────────────────────────── */
const seededRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffleWith = <T>(arr: T[], rng: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Orden de entrada al cuadro: 'points' = estricto por puntos; 'federative' =
 *  fija cabezas 1 y 2, sortea bandas (3-4, 5-8…) y el resto con el rng. */
function orderEntrants(regs: Reg[], mode: string, rng: () => number): Reg[] {
  const byRank = [...regs].sort(
    (a, b) =>
      (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
      (a.created_at < b.created_at ? -1 : 1),
  );
  if (mode !== "federative") return byRank;
  const numSeeds = recommendedSeeds(byRank.length);
  if (numSeeds <= 2) {
    return byRank
      .slice(0, numSeeds)
      .concat(shuffleWith(byRank.slice(numSeeds), rng));
  }
  const seeds = byRank.slice(0, numSeeds);
  const rest = byRank.slice(numSeeds);
  let ordered = [seeds[0], seeds[1]];
  let band = 2;
  while (band < numSeeds) {
    ordered = ordered.concat(shuffleWith(seeds.slice(band, band * 2), rng));
    band *= 2;
  }
  return ordered.concat(shuffleWith(rest, rng));
}

/** Nº de cabeza de serie por posición del cuadro (1-indexado). */
const seedPositions = (size: number): number[] => {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const total = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(total - s);
    }
    seeds = next;
  }
  return seeds;
};

/** Filas de un cuadro KO a partir de parejas YA sembradas (orden = siembra).
 *  `groupOf` (solo grupos+KO): evita que dos parejas del mismo grupo se crucen
 *  en 1ª ronda reordenando los rivales. */
function koMatchRows(
  tournamentId: string,
  seeded: Reg[],
  bracket: string,
  gender: string | null,
  category: string | null,
  groupOf?: Map<string, number | null>,
): Row[] {
  const N = seeded.length;
  const size = nextPow2(N);
  const positions = seedPositions(size);
  const posReg = positions.map((seed) => (seed <= N ? seeded[seed - 1] : null));
  if (groupOf) {
    const nm = size / 2;
    const g = (r: Reg | null) => (r ? groupOf.get(r.id) ?? null : null);
    const clash = (a: Reg | null, b: Reg | null) => {
      const ga = g(a);
      return ga != null && ga === g(b);
    };
    const real = (s: number) => posReg[2 * s] != null && posReg[2 * s + 1] != null;
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (let s = 0; s < nm; s++) {
        if (!real(s) || !clash(posReg[2 * s], posReg[2 * s + 1])) continue;
        let fixed = false;
        for (let t = 0; t < nm && !fixed; t++) {
          if (t === s || !real(t)) continue;
          const hS = posReg[2 * s], aT = posReg[2 * t + 1];
          const hT = posReg[2 * t], aS = posReg[2 * s + 1];
          if (!clash(hS, aT) && !clash(hT, aS)) {
            posReg[2 * s + 1] = aT;
            posReg[2 * t + 1] = aS;
            fixed = changed = true;
          }
        }
        for (let t = 0; t < nm && !fixed; t++) {
          if (t === s || !real(t)) continue;
          const hS = posReg[2 * s], hT = posReg[2 * t];
          const aS = posReg[2 * s + 1], aT = posReg[2 * t + 1];
          if (!clash(hS, hT) && !clash(aS, aT)) {
            posReg[2 * s + 1] = hT;
            posReg[2 * t] = aS;
            fixed = changed = true;
          }
        }
      }
      if (!changed) break;
    }
  }
  const rounds = Math.round(Math.log2(size));
  interface M {
    round: number;
    slot: number;
    home_reg: string | null;
    away_reg: string | null;
    status: string;
    winner_reg: string | null;
  }
  const byRound: M[][] = [];
  const r1: M[] = [];
  for (let s = 0; s < size / 2; s++) {
    const home = posReg[2 * s];
    const away = posReg[2 * s + 1];
    const isBye = !home || !away;
    r1.push({
      round: 1,
      slot: s,
      home_reg: home?.id ?? null,
      away_reg: away?.id ?? null,
      status: isBye ? "bye" : "pending",
      winner_reg: isBye ? (home?.id ?? away?.id ?? null) : null,
    });
  }
  byRound.push(r1);
  for (let r = 2; r <= rounds; r++) {
    const arr: M[] = [];
    for (let s = 0; s < size / Math.pow(2, r); s++) {
      arr.push({
        round: r,
        slot: s,
        home_reg: null,
        away_reg: null,
        status: "pending",
        winner_reg: null,
      });
    }
    byRound.push(arr);
  }
  if (rounds >= 2) {
    for (const m of r1) {
      if (m.status === "bye" && m.winner_reg) {
        const nm = byRound[1][Math.floor(m.slot / 2)];
        if (m.slot % 2 === 0) nm.home_reg = m.winner_reg;
        else nm.away_reg = m.winner_reg;
      }
    }
  }
  return byRound.flat().map((m) => ({
    tournament_id: tournamentId,
    gender,
    category,
    bracket,
    round: m.round,
    slot: m.slot,
    home_reg: m.home_reg,
    away_reg: m.away_reg,
    status: m.status,
    winner_reg: m.winner_reg,
  }));
}

/** Esqueleto vacío de un cuadro KO (para la consolación: se rellena con los
 *  perdedores de la 1ª ronda del principal a medida que se juegan). */
function emptyKoRows(
  tournamentId: string,
  size: number,
  bracket: string,
  gender: string | null,
  category: string | null,
): Row[] {
  const rounds = Math.round(Math.log2(size));
  const rows: Row[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let s = 0; s < size / Math.pow(2, r); s++) {
      rows.push({
        tournament_id: tournamentId,
        gender,
        category,
        bracket,
        round: r,
        slot: s,
        home_reg: null,
        away_reg: null,
        status: "pending",
        winner_reg: null,
      });
    }
  }
  return rows;
}

// Etiqueta de cuadro por posición de grupo (oro/plata/bronce…).
export const POS_BRACKETS = ["gold", "silver", "bronze"];
export const posBracket = (p: number): string =>
  POS_BRACKETS[p - 1] ?? `pos${p}`;

/* ── Lecturas compartidas ──────────────────────────────────────────── */
async function hasDivisionMatches(
  tournamentId: string,
  gender: string | null,
  category: string | null,
  onlyKo = false,
): Promise<boolean> {
  const sb = supabaseBrowser();
  let q = sb
    .from("tournament_matches")
    .select("id")
    .eq("tournament_id", tournamentId);
  q = gender == null ? q.is("gender", null) : q.eq("gender", gender);
  q = category == null ? q.is("category", null) : q.eq("category", category);
  if (onlyKo) q = q.neq("bracket", "grp");
  const { data } = await q.limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

async function fetchTour(tournamentId: string): Promise<Tour> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("tournaments")
    .select("id, format, seeding_mode, draw_seed")
    .eq("id", tournamentId)
    .single();
  if (error) throw error;
  return data as unknown as Tour;
}

async function fetchRegs(
  tournamentId: string,
  gender: string | null,
  category: string | null,
): Promise<Reg[]> {
  const sb = supabaseBrowser();
  let q = sb
    .from("tournament_registrations")
    .select("id, status, seed_points, created_at, seed, group_no, p1_name, p2_name")
    .eq("tournament_id", tournamentId);
  q = gender == null ? q.is("gender", null) : q.eq("gender", gender);
  q = category == null ? q.is("category", null) : q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Reg[];
}

async function fetchMatches(
  tournamentId: string,
  gender: string | null,
  category: string | null,
): Promise<Match[]> {
  const sb = supabaseBrowser();
  let q = sb
    .from("tournament_matches")
    .select(
      "id, bracket, group_no, round, status, home_reg, away_reg, home_reg2, away_reg2, home_score, away_score, winner_reg, sets",
    )
    .eq("tournament_id", tournamentId);
  q = gender == null ? q.is("gender", null) : q.eq("gender", gender);
  q = category == null ? q.is("category", null) : q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Match[];
}

/** Siembra según el modo del torneo (puntos determinista o sorteo federativo
 *  reproducible; persiste `draw_seed` la primera vez). */
async function seedEntrants(tour: Tour, active: Reg[]): Promise<Reg[]> {
  const mode = tour.seeding_mode ?? "points";
  if (mode !== "federative") return orderEntrants(active, "points", () => 0);
  const sb = supabaseBrowser();
  let seed = tour.draw_seed;
  if (seed == null) {
    seed = Math.floor(Math.random() * 2147483647) + 1;
    const { error } = await sb
      .from("tournaments")
      .update({ draw_seed: seed })
      .eq("id", tour.id);
    if (error) throw error;
  }
  return orderEntrants(active, "federative", seededRng(seed));
}

async function markInProgress(tournamentId: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb
    .from("tournaments")
    .update({ status: "in_progress" })
    .eq("id", tournamentId);
  if (error) throw error;
}

/* ── Clasificaciones ───────────────────────────────────────────────── */
export interface StandingRow {
  regId: string;
  name: string;
  seed: number | null;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
  h2h: boolean;
}

/** Clasificación de una liga/grupo a partir de los partidos jugados. */
export function computeStandings(regs: Reg[], matches: Match[]): StandingRow[] {
  const nameOf = (r: Reg) => `${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ""}`;
  const byId = new Map<string, StandingRow>();
  for (const r of regs) {
    byId.set(r.id, {
      regId: r.id,
      name: nameOf(r),
      seed: r.seed,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      points: 0,
      h2h: false,
    });
  }
  for (const m of matches) {
    if (m.status !== "finished" || !m.home_reg || !m.away_reg) continue;
    const H = byId.get(m.home_reg);
    const A = byId.get(m.away_reg);
    if (!H || !A) continue;
    H.played++;
    A.played++;
    H.setsFor += m.home_score ?? 0;
    H.setsAgainst += m.away_score ?? 0;
    A.setsFor += m.away_score ?? 0;
    A.setsAgainst += m.home_score ?? 0;
    for (const s of m.sets ?? []) {
      H.gamesFor += s[0] ?? 0;
      H.gamesAgainst += s[1] ?? 0;
      A.gamesFor += s[1] ?? 0;
      A.gamesAgainst += s[0] ?? 0;
    }
    if (m.winner_reg === m.home_reg) {
      H.won++;
      A.lost++;
      H.points += 2;
      A.points += 1;
    } else {
      A.won++;
      H.lost++;
      A.points += 2;
      H.points += 1;
    }
  }
  const rows = Array.from(byId.values());
  const h2h = new Set<string>();
  for (const m of matches) {
    if (m.status === "finished" && m.winner_reg && m.home_reg && m.away_reg) {
      const loser = m.winner_reg === m.home_reg ? m.away_reg : m.home_reg;
      h2h.add(`${m.winner_reg}:${loser}`);
    }
  }
  const samePoints = new Map<number, number>();
  for (const r of rows) samePoints.set(r.points, (samePoints.get(r.points) ?? 0) + 1);

  const sorted = rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (samePoints.get(a.points) === 2) {
      if (h2h.has(`${a.regId}:${b.regId}`)) return -1;
      if (h2h.has(`${b.regId}:${a.regId}`)) return 1;
    }
    return (
      b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
      b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst) ||
      b.won - a.won
    );
  });
  for (const r of sorted) {
    if (samePoints.get(r.points) !== 2) continue;
    const other = sorted.find((x) => x.regId !== r.regId && x.points === r.points);
    if (
      other &&
      (h2h.has(`${r.regId}:${other.regId}`) || h2h.has(`${other.regId}:${r.regId}`))
    ) {
      r.h2h = true;
    }
  }
  return sorted;
}

export interface PlayerStanding {
  regId: string;
  name: string;
  played: number;
  won: number;
  points: number;
}

/** Ranking individual (americano/mexicano): puntos = lo que anota tu equipo. */
export function computeIndividualStandings(
  regs: Reg[],
  matches: Match[],
): PlayerStanding[] {
  const byId = new Map<string, PlayerStanding>();
  for (const r of regs)
    byId.set(r.id, { regId: r.id, name: r.p1_name, played: 0, won: 0, points: 0 });
  const add = (id: string | null, pts: number, win: boolean) => {
    if (!id) return;
    const p = byId.get(id);
    if (!p) return;
    p.played++;
    p.points += pts;
    if (win) p.won++;
  };
  for (const m of matches) {
    if (m.status !== "finished") continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const homeWin = hs > as;
    add(m.home_reg, hs, homeWin);
    add(m.home_reg2, hs, homeWin);
    add(m.away_reg, as, !homeWin);
    add(m.away_reg2, as, !homeWin);
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.points - a.points || b.won - a.won,
  );
}

/* ── Generadores ───────────────────────────────────────────────────── */

/**
 * Cierra la inscripción y genera el cuadro KO de una división (cabezas por
 * puntos o sorteo federativo). Si el formato es `ko_consolation`, crea además
 * el cuadro de CONSOLACIÓN (una plaza por partido de 1ª ronda del principal).
 */
export async function generateKoBracket(
  tournamentId: string,
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  if (await hasDivisionMatches(tournamentId, gender, category))
    throw new Error("Esta división ya está generada.");
  const tour = await fetchTour(tournamentId);
  const active = (await fetchRegs(tournamentId, gender, category)).filter(
    (r) => r.status !== "withdrawn",
  );
  if (active.length < 2)
    throw new Error("Hacen falta al menos 2 parejas para el cuadro.");

  const seeded = await seedEntrants(tour, active);
  const sb = supabaseBrowser();
  await Promise.all(
    seeded.map((r, i) =>
      sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", r.id),
    ),
  );

  const rows = koMatchRows(tournamentId, seeded, "main", gender, category);
  if (tour.format === "ko_consolation") {
    const consolSize = nextPow2(seeded.length) / 2;
    if (consolSize >= 2)
      rows.push(...emptyKoRows(tournamentId, consolSize, "consol", gender, category));
  }
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
  await markInProgress(tournamentId);
}

/** GRUPOS: reparto serpiente de las cabezas y liguilla dentro de cada grupo. */
export async function generateGroups(
  tournamentId: string,
  gender: string | null,
  category: string | null,
  groupSize: number,
): Promise<void> {
  if (await hasDivisionMatches(tournamentId, gender, category))
    throw new Error("Esta división ya está generada.");
  const tour = await fetchTour(tournamentId);
  const active = (await fetchRegs(tournamentId, gender, category)).filter(
    (r) => r.status !== "withdrawn",
  );
  const N = active.length;
  if (N < 4) throw new Error("Para grupos hacen falta al menos 4 parejas.");
  const seeded = await seedEntrants(tour, active);
  const G = Math.max(2, Math.ceil(N / groupSize));

  const groups: Reg[][] = Array.from({ length: G }, () => []);
  seeded.forEach((r, i) => {
    const row = Math.floor(i / G);
    const pos = i % G;
    const g = row % 2 === 0 ? pos : G - 1 - pos;
    groups[g].push(r);
  });

  const sb = supabaseBrowser();
  await Promise.all(
    seeded.map((r, i) =>
      sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", r.id),
    ),
  );
  await Promise.all(
    groups.flatMap((grp, gi) =>
      grp.map((r) =>
        sb.from("tournament_registrations").update({ group_no: gi }).eq("id", r.id),
      ),
    ),
  );

  const rows: Row[] = [];
  let slot = 0;
  groups.forEach((grp, gi) => {
    for (let i = 0; i < grp.length; i++) {
      for (let j = i + 1; j < grp.length; j++) {
        rows.push({
          tournament_id: tournamentId,
          gender,
          category,
          bracket: "grp",
          group_no: gi,
          round: 1,
          slot: slot++,
          home_reg: grp[i].id,
          away_reg: grp[j].id,
          status: "pending",
        });
      }
    }
  });
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
  await markInProgress(tournamentId);
}

/** Con los grupos terminados: eliminatorias por POSICIÓN (1º→oro, 2º→plata…). */
export async function generateKnockoutFromGroups(
  tournamentId: string,
  gender: string | null,
  category: string | null,
): Promise<void> {
  if (await hasDivisionMatches(tournamentId, gender, category, true))
    throw new Error("Las eliminatorias ya están generadas.");
  const regs = await fetchRegs(tournamentId, gender, category);
  const matches = await fetchMatches(tournamentId, gender, category);
  const groupNos = Array.from(
    new Set(regs.filter((r) => r.group_no != null).map((r) => r.group_no as number)),
  ).sort((a, b) => a - b);
  if (groupNos.length === 0) throw new Error("No hay grupos.");

  const standingsByGroup = new Map<number, StandingRow[]>();
  let maxPos = 0;
  for (const gn of groupNos) {
    const gRegs = regs.filter((r) => r.group_no === gn);
    const gMatches = matches.filter((m) => m.bracket === "grp" && m.group_no === gn);
    const st = computeStandings(gRegs, gMatches);
    standingsByGroup.set(gn, st);
    maxPos = Math.max(maxPos, st.length);
  }

  const regById = new Map(regs.map((r) => [r.id, r]));
  const rows: Row[] = [];
  for (let p = 1; p <= maxPos; p++) {
    const quals = groupNos
      .map((gn) => standingsByGroup.get(gn)![p - 1])
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
          b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst),
      )
      .map((s) => regById.get(s.regId))
      .filter((r): r is Reg => !!r);
    if (quals.length >= 2)
      rows.push(...koMatchRows(tournamentId, quals, posBracket(p), gender, category));
  }
  if (rows.length === 0) throw new Error("No hay suficientes clasificados.");
  const sb = supabaseBrowser();
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
}

/** Con los grupos terminados (Smash): PRINCIPAL (2 primeros/grupo + mejores
 *  terceros hasta potencia de 2) + CONSOLACIÓN (resto de eliminados). */
export async function generatePrincipalConsolationFromGroups(
  tournamentId: string,
  gender: string | null,
  category: string | null,
  qualifiersPerGroup = 2,
): Promise<void> {
  if (await hasDivisionMatches(tournamentId, gender, category, true))
    throw new Error("Las eliminatorias ya están generadas.");
  const regs = await fetchRegs(tournamentId, gender, category);
  const matches = await fetchMatches(tournamentId, gender, category);
  const groupNos = Array.from(
    new Set(regs.filter((r) => r.group_no != null).map((r) => r.group_no as number)),
  ).sort((a, b) => a - b);
  if (groupNos.length === 0) throw new Error("No hay grupos.");

  const regById = new Map(regs.map((r) => [r.id, r]));
  const standingsByGroup = new Map<number, StandingRow[]>();
  let maxPos = 0;
  for (const gn of groupNos) {
    const gRegs = regs.filter((r) => r.group_no === gn);
    const gMatches = matches.filter((m) => m.bracket === "grp" && m.group_no === gn);
    const st = computeStandings(gRegs, gMatches);
    standingsByGroup.set(gn, st);
    maxPos = Math.max(maxPos, st.length);
  }
  const rowToReg = (s: StandingRow | undefined) =>
    s ? regById.get(s.regId) ?? null : null;
  const cmpRows = (a: StandingRow, b: StandingRow) =>
    b.points - a.points ||
    b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
    b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst);
  const tierAt = (p: number): Reg[] =>
    groupNos
      .map((gn) => standingsByGroup.get(gn)![p - 1])
      .filter((s): s is StandingRow => !!s)
      .sort(cmpRows)
      .map(rowToReg)
      .filter((r): r is Reg => !!r);

  const direct: Reg[] = [];
  for (let p = 1; p <= qualifiersPerGroup; p++) direct.push(...tierAt(p));
  if (direct.length < 2) throw new Error("No hay suficientes clasificados.");

  const nextTier = tierAt(qualifiersPerGroup + 1);
  const target = nextPow2(direct.length);
  const need = Math.max(0, target - direct.length);
  const extraToMain = nextTier.slice(0, need);
  const mainSeeded = [...direct, ...extraToMain];

  const inMain = new Set(mainSeeded.map((r) => r.id));
  const consolSeeded: Reg[] = [];
  for (let p = qualifiersPerGroup + 1; p <= maxPos; p++)
    consolSeeded.push(...tierAt(p).filter((r) => !inMain.has(r.id)));

  const sb = supabaseBrowser();
  await Promise.all(
    mainSeeded.map((r, i) =>
      sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", r.id),
    ),
  );
  const groupOf = new Map(regs.map((r) => [r.id, r.group_no ?? null]));
  const rows = koMatchRows(tournamentId, mainSeeded, "main", gender, category, groupOf);
  if (consolSeeded.length >= 2)
    rows.push(
      ...koMatchRows(tournamentId, consolSeeded, "consol", gender, category, groupOf),
    );
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
}

/** LIGA (todos contra todos): crea C(N,2) partidos; sin cuadro. */
export async function generateRoundRobin(
  tournamentId: string,
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  if (await hasDivisionMatches(tournamentId, gender, category))
    throw new Error("Esta división ya está generada.");
  const active = (await fetchRegs(tournamentId, gender, category)).filter(
    (r) => r.status !== "withdrawn",
  );
  if (active.length < 2) throw new Error("Hacen falta al menos 2 parejas.");
  const seeded = [...active].sort(
    (a, b) =>
      (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
      (a.created_at < b.created_at ? -1 : 1),
  );
  const sb = supabaseBrowser();
  await Promise.all(
    seeded.map((r, i) =>
      sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", r.id),
    ),
  );
  const rows: Row[] = [];
  let slot = 0;
  for (let i = 0; i < seeded.length; i++) {
    for (let j = i + 1; j < seeded.length; j++) {
      rows.push({
        tournament_id: tournamentId,
        gender,
        category,
        bracket: "rr",
        round: 1,
        slot: slot++,
        home_reg: seeded[i].id,
        away_reg: seeded[j].id,
        status: "pending",
      });
    }
  }
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
  await markInProgress(tournamentId);
}

const rotateArr = <T>(arr: T[], by: number): T[] => {
  const n = arr.length;
  if (n === 0) return arr;
  const k = ((by % n) + n) % n;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

/** AMERICANO: rondas rotando compañeros (pistas de 4). Jugadores múltiplo de 4. */
export async function generateAmericano(
  tournamentId: string,
  gender: string | null,
  category: string | null,
): Promise<void> {
  if (await hasDivisionMatches(tournamentId, gender, category))
    throw new Error("Este americano ya está generado.");
  const players = (await fetchRegs(tournamentId, gender, category))
    .filter((r) => r.status !== "withdrawn")
    .sort(
      (a, b) =>
        (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
        (a.created_at < b.created_at ? -1 : 1),
    )
    .map((r) => r.id);
  const N = players.length;
  if (N < 4 || N % 4 !== 0)
    throw new Error("Para el americano hacen falta jugadores múltiplo de 4 (4, 8, 12…).");
  const sb = supabaseBrowser();
  await Promise.all(
    players.map((id, i) =>
      sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", id),
    ),
  );
  const rounds = N - 1;
  const courts = N / 4;
  const rows: Row[] = [];
  let slot = 0;
  for (let r = 0; r < rounds; r++) {
    const arr = [players[0], ...rotateArr(players.slice(1), r)];
    for (let ct = 0; ct < courts; ct++) {
      const [a, b, cc, d] = arr.slice(ct * 4, ct * 4 + 4);
      const teams =
        r % 3 === 0
          ? [[a, b], [cc, d]]
          : r % 3 === 1
            ? [[a, cc], [b, d]]
            : [[a, d], [b, cc]];
      rows.push({
        tournament_id: tournamentId,
        gender,
        category,
        bracket: "amer",
        round: r + 1,
        slot: slot++,
        home_reg: teams[0][0],
        home_reg2: teams[0][1],
        away_reg: teams[1][0],
        away_reg2: teams[1][1],
        status: "pending",
      });
    }
  }
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
  await markInProgress(tournamentId);
}

/** MEXICANO: genera la SIGUIENTE ronda emparejando por la clasificación actual. */
export async function generateMexicanoRound(
  tournamentId: string,
  gender: string | null,
  category: string | null,
): Promise<void> {
  const players = (await fetchRegs(tournamentId, gender, category)).filter(
    (r) => r.status !== "withdrawn",
  );
  const matches = await fetchMatches(tournamentId, gender, category);
  const N = players.length;
  if (N < 4 || N % 4 !== 0)
    throw new Error("Para el mexicano hacen falta jugadores múltiplo de 4 (4, 8, 12…).");

  const existingRounds = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  if (existingRounds > 0) {
    const lastRound = matches.filter((m) => m.round === existingRounds);
    if (!lastRound.every((m) => m.status === "finished"))
      throw new Error("Termina la ronda actual antes de generar la siguiente.");
  }
  const nextRound = existingRounds + 1;

  const sb = supabaseBrowser();
  let ordered: string[];
  if (existingRounds === 0) {
    ordered = [...players]
      .sort(
        (a, b) =>
          (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
          (a.created_at < b.created_at ? -1 : 1),
      )
      .map((r) => r.id);
    await Promise.all(
      ordered.map((id, i) =>
        sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", id),
      ),
    );
  } else {
    ordered = computeIndividualStandings(players, matches).map((s) => s.regId);
  }

  const rows: Row[] = [];
  const baseSlot = matches.length;
  for (let ct = 0; ct < N / 4; ct++) {
    const [a, b, cc, d] = ordered.slice(ct * 4, ct * 4 + 4);
    rows.push({
      tournament_id: tournamentId,
      gender,
      category,
      bracket: "mex",
      round: nextRound,
      slot: baseSlot + ct,
      home_reg: a,
      home_reg2: d,
      away_reg: b,
      away_reg2: cc,
      status: "pending",
    });
  }
  const { error } = await sb.from("tournament_matches").insert(rows);
  if (error) throw error;
  await markInProgress(tournamentId);
}
