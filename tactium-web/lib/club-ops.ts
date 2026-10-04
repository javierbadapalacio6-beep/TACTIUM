/**
 * Datos operativos del club que el rediseño enseña de un vistazo (panel del
 * club, torneos y facturación). Espejo de `TACTIUM/src/features/club/clubOps.ts`.
 * Todo sale de tablas que el club ya lee bajo RLS: sin RPC ni tablas nuevas.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import { INSCRIPTION_FEE_BPS, INSCRIPTION_FEE_FIXED_CENTS } from "@/lib/connect";

export interface TournamentStats {
  /** Inscripciones activas (sin retiradas). Una pareja en 2 categorías cuenta 2. */
  pairs: number;
  pendingClub: number;
  paidOnline: number;
  matches: number;
  played: number;
}

const EMPTY: TournamentStats = { pairs: 0, pendingClub: 0, paidOnline: 0, matches: 0, played: 0 };

/** Recuento de inscripciones y partidos por torneo, en dos consultas. Nunca lanza. */
export async function fetchTournamentStats(
  tournaments: { id: string; status: string }[],
): Promise<Record<string, TournamentStats>> {
  const out: Record<string, TournamentStats> = {};
  for (const t of tournaments) out[t.id] = { ...EMPTY };
  const ids = tournaments.map((t) => t.id);
  if (ids.length === 0) return out;
  const sb = supabaseBrowser();
  try {
    const { data: regs } = await sb
      .from("tournament_registrations")
      .select("tournament_id, status, payment_status, payment_method")
      .in("tournament_id", ids);
    for (const r of (regs ?? []) as {
      tournament_id: string;
      status: string;
      payment_status: string | null;
      payment_method: string | null;
    }[]) {
      const s = out[r.tournament_id];
      if (!s || r.status === "withdrawn") continue;
      s.pairs += 1;
      if (r.payment_status === "pending_club") s.pendingClub += 1;
      if (r.payment_status === "paid" && r.payment_method === "stripe") s.paidOnline += 1;
    }
    const live = tournaments.filter((t) => t.status === "in_progress").map((t) => t.id);
    if (live.length) {
      const { data: ms } = await sb
        .from("tournament_matches")
        .select("tournament_id, status, home_reg, away_reg")
        .in("tournament_id", live);
      for (const m of (ms ?? []) as {
        tournament_id: string;
        status: string;
        home_reg: string | null;
        away_reg: string | null;
      }[]) {
        const s = out[m.tournament_id];
        if (!s || !m.home_reg || !m.away_reg) continue;
        s.matches += 1;
        if (m.status === "finished") s.played += 1;
      }
    }
  } catch (e) {
    console.warn("fetchTournamentStats", e);
  }
  return out;
}

/* ── Fases: Inscripción → Pago → Cuadros → En juego → Final ─────────── */
export const PHASES = ["Inscr.", "Pago", "Cuadros", "En juego", "Final"] as const;
export type PhaseIndex = 0 | 1 | 2 | 3 | 4;
export const PHASE_LABEL: Record<PhaseIndex, string> = {
  0: "Inscripción",
  1: "Pago",
  2: "Cuadros",
  3: "En juego",
  4: "Final",
};
export const PHASE_ACTION: Record<PhaseIndex, string> = {
  0: "Compartir",
  1: "Cerrar y pagar",
  2: "Generar cuadros",
  3: "Poner resultados",
  4: "Ver resultados",
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function tournamentPhase(t: {
  status: string;
  billing_status?: string | null;
  starts_on: string | null;
}): PhaseIndex {
  if (t.status === "finished" || t.status === "canceled") return 4;
  if (t.status === "in_progress") return 3;
  const billing = t.billing_status ?? "none";
  if (t.status === "draft" || billing === "pending_payment") return 1;
  if (billing === "paid" || billing === "included" || billing === "free") return 2;
  if (t.starts_on && t.starts_on <= todayIso()) return 1;
  return 0;
}

/**
 * Coste de pasarela que se retiene por inscripción cobrada online, leído de
 * las constantes REALES de `lib/connect.ts` (no es comisión de TACTIUM).
 */
export const GATEWAY_FEE_LABEL = `${(INSCRIPTION_FEE_BPS / 100).toLocaleString("es-ES")} % + ${(
  INSCRIPTION_FEE_FIXED_CENTS / 100
).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`;

/** Jornadas con la sede de playoff por confirmar (`matchdays.home_unconfirmed`). */
export async function fetchUnconfirmedVenues(matchdayIds: string[]): Promise<Set<string>> {
  if (matchdayIds.length === 0) return new Set();
  const { data } = await supabaseBrowser()
    .from("matchdays")
    .select("id, home_unconfirmed")
    .in("id", matchdayIds);
  const out = new Set<string>();
  for (const r of (data ?? []) as { id: string; home_unconfirmed: boolean | null }[])
    if (r.home_unconfirmed) out.add(r.id);
  return out;
}

/* ── La semana de todos los equipos (misma idea que fetchClubOverview de la app) ── */
export interface WeekMatchday {
  id: string;
  team_id: string;
  jornada_number: number | null;
  match_date: string | null;
  match_time: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  outcome: string | null;
  score_for: number | null;
  score_against: number | null;
}

export interface TeamWeek {
  next: WeekMatchday | null;
  last: WeekMatchday | null;
}

/** Próxima jornada y último resultado de cada equipo, con su temporada activa. */
export async function fetchClubWeek(teamIds: string[]): Promise<Record<string, TeamWeek>> {
  const out: Record<string, TeamWeek> = {};
  for (const id of teamIds) out[id] = { next: null, last: null };
  if (teamIds.length === 0) return out;
  const sb = supabaseBrowser();
  const { data: seasons } = await sb
    .from("seasons")
    .select("id, team_id")
    .in("team_id", teamIds)
    .eq("active", true);
  const teamBySeason = new Map<string, string>();
  for (const s of (seasons ?? []) as { id: string; team_id: string }[]) teamBySeason.set(s.id, s.team_id);
  if (teamBySeason.size === 0) return out;
  const { data: mds } = await sb
    .from("matchdays")
    .select(
      "id, season_id, jornada_number, match_date, match_time, opponent, is_home, location, outcome, score_for, score_against",
    )
    .in("season_id", [...teamBySeason.keys()]);
  const today = todayIso();
  for (const raw of (mds ?? []) as (Omit<WeekMatchday, "team_id"> & { season_id: string })[]) {
    const team = teamBySeason.get(raw.season_id);
    if (!team) continue;
    const md: WeekMatchday = { ...raw, team_id: team };
    const cur = out[team];
    if (md.outcome == null) {
      if (md.match_date && md.match_date < today) continue;
      const better =
        !cur.next ||
        (md.match_date ?? "9999") < (cur.next.match_date ?? "9999") ||
        ((md.match_date ?? "9999") === (cur.next.match_date ?? "9999") &&
          (md.jornada_number ?? 0) < (cur.next.jornada_number ?? 0));
      if (better) cur.next = md;
    } else if (!cur.last || (md.match_date ?? "") > (cur.last.match_date ?? "")) {
      cur.last = md;
    }
  }
  return out;
}

/* ── Inscripciones de la temporada que viene (FCP) ────────────────────
 * Puerto de `fetchClubInscripciones` de la app (core/services/fcpInscripciones):
 * se cruza por NOMBRE + género porque el id_equipo de la Federación cambia cada
 * temporada. Devuelve null si no hay liga en inscripción para este club. */
export interface FcpInscripcion {
  equipo: string;
  genero: "M" | "F" | null;
  categoria: string | null;
  confirmado: boolean;
  enTactium: boolean;
  categoriaActual: string | null;
  sede: string | null;
  jugadores: { idJugador: string; nombre: string; puntos: number }[];
}
export interface FcpInscripcionesResumen {
  temporada: string;
  total: number;
  confirmados: number;
  rows: FcpInscripcion[];
}

const normName = (s: string | null | undefined) =>
  (s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clubOfTeam = (equipo: string): string => {
  let s = equipo.trim().replace(/\s+/g, " ");
  s = s.replace(/\s*[-–]\s*[^-–]+$/, "").trim() || s;
  s = s.replace(/\s+(G[º°]\.?|GRUPO)\s+.+$/i, "").trim() || s;
  s = s.replace(/[\s\-–]+$/, "").trim() || equipo.trim();
  s = s.replace(/\s+(MASCULINO|FEMENINO)?\s*([A-ZÑ]|\d{1,2}|I{2,3}|IV|VI{0,3}|IX|XI{0,2})$/i, "").trim();
  return s || equipo.trim();
};
const catShortLocal = (s: string | null | undefined): string | null => {
  const m = (s ?? "").match(/(\d+)\s*ª/);
  return m ? `${m[1]}ª` : null;
};
const seasonLabel = (temporada: string | null | undefined): string => {
  const t = (temporada ?? "").trim();
  const rango = t.match(/^(\d{4})\s*[/-]\s*(\d{2,4})$/);
  if (rango) return `${rango[1]}/${rango[2].length === 2 ? `20${rango[2]}` : rango[2]}`;
  const anio = t.match(/^(\d{4})$/);
  if (anio) return `${Number(anio[1]) - 1}/${anio[1]}`;
  return t;
};

export async function fetchClubInscripciones(
  teams: { id: string; name: string; gender: string | null; category: string | null }[],
): Promise<FcpInscripcionesResumen | null> {
  const conNombre = teams.filter((t) => (t.name ?? "").trim());
  if (conNombre.length === 0) return null;
  const sb = supabaseBrowser();
  const { data: cur } = await sb
    .from("fcp_partidos")
    .select("id_liga")
    .order("id_liga", { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentLiga = (cur as { id_liga: number } | null)?.id_liga ?? null;

  const bases = [...new Set(conNombre.map((t) => clubOfTeam(t.name)).filter(Boolean))];
  const vistos = new Set<string>();
  const idEquipoPorFila = new Map<number, number>();
  const rows: FcpInscripcion[] = [];
  let idLiga: number | null = null;
  for (const base of bases) {
    const safe = base.replace(/[%,()]/g, " ").trim();
    if (safe.length < 2) continue;
    const { data } = await sb
      .from("fcp_inscripciones")
      .select("id_liga, id_equipo, equipo, genero, grupo_nombre, confirmado, sede")
      .ilike("equipo", `${safe}%`)
      .limit(200);
    for (const r of (data ?? []) as {
      id_liga: number;
      id_equipo: number;
      equipo: string | null;
      genero: string | null;
      grupo_nombre: string | null;
      confirmado: boolean | null;
      sede: string | null;
    }[]) {
      if (currentLiga != null && r.id_liga <= currentLiga) continue;
      const equipo = (r.equipo ?? "").trim();
      if (!equipo) continue;
      const clave = `${normName(equipo)}|${r.genero ?? ""}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      idLiga = idLiga ?? r.id_liga;
      const mio = conNombre.find(
        (t) =>
          normName(t.name) === normName(equipo) &&
          (r.genero === "F" ? t.gender === "femenino" : t.gender !== "femenino"),
      );
      rows.push({
        equipo,
        genero: r.genero === "F" ? "F" : r.genero === "M" ? "M" : null,
        categoria: catShortLocal(r.grupo_nombre),
        confirmado: !!r.confirmado,
        enTactium: !!mio,
        categoriaActual: mio?.category ?? null,
        sede: r.sede ?? null,
        jugadores: [],
      });
      idEquipoPorFila.set(rows.length - 1, r.id_equipo);
    }
  }
  if (rows.length === 0) return null;

  const idsEquipo = [...new Set([...idEquipoPorFila.values()])];
  if (idsEquipo.length) {
    const { data: jug } = await sb
      .from("fcp_jugadores")
      .select("id_jugador, nombre, nombre_pila, apellido1, apellido2, puntos, id_equipo")
      .in("id_equipo", idsEquipo)
      .order("puntos", { ascending: false, nullsFirst: false })
      .limit(2000);
    const porEquipo = new Map<number, FcpInscripcion["jugadores"]>();
    for (const j of (jug ?? []) as {
      id_jugador: string;
      nombre: string | null;
      nombre_pila: string | null;
      apellido1: string | null;
      apellido2: string | null;
      puntos: number | null;
      id_equipo: number;
    }[]) {
      const lista = porEquipo.get(j.id_equipo) ?? [];
      lista.push({
        idJugador: j.id_jugador,
        nombre:
          [j.nombre_pila, j.apellido1, j.apellido2].filter(Boolean).join(" ").trim() ||
          (j.nombre ?? "—"),
        puntos: j.puntos ?? 0,
      });
      porEquipo.set(j.id_equipo, lista);
    }
    for (const [i, idEq] of idEquipoPorFila) rows[i].jugadores = porEquipo.get(idEq) ?? [];
  }

  let temporada = "";
  if (idLiga != null) {
    const { data: liga } = await sb
      .from("fcp_ligas")
      .select("temporada")
      .eq("id_liga", idLiga)
      .maybeSingle();
    temporada = seasonLabel((liga as { temporada: string | null } | null)?.temporada);
  }
  rows.sort((a, b) => a.equipo.localeCompare(b.equipo) || (a.genero ?? "").localeCompare(b.genero ?? ""));
  return {
    temporada,
    total: rows.length,
    confirmados: rows.filter((r) => r.confirmado).length,
    rows,
  };
}
