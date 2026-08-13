"use client";

import { supabaseBrowser } from "./supabase/client";
import type { Position } from "./team-data";

/**
 * Capa de datos.
 *
 * Todas las consultas van bajo RLS con la sesión del usuario, así que devuelven
 * exactamente lo que ese usuario puede ver — igual que en la app móvil. Nada
 * aquí usa la service role key.
 *
 * Las tablas de torneos y las `public_*` se leen por RPC `SECURITY DEFINER`,
 * que es como la app las expone también a usuarios sin sesión.
 */

/* ── Plantilla ─────────────────────────────────────────────────── */
export interface DbPlayer {
  id: string;
  name: string;
  alias: string | null;
  pts: number;
  position: Position;
  active: boolean;
  available: boolean | null;
  userId: string | null;
  photoUrl: string | null;
}

export async function fetchPlayers(teamId: string): Promise<DbPlayer[]> {
  const { data, error } = await supabaseBrowser()
    .from("players")
    .select("id, name, alias, pts, position, active, available, user_id, photo_url")
    .eq("team_id", teamId)
    .order("pts", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    alias: p.alias,
    pts: p.pts ?? 0,
    position: (p.position ?? "Ambos") as Position,
    active: p.active ?? true,
    available: p.available,
    userId: p.user_id,
    photoUrl: p.photo_url,
  }));
}

/* ── Temporadas ────────────────────────────────────────────────── */
export interface DbSeason {
  id: string;
  name: string;
  category: string | null;
  phase: "liga" | "playoff" | "mixto";
  totalMatchdays: number | null;
  active: boolean;
}

export async function fetchSeasons(teamId: string): Promise<DbSeason[]> {
  const { data, error } = await supabaseBrowser()
    .from("seasons")
    .select("id, name, category, phase, total_matchdays, active, created_at")
    .eq("team_id", teamId)
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    phase: (s.phase ?? "liga") as DbSeason["phase"],
    totalMatchdays: s.total_matchdays,
    active: !!s.active,
  }));
}

/** La temporada activa del equipo, o la más reciente si no hay ninguna activa. */
export async function fetchActiveSeason(
  teamId: string
): Promise<DbSeason | null> {
  const all = await fetchSeasons(teamId);
  return all.find((s) => s.active) ?? all[0] ?? null;
}

/* ── Jornadas ──────────────────────────────────────────────────── */
export interface DbMatchday {
  id: string;
  seasonId: string;
  round: number;
  date: string | null;
  time: string | null;
  opponent: string;
  isHome: boolean;
  status: "upcoming" | "in_progress" | "finished";
  outcome: "win" | "draw" | "loss" | null;
  location: string | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  photoUrl: string | null;
}

function mapMatchday(m: Record<string, unknown>): DbMatchday {
  return {
    id: m.id as string,
    seasonId: m.season_id as string,
    round: (m.jornada_number as number) ?? 0,
    date: (m.match_date as string) ?? null,
    time: (m.match_time as string) ?? null,
    opponent: (m.opponent as string) ?? "Rival",
    isHome: !!m.is_home,
    status: (m.status as DbMatchday["status"]) ?? "upcoming",
    outcome: (m.outcome as DbMatchday["outcome"]) ?? null,
    location: (m.location as string) ?? null,
    scoreFor: (m.score_for as number) ?? null,
    scoreAgainst: (m.score_against as number) ?? null,
    photoUrl: (m.photo_url as string) ?? null,
  };
}

const MATCHDAY_COLS =
  "id, season_id, jornada_number, match_date, match_time, opponent, is_home, status, outcome, location, score_for, score_against, photo_url";

export async function fetchMatchdays(seasonId: string): Promise<DbMatchday[]> {
  const { data, error } = await supabaseBrowser()
    .from("matchdays")
    .select(MATCHDAY_COLS)
    .eq("season_id", seasonId)
    .order("jornada_number", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapMatchday);
}

export async function fetchMatchday(id: string): Promise<DbMatchday | null> {
  const { data, error } = await supabaseBrowser()
    .from("matchdays")
    .select(MATCHDAY_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapMatchday(data) : null;
}

/** La próxima jornada sin jugar de la temporada activa. */
export async function fetchNextMatchday(
  seasonId: string
): Promise<DbMatchday | null> {
  const { data, error } = await supabaseBrowser()
    .from("matchdays")
    .select(MATCHDAY_COLS)
    .eq("season_id", seasonId)
    .neq("status", "finished")
    .order("jornada_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapMatchday(data) : null;
}

/* ── Alineación ────────────────────────────────────────────────── */
export interface DbVariant {
  id: string;
  label: string;
  isActive: boolean;
}

export interface DbLineupRow {
  court: number;
  playerA: string | null;
  playerB: string | null;
  variantId: string | null;
}

export async function fetchVariants(matchdayId: string): Promise<DbVariant[]> {
  const { data, error } = await supabaseBrowser()
    .from("lineup_variants")
    .select("id, label, is_active")
    .eq("matchday_id", matchdayId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    label: v.label ?? "Variante",
    isActive: !!v.is_active,
  }));
}

export async function fetchLineup(
  matchdayId: string,
  variantId?: string
): Promise<DbLineupRow[]> {
  let q = supabaseBrowser()
    .from("lineups")
    .select("court_number, player_a_id, player_b_id, variant_id")
    .eq("matchday_id", matchdayId);

  if (variantId) q = q.eq("variant_id", variantId);

  const { data, error } = await q.order("court_number", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((l) => ({
    court: l.court_number,
    playerA: l.player_a_id,
    playerB: l.player_b_id,
    variantId: l.variant_id,
  }));
}

/**
 * Guarda la alineación de una variante: por cada pista, upsert de la pareja
 * (matchday_id, variant_id, court_number, player_a/b) si tiene al menos un
 * jugador, o borra la fila si está vacía. Identidad `(variant_id, court_number)`.
 * Espejo de `setLineupPair`/`clearLineupPair` de la app. Pasa por `guardedWrite`.
 */
export async function saveLineupVariant(
  matchdayId: string,
  variantId: string,
  courts: [string | null, string | null][],
): Promise<void> {
  const sb = supabaseBrowser();
  for (let i = 0; i < courts.length; i++) {
    const [a, b] = courts[i];
    const court = i + 1;
    if (a || b) {
      const { error } = await sb.from("lineups").upsert(
        {
          matchday_id: matchdayId,
          variant_id: variantId,
          court_number: court,
          player_a_id: a,
          player_b_id: b,
        },
        { onConflict: "variant_id,court_number" },
      );
      if (error) throw error;
    } else {
      const { error } = await sb
        .from("lineups")
        .delete()
        .eq("variant_id", variantId)
        .eq("court_number", court);
      if (error) throw error;
    }
  }
}

/* ── Disponibilidad ────────────────────────────────────────────── */
export async function fetchAvailability(
  matchdayId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabaseBrowser()
    .from("availability")
    .select("player_id, available")
    .eq("matchday_id", matchdayId);

  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((a) => [a.player_id as string, !!a.available])
  );
}

/* ── Resultados ────────────────────────────────────────────────── */
export interface DbResultRow {
  court: number;
  set: number;
  us: number;
  them: number;
  forfeit: boolean;
  forfeitUs: boolean | null;
}

export async function fetchResults(matchdayId: string): Promise<DbResultRow[]> {
  const { data, error } = await supabaseBrowser()
    .from("match_results")
    .select("court_number, set_number, us, them, forfeit, forfeit_us")
    .eq("matchday_id", matchdayId)
    .order("court_number", { ascending: true })
    .order("set_number", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    court: r.court_number,
    set: r.set_number,
    us: r.us ?? 0,
    them: r.them ?? 0,
    forfeit: !!r.forfeit,
    forfeitUs: r.forfeit_us,
  }));
}

/* ── Escrituras de resultados (match_results) ───────────────────────
   Espejo de TACTIUM/src/core/services/matchResults.ts. Estas funciones NO
   comprueban el interruptor de escritura: siempre pasan por `guardedWrite`
   en el componente, que las deja inertes si las escrituras están apagadas. */

/** Upsert de un set concreto de una pista (matchday+pista+set es único). */
export async function upsertSetResult(
  matchdayId: string,
  court: number,
  setNumber: number,
  us: number | null,
  them: number | null,
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("match_results")
    .upsert(
      {
        matchday_id: matchdayId,
        court_number: court,
        set_number: setNumber,
        us,
        them,
        forfeit: false,
      },
      { onConflict: "matchday_id,court_number,set_number" },
    );
  if (error) throw error;
}

/** Guarda los sets de una pista de golpe: los que tienen marcador se upsertan;
 *  los vacíos se borran (vuelven a «sin resultado»). */
export async function saveCourtSets(
  matchdayId: string,
  court: number,
  sets: [number, number][],
): Promise<void> {
  for (let i = 0; i < sets.length; i++) {
    const [us, them] = sets[i];
    if (us > 0 || them > 0) {
      await upsertSetResult(matchdayId, court, i + 1, us, them);
    } else {
      const { error } = await supabaseBrowser()
        .from("match_results")
        .delete()
        .eq("matchday_id", matchdayId)
        .eq("court_number", court)
        .eq("set_number", i + 1);
      if (error) throw error;
    }
  }
}

/** W.O. de una pista: inserta sets con forfeit=true, o borra la pista si false. */
export async function setCourtForfeit(
  matchdayId: string,
  court: number,
  forfeit: boolean,
  forfeitUs = false,
  sets = 3,
): Promise<void> {
  const sb = supabaseBrowser();
  if (forfeit) {
    const rows = Array.from({ length: sets }, (_, i) => ({
      matchday_id: matchdayId,
      court_number: court,
      set_number: i + 1,
      us: null,
      them: null,
      forfeit: true,
      forfeit_us: forfeitUs,
    }));
    const { error } = await sb
      .from("match_results")
      .upsert(rows, { onConflict: "matchday_id,court_number,set_number" });
    if (error) throw error;
  } else {
    const { error } = await sb
      .from("match_results")
      .delete()
      .eq("matchday_id", matchdayId)
      .eq("court_number", court);
    if (error) throw error;
  }
}

/**
 * Todo lo que necesita la pantalla de jornada, en una sola pasada.
 *
 * Se piden en paralelo porque son independientes: si alguna falla, falla la
 * pantalla entera y se ve el error — mejor que pintar media jornada.
 */
export interface MatchdayBundle {
  matchday: DbMatchday;
  players: DbPlayer[];
  variants: DbVariant[];
  lineup: DbLineupRow[];
  results: DbResultRow[];
  availability: Record<string, boolean>;
}

export async function fetchMatchdayBundle(
  matchdayId: string,
  teamId: string
): Promise<MatchdayBundle | null> {
  const matchday = await fetchMatchday(matchdayId);
  if (!matchday) return null;

  const [players, variants, results, availability] = await Promise.all([
    fetchPlayers(teamId),
    fetchVariants(matchdayId),
    fetchResults(matchdayId),
    fetchAvailability(matchdayId),
  ]);

  // La alineación se pide después: depende de cuál sea la variante activa.
  const active = variants.find((v) => v.isActive) ?? variants[0];
  const lineup = await fetchLineup(matchdayId, active?.id);

  return { matchday, players, variants, lineup, results, availability };
}

/* ── Club ──────────────────────────────────────────────────────── */
export interface DbClubTeam {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  covered: boolean;
}

export async function fetchClubTeams(clubId: string): Promise<DbClubTeam[]> {
  const { data, error } = await supabaseBrowser()
    .from("teams")
    .select("id, name, category, gender, covered")
    .eq("club_id", clubId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    gender: t.gender,
    covered: !!t.covered,
  }));
}

export async function fetchClub(clubId: string) {
  const { data, error } = await supabaseBrowser()
    .from("clubs")
    .select("id, name, federation")
    .eq("id", clubId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ── Horarios de local del club (RPC get_club_home_schedule) ─────── */
export interface DbClubHomeMatch {
  matchday_id: string;
  team_id: string;
  team_name: string;
  jornada_number: number | null;
  match_date: string | null; // 'YYYY-MM-DD'
  match_time: string | null; // 'HH:MM:SS'
  location: string | null;
  opponent: string | null;
  status: string;
  preferred_home_slots: string[]; // franjas favoritas del equipo ('HH:MM')
}

/** Partidos de LOCAL (no cerrados) de todos los equipos del club. */
export async function fetchClubHomeSchedule(
  clubId: string,
): Promise<DbClubHomeMatch[]> {
  const { data, error } = await supabaseBrowser().rpc("get_club_home_schedule", {
    target_club: clubId,
  });
  if (error) throw error;
  return ((data ?? []) as DbClubHomeMatch[]).map((m) => ({
    ...m,
    preferred_home_slots: m.preferred_home_slots ?? [],
  }));
}

/* ── Suscripción ───────────────────────────────────────────────── */
export interface DbSubscription {
  id: string;
  status: string;
  planTier: string;
  platform: string;
  subjectType: string;
  currentPeriodEnd: string | null;
  scheduledPlanTier: string | null;
  billingPeriod: string | null;
}

export async function fetchSubscription(): Promise<DbSubscription | null> {
  const { data, error } = await supabaseBrowser()
    .from("subscriptions")
    .select(
      "id, status, plan_tier, platform, subject_type, current_period_end, scheduled_plan_tier, billing_period"
    )
    .in("status", ["trialing", "active", "grace_period"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    planTier: data.plan_tier,
    platform: data.platform,
    subjectType: data.subject_type,
    currentPeriodEnd: data.current_period_end,
    scheduledPlanTier: data.scheduled_plan_tier,
    billingPeriod: data.billing_period,
  };
}

/* ── Torneos · RPC, también para anónimos ──────────────────────── */
export interface DbTournament {
  id: string;
  name: string;
  club_name: string | null;
  location: string | null;
  starts_on: string | null;
  format: string;
  status: string;
  categories: string[] | null;
  genders: string[] | null;
  entry_fee: number | null;
  fee_currency: string | null;
  players: number | null;
  signup_code: string | null;
  cover_url: string | null;
  pair_based: boolean | null;
}

export async function exploreTournaments(
  search?: string
): Promise<DbTournament[]> {
  const { data, error } = await supabaseBrowser().rpc("explore_tournaments", {
    p_search: search?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as DbTournament[];
}

export async function fetchTournament(id: string) {
  const { data, error } = await supabaseBrowser().rpc("public_get_tournament", {
    p_id: id,
  });
  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

export async function fetchTournamentMatches(id: string) {
  const { data, error } = await supabaseBrowser().rpc(
    "public_tournament_matches",
    { p_id: id }
  );
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function fetchTournamentRegs(id: string) {
  const { data, error } = await supabaseBrowser().rpc("public_tournament_regs", {
    p_id: id,
  });
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/* ── Comunidad · RPC ───────────────────────────────────────────── */
export interface CommunityHit {
  type: "user" | "club";
  id: string;
  name: string;
  subtitle: string | null;
  avatar_url: string | null;
  followers_count: number;
  is_following: boolean;
}

export async function searchCommunity(q: string): Promise<CommunityHit[]> {
  if (q.trim().length < 2) return [];
  const { data, error } = await supabaseBrowser().rpc("search_community", { q });
  if (error) throw error;
  return (data ?? []) as CommunityHit[];
}

export interface FeedRow {
  kind: "casual" | "league";
  ref_id: string;
  occurred_on: string | null;
  actor_id: string | null;
  actor_name: string | null;
  avatar_url: string | null;
  title: string;
  subtitle: string | null;
  positive: boolean | null;
}

export async function fetchFeed(limit = 30): Promise<FeedRow[]> {
  const { data, error } = await supabaseBrowser().rpc("social_feed", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as FeedRow[];
}

export async function fetchPublicProfile(userId: string) {
  const { data, error } = await supabaseBrowser().rpc("get_public_user_profile", {
    target: userId,
  });
  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

/* ── Amistosos ─────────────────────────────────────────────────── */
export interface DbCasual {
  id: string;
  type: "amistoso" | "entreno" | "torneo";
  playedOn: string | null;
  /** `[[nuestros, suyos], …]` tal cual lo guarda el jsonb. */
  sets: [number, number][];
  winnerSide: number | null;
  claimCode: string | null;
  photoUrl: string | null;
  sideA: string[];
  sideB: string[];
}

export async function fetchCasualMatches(limit = 30): Promise<DbCasual[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("casual_matches")
    .select(
      "id, type, played_on, sets, winner_side, claim_code, photo_url, casual_match_participants(side, slot, name)"
    )
    .order("played_on", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((m) => {
    const parts = ((m.casual_match_participants ?? []) as {
      side: number;
      slot: number;
      name: string;
    }[]).slice().sort((a, b) => a.slot - b.slot);
    return {
      id: m.id,
      type: m.type,
      playedOn: m.played_on,
      sets: (Array.isArray(m.sets) ? m.sets : []) as [number, number][],
      winnerSide: m.winner_side,
      claimCode: m.claim_code,
      photoUrl: m.photo_url,
      sideA: parts.filter((p) => p.side === 0).map((p) => p.name),
      sideB: parts.filter((p) => p.side === 1).map((p) => p.name),
    };
  });
}

/* ── Federación ────────────────────────────────────────────────── */
export interface FcpGroup {
  idGrupo: string;
  idLiga: number;
  nombre: string;
  genero: string | null;
  temporada: string | null;
  /** "5ª" extraída del nombre — es por lo que se filtra por categoría. */
  categoria: string | null;
  /** Fase final (oro/plata/playoff) frente a fase regular. */
  esPlayoff: boolean;
}

/**
 * Categoría corta a partir del nombre del grupo: "5ª CATEGORIA MASC." → "5ª".
 * Espejo de `catShort` en la app (`core/services/fcpSearch.ts`).
 */
export const catShort = (s: string | null | undefined): string | null => {
  const m = (s ?? "").match(/(\d+)\s*ª/);
  return m ? `${m[1]}ª` : null;
};

export interface FcpLeague {
  idLiga: number;
  nombre: string;
  temporada: string | null;
}

/**
 * Temporadas disponibles, de la más reciente a la más antigua.
 *
 * Sólo las ligas que TIENEN grupos scrapeados: la federación crea entradas de
 * liga que luego quedan vacías (en 2026 hay tres y sólo una con datos), y
 * ofrecerlas daría un filtro que devuelve cero. Mismo criterio que
 * `fetchFcpYears` en la app.
 */
export async function fetchFcpLeagues(): Promise<FcpLeague[]> {
  const [{ data: grupos }, { data: ligas, error }] = await Promise.all([
    supabaseBrowser().from("fcp_grupos").select("id_liga"),
    supabaseBrowser().from("fcp_ligas").select("id_liga, nombre, temporada"),
  ]);
  if (error) throw error;
  const withData = new Set((grupos ?? []).map((g) => g.id_liga));
  return (ligas ?? [])
    .filter((l) => withData.has(l.id_liga))
    .map((l) => ({
      idLiga: l.id_liga,
      nombre: l.nombre ?? String(l.id_liga),
      temporada: l.temporada,
    }))
    .sort((a, b) => (b.temporada ?? "").localeCompare(a.temporada ?? ""));
}

/**
 * Grupos de una liga, ORDENADOS: primero la fase regular y dentro por nombre.
 * Sin esto salen en el orden que devuelve la base de datos, que no es ninguno.
 * Mismo criterio que `fetchFcpGroups` en la app.
 */
export async function fetchFcpGroups(
  idLiga?: number | null,
  limit = 600
): Promise<FcpGroup[]> {
  let sel = supabaseBrowser()
    .from("fcp_grupos")
    .select("id_grupo, id_liga, nombre, genero, temporada");
  if (idLiga != null) sel = sel.eq("id_liga", idLiga);
  const { data, error } = await sel.limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((g) => {
      const nombre = g.nombre ?? g.id_grupo;
      return {
        idGrupo: g.id_grupo,
        idLiga: g.id_liga,
        nombre,
        genero: g.genero,
        temporada: g.temporada,
        categoria: catShort(nombre),
        esPlayoff:
          /^fase/i.test(g.id_grupo) || /ORO|PLATA|PLAY\s*OFF/i.test(nombre),
      };
    })
    .sort((a, b) => {
      if (a.esPlayoff !== b.esPlayoff) return a.esPlayoff ? 1 : -1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}

/**
 * Nombre de la lista de ranking en la FCP según género y categoría. Las listas
 * generales usan "MASCULINO/FEMENINO"; las de división "MASCULINA/FEMENINA".
 * Copiado literal de la app: si no casa exacto, la consulta no devuelve nada.
 */
export function rankingCategoria(
  genero: "all" | "M" | "F",
  categoria: string
): string {
  const f = genero === "F";
  if (!categoria || categoria === "all")
    return `RANKING LIGA ${f ? "FEMENINO" : "MASCULINO"}`;
  return `${categoria} CATEGORIA ${f ? "FEMENINA" : "MASCULINA"}`;
}

export interface FcpTeamResult {
  idEquipo: number;
  equipo: string;
  idGrupo: string;
}

/**
 * Equipos federados. Salen de la clasificación, que es donde vive el nombre
 * del equipo junto a su grupo; `fcp_grupos` no los lista.
 */
export async function searchFcpTeams(opts: {
  query?: string;
  grupoIds?: string[];
  limit?: number;
}): Promise<FcpTeamResult[]> {
  const { query = "", grupoIds, limit = 60 } = opts;
  let sel = supabaseBrowser()
    .from("fcp_clasificacion")
    .select("id_equipo, equipo, id_grupo");
  const q = query.replace(/[%,()]/g, " ").trim();
  if (q.length >= 2) sel = sel.ilike("equipo", `%${q}%`);
  if (grupoIds?.length) sel = sel.in("id_grupo", grupoIds.slice(0, 200));
  const { data, error } = await sel.limit(limit * 4);
  if (error) throw error;

  // Un equipo aparece una vez por grupo: nos quedamos con una fila por equipo.
  const seen = new Map<number, FcpTeamResult>();
  for (const r of data ?? []) {
    if (r.id_equipo == null || seen.has(r.id_equipo)) continue;
    seen.set(r.id_equipo, {
      idEquipo: r.id_equipo,
      equipo: r.equipo ?? "—",
      idGrupo: r.id_grupo,
    });
  }
  return [...seen.values()]
    .sort((a, b) => a.equipo.localeCompare(b.equipo, "es"))
    .slice(0, limit);
}

export interface FcpRankingRow {
  posicion: number;
  name: string;
  puntos: number | null;
}

/** Ranking FCP por género/categoría. Con término, filtra por nombre. */
export async function fetchFcpRanking(opts: {
  genero: "all" | "M" | "F";
  categoria: string;
  query?: string;
  limit?: number;
}): Promise<FcpRankingRow[]> {
  const { genero, categoria, query = "", limit = 150 } = opts;
  let sel = supabaseBrowser()
    .from("fcp_rankings")
    .select("posicion, nombre, puntos")
    .eq("categoria", rankingCategoria(genero, categoria));
  const q = query.replace(/[%,()]/g, " ").trim();
  if (q.length >= 2) sel = sel.ilike("nombre", `%${q}%`);
  const { data, error } = await sel
    .order("posicion", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    posicion: r.posicion,
    name: r.nombre ?? "—",
    puntos: r.puntos == null ? null : Number(r.puntos),
  }));
}

export interface FcpStanding {
  posicion: number;
  idEquipo: number;
  equipo: string;
  puntos: number;
  pj: number;
  pg: number;
  setsFavor: number;
  setsContra: number;
  enf: number;
}

export async function fetchFcpStandings(
  idGrupo: string
): Promise<FcpStanding[]> {
  const { data, error } = await supabaseBrowser()
    .from("fcp_clasificacion")
    .select("posicion, id_equipo, equipo, puntos, pj, pg, sets_favor, sets_contra, enf")
    .eq("id_grupo", idGrupo)
    .order("posicion", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    posicion: r.posicion ?? 0,
    idEquipo: r.id_equipo,
    equipo: r.equipo ?? "—",
    puntos: r.puntos ?? 0,
    pj: r.pj ?? 0,
    pg: r.pg ?? 0,
    setsFavor: r.sets_favor ?? 0,
    setsContra: r.sets_contra ?? 0,
    enf: r.enf ?? 0,
  }));
}

export interface FcpMatch {
  idPartido: string;
  jornada: number | null;
  fecha: string | null;
  hora: string | null;
  local: string;
  visitante: string;
  resultado: string | null;
  ganador: string | null;
  estado: string | null;
  ronda: string | null;
  cuadro: string | null;
}

export async function fetchFcpMatches(
  idGrupo: string,
  limit = 200
): Promise<FcpMatch[]> {
  const { data, error } = await supabaseBrowser()
    .from("fcp_partidos")
    .select(
      "id_partido, jornada, fecha, hora, equipo_local, equipo_visit, resultado, ganador, estado, ronda, cuadro"
    )
    .eq("id_grupo", idGrupo)
    .order("jornada", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    idPartido: p.id_partido,
    jornada: p.jornada,
    fecha: p.fecha,
    hora: p.hora,
    local: p.equipo_local ?? "—",
    visitante: p.equipo_visit ?? "—",
    resultado: p.resultado,
    ganador: p.ganador,
    estado: p.estado,
    ronda: p.ronda,
    cuadro: p.cuadro,
  }));
}

export interface FcpPlayerRow {
  idJugador: string;
  nombre: string;
  categoria: string | null;
  puntos: number;
  idEquipo: number | null;
  nombreEquipo: string | null;
}

/** Nombre completo a partir de las tres columnas del scraper. */
function fullName(r: {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
}): string {
  return [r.nombre, r.apellido1, r.apellido2].filter(Boolean).join(" ").trim();
}

export async function searchFcpPlayers(
  q: string,
  limit = 40
): Promise<FcpPlayerRow[]> {
  if (q.trim().length < 3) return [];
  const term = `%${q.trim()}%`;
  const { data, error } = await supabaseBrowser()
    .from("fcp_jugadores")
    .select("id_jugador, nombre, apellido1, apellido2, categoria, puntos, id_equipo, nombre_equipo")
    .or(`nombre.ilike.${term},apellido1.ilike.${term},apellido2.ilike.${term}`)
    .order("puntos", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    idJugador: r.id_jugador,
    nombre: fullName(r) || "Jugador",
    categoria: r.categoria,
    puntos: r.puntos ?? 0,
    idEquipo: r.id_equipo,
    nombreEquipo: r.nombre_equipo,
  }));
}

export async function fetchFcpTeamPlayers(
  idEquipo: number
): Promise<FcpPlayerRow[]> {
  const { data, error } = await supabaseBrowser()
    .from("fcp_jugadores")
    .select("id_jugador, nombre, apellido1, apellido2, categoria, puntos, id_equipo, nombre_equipo")
    .eq("id_equipo", idEquipo)
    .order("puntos", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    idJugador: r.id_jugador,
    nombre: fullName(r) || "Jugador",
    categoria: r.categoria,
    puntos: r.puntos ?? 0,
    idEquipo: r.id_equipo,
    nombreEquipo: r.nombre_equipo,
  }));
}
