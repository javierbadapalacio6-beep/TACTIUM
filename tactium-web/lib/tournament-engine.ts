/**
 * Motor de cuadros (web) — port fiel de la lógica de generación de la app
 * (`TACTIUM/src/core/services/tournaments.ts`). Mantener sincronizado: si el
 * algoritmo de siembra o de construcción del cuadro cambia en la app, cambiar
 * aquí igual (o, mejor a futuro, mover la generación a una RPC/edge compartida).
 *
 * De momento cubre el cuadro KO (`ko` y `ko_consolation`). Los formatos de
 * GRUPOS, ROUND-ROBIN y sociales (americano/mexicano) son ports adicionales
 * pendientes con el mismo patrón.
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
function orderEntrants(
  regs: Reg[],
  mode: string,
  rng: () => number,
): Reg[] {
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

/** Filas de un cuadro KO a partir de parejas YA sembradas (orden = siembra). */
function koMatchRows(
  tournamentId: string,
  seeded: Reg[],
  bracket: string,
  gender: string | null,
  category: string | null,
): Row[] {
  const N = seeded.length;
  const size = nextPow2(N);
  const positions = seedPositions(size);
  const posReg = positions.map((seed) => (seed <= N ? seeded[seed - 1] : null));
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

async function hasDivisionMatches(
  tournamentId: string,
  gender: string | null,
  category: string | null,
): Promise<boolean> {
  const sb = supabaseBrowser();
  let q = sb
    .from("tournament_matches")
    .select("id")
    .eq("tournament_id", tournamentId);
  q = gender == null ? q.is("gender", null) : q.eq("gender", gender);
  q = category == null ? q.is("category", null) : q.eq("category", category);
  const { data } = await q.limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

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
  const sb = supabaseBrowser();

  if (await hasDivisionMatches(tournamentId, gender, category)) {
    throw new Error("Esta división ya está generada.");
  }

  const { data: tData, error: tErr } = await sb
    .from("tournaments")
    .select("id, format, seeding_mode, draw_seed")
    .eq("id", tournamentId)
    .single();
  if (tErr) throw tErr;
  const tournament = tData as unknown as Tour;

  // Inscripciones de la división (no retiradas).
  let rq = sb
    .from("tournament_registrations")
    .select("id, status, seed_points, created_at")
    .eq("tournament_id", tournamentId);
  rq = gender == null ? rq.is("gender", null) : rq.eq("gender", gender);
  rq = category == null ? rq.is("category", null) : rq.eq("category", category);
  const { data: rData, error: rErr } = await rq;
  if (rErr) throw rErr;
  const active = ((rData ?? []) as unknown as Reg[]).filter(
    (r) => r.status !== "withdrawn",
  );
  if (active.length < 2) {
    throw new Error("Hacen falta al menos 2 parejas para el cuadro.");
  }

  // Siembra: puntos (determinista) o federativa (sorteo reproducible por seed).
  const mode = tournament.seeding_mode ?? "points";
  let rng = () => 0;
  if (mode === "federative") {
    let seed = tournament.draw_seed;
    if (seed == null) {
      seed = Math.floor(Math.random() * 2147483647) + 1;
      const { error } = await sb
        .from("tournaments")
        .update({ draw_seed: seed })
        .eq("id", tournamentId);
      if (error) throw error;
    }
    rng = seededRng(seed);
  }
  const seeded = orderEntrants(active, mode, rng);

  // Guarda el nº de siembra en cada inscripción (orden del cuadro).
  await Promise.all(
    seeded.map((r, i) =>
      sb.from("tournament_registrations").update({ seed: i + 1 }).eq("id", r.id),
    ),
  );

  const rows = koMatchRows(tournamentId, seeded, "main", gender, category);
  if (tournament.format === "ko_consolation") {
    const consolSize = nextPow2(seeded.length) / 2;
    if (consolSize >= 2) {
      rows.push(...emptyKoRows(tournamentId, consolSize, "consol", gender, category));
    }
  }

  const { error: insErr } = await sb.from("tournament_matches").insert(rows);
  if (insErr) throw insErr;

  const { error: upErr } = await sb
    .from("tournaments")
    .update({ status: "in_progress" })
    .eq("id", tournamentId);
  if (upErr) throw upErr;
}
