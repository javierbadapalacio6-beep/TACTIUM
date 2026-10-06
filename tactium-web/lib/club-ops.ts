/**
 * Datos operativos del club que el rediseño enseña de un vistazo (panel del
 * club, torneos y facturación). Espejo de `TACTIUM/src/features/club/clubOps.ts`.
 * Todo sale de tablas que el club ya lee bajo RLS: sin RPC ni tablas nuevas.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import { INSCRIPTION_FEE_BPS, INSCRIPTION_FEE_FIXED_CENTS } from "@/lib/connect";
import { fetchFcpGroupRivals, type FcpRival } from "@/lib/fcp-public";
import {
  diffClubSeason,
  fcpEstadoLabel,
  fcpPlayerKey,
  type FcpDiffActual,
  type FcpDiffSiguiente,
  type FcpSeasonEstado,
} from "@/lib/fcp-season-diff";

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
 * Puerto de `fetchClubInscripciones` de la app (core/services/fcpInscripciones).
 * Las filas se buscan por el nombre del club (prefijo) y cada una se casa con
 * su equipo de TACTIUM con `diffClubSeason` (lib/fcp-season-diff): primero por
 * jugadores en común y después por nombre sin patrocinador. No sirve el id —el
 * `id_equipo` de la Federación cambia cada temporada— ni basta el nombre
 * exacto: la FCP reasigna letras («ZINK PADEL F» pasa a «ZINK PADEL E») y el
 * equipo de siempre salía como nuevo. Devuelve null si no hay liga en
 * inscripción para este club. */
export interface FcpInscripcion {
  /** Liga, categoría y equipo en la Federación: hacen falta para pedir los
   *  rivales del grupo (`fetchInscripcionGrupo`) y para enlazar su ficha. */
  idLiga: number;
  idGrupo: string;
  idEquipo: number;
  equipo: string;
  genero: "M" | "F" | null;
  categoria: string | null;
  /** Grupo dentro de la categoría ('A' | 'B'…), del PDF de distribución de la
   *  Federación. Null mientras no se conozca. */
  subgrupo: string | null;
  confirmado: boolean;
  enTactium: boolean;
  /** Equipo de TACTIUM con el que se ha casado (por jugadores o por nombre). */
  teamId: string | null;
  categoriaActual: string | null;
  /** Qué le pasa respecto a la temporada en curso. */
  estado: FcpSeasonEstado;
  /** Nombre que tiene en TACTIUM cuando la Federación lo inscribe con otro. */
  antes: string | null;
  /** «Sigue en 2ª», «4ª → 3ª», «Antes ZINK PADEL F», «Nuevo». */
  estadoLabel: string;
  /** Sede de local, nombre largo. */
  sede: string | null;
  /** La misma sede en corto («SMASH», «GO FIT»). */
  sedeCorta: string | null;
  jugadores: { idJugador: string; nombre: string; puntos: number }[];
}
export interface FcpInscripcionesResumen {
  temporada: string;
  total: number;
  confirmados: number;
  rows: FcpInscripcion[];
  /** Equipos del club en TACTIUM, importados de la Federación, que no salen
   *  en la lista de inscritos de la temporada nueva. */
  desaparecen: { teamId: string; name: string; categoria: string | null }[];
}

const normName = (s: string | null | undefined) =>
  (s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

type ClubTeamLite = { id: string; name: string; gender: string | null; category: string | null };

type FcpJugadorClave = {
  nombre: string | null;
  nombre_pila: string | null;
  apellido1: string | null;
  apellido2: string | null;
};

/**
 * Plantilla de la temporada EN CURSO de cada equipo del club, como claves de
 * jugador (`fcpPlayerKey`), para cruzarla con la de la temporada que viene.
 *
 * Primero la de la Federación, por el vínculo `fcp_team_links`: es la lista
 * oficial y trae nombre y apellidos por separado. Si el equipo no está
 * vinculado (o la FCP no publica jugadores en él), la de TACTIUM: los
 * jugadores importados se guardan como «Nombre Apellido1 Apellido2», que
 * normalizado da la misma clave.
 *
 * Devuelve también qué equipos están vinculados: solo esos pueden
 * «desaparecer» de la Federación. Un equipo creado a mano nunca estuvo allí.
 * Copia de `plantillasActuales` de la app.
 */
async function plantillasActuales(
  teams: ClubTeamLite[],
): Promise<{ porEquipo: Map<string, Set<string>>; vinculados: Set<string> }> {
  const porEquipo = new Map<string, Set<string>>();
  const vinculados = new Set<string>();
  const ids = teams.map((t) => t.id);
  if (ids.length === 0) return { porEquipo, vinculados };
  const sb = supabaseBrowser();

  const { data: links } = await sb
    .from("fcp_team_links")
    .select("team_id, fcp_id_equipo")
    .in("team_id", ids);
  const linkRows = ((links ?? []) as { team_id: string; fcp_id_equipo: number | null }[]).filter(
    (l) => l.fcp_id_equipo != null,
  );
  for (const l of linkRows) vinculados.add(l.team_id);

  if (linkRows.length > 0) {
    const { data: jug } = await sb
      .from("fcp_jugadores")
      .select("id_equipo, nombre, nombre_pila, apellido1, apellido2")
      .in("id_equipo", [...new Set(linkRows.map((l) => l.fcp_id_equipo as number))])
      .limit(5000);
    const clavesPorFcp = new Map<number, Set<string>>();
    for (const j of (jug ?? []) as (FcpJugadorClave & { id_equipo: number })[]) {
      const k = fcpPlayerKey(j);
      if (!k) continue;
      const set = clavesPorFcp.get(j.id_equipo) ?? new Set<string>();
      set.add(k);
      clavesPorFcp.set(j.id_equipo, set);
    }
    // Un equipo acumula un vínculo por temporada: se juntan, porque cualquiera
    // de esos jugadores sirve para reconocerlo.
    for (const l of linkRows) {
      const claves = clavesPorFcp.get(l.fcp_id_equipo as number);
      if (!claves || claves.size === 0) continue;
      const set = porEquipo.get(l.team_id) ?? new Set<string>();
      claves.forEach((k) => set.add(k));
      porEquipo.set(l.team_id, set);
    }
  }

  const sinPlantilla = ids.filter((id) => !porEquipo.get(id)?.size);
  if (sinPlantilla.length > 0) {
    const { data: pl } = await sb
      .from("players")
      .select("team_id, name")
      .in("team_id", sinPlantilla)
      .eq("active", true)
      .limit(5000);
    for (const p of (pl ?? []) as { team_id: string; name: string | null }[]) {
      const k = fcpPlayerKey({ nombre: p.name });
      if (!k) continue;
      const set = porEquipo.get(p.team_id) ?? new Set<string>();
      set.add(k);
      porEquipo.set(p.team_id, set);
    }
  }

  return { porEquipo, vinculados };
}

type FilaInscripcionRaw = {
  id_liga: number;
  id_grupo: string;
  id_equipo: number;
  equipo: string | null;
  genero: string | null;
  grupo_nombre: string | null;
  subgrupo: string | null;
  confirmado: boolean | null;
  sede: string | null;
  sede_corta: string | null;
};

export async function fetchClubInscripciones(
  teams: ClubTeamLite[],
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
  const candidatas: FilaInscripcionRaw[] = [];
  for (const base of bases) {
    const safe = base.replace(/[%,()]/g, " ").trim();
    if (safe.length < 2) continue;
    const { data } = await sb
      .from("fcp_inscripciones")
      .select(
        "id_liga, id_grupo, id_equipo, equipo, genero, grupo_nombre, subgrupo, confirmado, sede, sede_corta",
      )
      .ilike("equipo", `${safe}%`)
      .limit(200);
    for (const r of (data ?? []) as FilaInscripcionRaw[]) {
      if (currentLiga != null && r.id_liga <= currentLiga) continue;
      if (!(r.equipo ?? "").trim()) continue;
      candidatas.push(r);
    }
  }
  if (candidatas.length === 0) return null;

  // Filas viejas. Al rellenar los grupos con el PDF de distribución quedaron
  // filas sin `subgrupo` en categorías que sí lo tienen: son inscripciones que
  // la Federación ya no publica, y contarlas pondría un equipo de más en la
  // lista del club. Se mira la categoría entera, una consulta para todas.
  const dudosas = [...new Set(candidatas.filter((r) => !r.subgrupo).map((r) => r.id_grupo))];
  const conSubgrupos = new Set<string>();
  if (dudosas.length > 0) {
    const { data: sg } = await sb
      .from("fcp_inscripciones")
      .select("id_grupo")
      .in("id_grupo", dudosas)
      .not("subgrupo", "is", null)
      .limit(5000);
    for (const g of (sg ?? []) as { id_grupo: string }[]) conSubgrupos.add(g.id_grupo);
  }

  // Una fila por equipo y género. Si aun así se repite, gana la que trae grupo.
  const porClave = new Map<string, FilaInscripcionRaw>();
  for (const r of candidatas) {
    if (!r.subgrupo && conSubgrupos.has(r.id_grupo)) continue;
    const clave = `${normName(r.equipo)}|${r.genero ?? ""}`;
    const previa = porClave.get(clave);
    if (!previa || (!previa.subgrupo && r.subgrupo)) porClave.set(clave, r);
  }
  const raws = [...porClave.values()];
  if (raws.length === 0) return null;
  const idLiga = raws[0].id_liga;

  // Plantillas de la temporada nueva y de la que se juega, a la vez. Todo en
  // bloque, no una consulta por equipo.
  const idsEquipo = [...new Set(raws.map((r) => r.id_equipo))];
  const [{ data: jug }, actualesInfo] = await Promise.all([
    sb
      .from("fcp_jugadores")
      .select("id_jugador, nombre, nombre_pila, apellido1, apellido2, puntos, id_equipo")
      .in("id_equipo", idsEquipo)
      .order("puntos", { ascending: false, nullsFirst: false })
      .limit(3000),
    plantillasActuales(conNombre),
  ]);
  const porEquipo = new Map<number, FcpInscripcion["jugadores"]>();
  const clavesPorEquipo = new Map<number, Set<string>>();
  for (const j of (jug ?? []) as (FcpJugadorClave & {
    id_jugador: string;
    puntos: number | null;
    id_equipo: number;
  })[]) {
    const lista = porEquipo.get(j.id_equipo) ?? [];
    lista.push({
      idJugador: j.id_jugador,
      nombre:
        [j.nombre_pila, j.apellido1, j.apellido2].filter(Boolean).join(" ").trim() ||
        (j.nombre ?? "—"),
      puntos: j.puntos ?? 0,
    });
    porEquipo.set(j.id_equipo, lista);
    const k = fcpPlayerKey(j);
    if (k) {
      const set = clavesPorEquipo.get(j.id_equipo) ?? new Set<string>();
      set.add(k);
      clavesPorEquipo.set(j.id_equipo, set);
    }
  }

  // El cruce de temporada: qué fila es qué equipo del club.
  const actuales: FcpDiffActual[] = conNombre.map((t) => ({
    teamId: t.id,
    name: t.name,
    genero: t.gender === "femenino" ? "F" : "M",
    categoria: t.category,
    jugadores: actualesInfo.porEquipo.get(t.id) ?? new Set<string>(),
  }));
  const generoDe = (g: string | null): "M" | "F" | null => (g === "F" ? "F" : g === "M" ? "M" : null);
  const siguientes: FcpDiffSiguiente[] = raws.map((r) => ({
    equipo: (r.equipo ?? "").trim(),
    genero: generoDe(r.genero),
    categoria: catShortLocal(r.grupo_nombre),
    jugadores: clavesPorEquipo.get(r.id_equipo) ?? new Set<string>(),
  }));
  const diff = diffClubSeason(actuales, siguientes);

  const rows: FcpInscripcion[] = raws.map((r, i) => {
    const d = diff.filas[i];
    const categoria = siguientes[i].categoria;
    return {
      idLiga: r.id_liga,
      idGrupo: r.id_grupo,
      idEquipo: r.id_equipo,
      equipo: siguientes[i].equipo,
      genero: siguientes[i].genero,
      categoria,
      subgrupo: r.subgrupo ?? null,
      confirmado: !!r.confirmado,
      enTactium: !!d.teamId,
      teamId: d.teamId,
      categoriaActual: d.categoriaAntes,
      estado: d.estado,
      antes: d.antes,
      estadoLabel: fcpEstadoLabel(d, categoria),
      sede: r.sede ?? null,
      sedeCorta: r.sede_corta ?? null,
      jugadores: porEquipo.get(r.id_equipo) ?? [],
    };
  });

  const { data: liga } = await sb
    .from("fcp_ligas")
    .select("temporada")
    .eq("id_liga", idLiga)
    .maybeSingle();
  const temporada = seasonLabel((liga as { temporada: string | null } | null)?.temporada);

  rows.sort((a, b) => a.equipo.localeCompare(b.equipo) || (a.genero ?? "").localeCompare(b.genero ?? ""));
  return {
    temporada,
    total: rows.length,
    confirmados: rows.filter((r) => r.confirmado).length,
    rows,
    // Solo los importados de la Federación: un equipo hecho a mano (amateur,
    // de pachanga) no tiene por qué estar inscrito y avisar de él sería ruido.
    desaparecen: diff.desaparecen
      .filter((t) => actualesInfo.vinculados.has(t.teamId))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Rivales del grupo de una fila de inscripción (vacío sin subgrupo). Es
 *  `fetchFcpGroupRivals` con el cliente del navegador; se pide al abrir la
 *  plantilla, no para todas las filas del panel a la vez. */
export function fetchInscripcionGrupo(fila: {
  idLiga: number;
  idGrupo: string;
  subgrupo: string | null;
  idEquipo?: number | null;
}): Promise<FcpRival[]> {
  return fetchFcpGroupRivals(supabaseBrowser(), fila);
}
