import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lecturas PÚBLICAS de la Federación (tablas `fcp_*`, lectura anon por RLS).
 *
 * Este módulo no lleva `"use client"` a propósito: las mismas consultas
 * sirven al navegador (vía `lib/queries.ts`, que les pasa el cliente con
 * sesión) y al servidor (vía `lib/seo/fcp.ts`, con el cliente anónimo), que
 * es lo que permite que Google reciba la clasificación y la plantilla en el
 * HTML en vez de un esqueleto vacío. Quien llama elige el cliente.
 */

/* ── Tipos ─────────────────────────────────────────────────────── */
export interface FcpGroupHeader {
  nombre: string;
  genero: string | null;
  temporada: string | null;
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
  /** Racha reciente (hasta 5, del más antiguo al más nuevo). Derivada. */
  form: ("V" | "D")[];
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

export interface FcpRosterPlayer {
  idJugador: string;
  name: string;
  puntos: number;
  categoria: string | null;
  /** Cara de la ficha federativa, si la hay. */
  avatarUrl: string | null;
}

/**
 * Un equipo de una temporada EN INSCRIPCIÓN. No tiene clasificación ni
 * partidos —el sorteo no está hecho— pero sí tiene todo lo que de verdad se
 * quiere mirar mientras dura la inscripción: en qué categoría le han
 * encuadrado, si el club ya lo confirmó, dónde jugará de local y, sobre todo,
 * su plantilla, que es donde se ven los fichajes.
 */
export interface FcpPreseason {
  categoria: string | null;
  genero: string | null;
  confirmado: boolean;
  sede: string | null;
  /** La sede en corto («SMASH», «GO FIT»), como la escribe el PDF de
   *  distribución de la Federación. */
  sedeCorta: string | null;
  /** Grupo dentro de la categoría ('A' | 'B'…). Null mientras la FCP no
   *  publique la distribución. */
  subgrupo: string | null;
  /** Los demás equipos de su grupo. Vacío sin `subgrupo`. */
  rivales: FcpRival[];
  temporada: string | null;
}

/** Un equipo del mismo grupo en una liga en inscripción. */
export interface FcpRival {
  idEquipo: number;
  equipo: string;
  sedeCorta: string | null;
  confirmado: boolean;
}

export interface FcpTeamProfile {
  idEquipo: number;
  equipo: string;
  grupo: string | null;
  idGrupo: string | null;
  posicion: number | null;
  puntos: number;
  pj: number;
  pg: number;
  pp: number;
  setsFavor: number;
  setsContra: number;
  form: ("V" | "D")[];
  roster: FcpRosterPlayer[];
  /** No null ⇒ la temporada aún no ha empezado y las cifras de arriba son 0
   *  porque no existen, no porque el equipo vaya mal. */
  preseason: FcpPreseason | null;
}

export interface FcpPartidoLite {
  equipo_local: string | null;
  equipo_visit: string | null;
  ganador: string | null;
  estado: string | null;
}

/* ── Helpers puros ─────────────────────────────────────────────── */

/** Nombre para mostrar: "NOMBRE APELLIDO1 APELLIDO2". La columna `nombre` viene
 *  como "APELLIDO1 APELLIDO2, NOMBRE", así que no sirve para presentación. */
export function fcpDisplayName(r: {
  nombre_pila?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  nombre?: string | null;
}): string {
  const n = [r.nombre_pila, r.apellido1, r.apellido2]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return n || (r.nombre ?? "Jugador");
}

/** «2ª CATEGORIA MASCULINA» → «2ª Masculina». El nombre que publica la FCP
 *  va en mayúsculas y repite «categoría»; en una línea de meta sobra todo
 *  menos el número y el género. Null si no trae número. */
export function fcpCategoriaCorta(
  grupoNombre: string | null | undefined,
  genero?: string | null
): string | null {
  const m = (grupoNombre ?? "").match(/(\d+)\s*ª/);
  if (!m) return null;
  const fem = /FEMEN/i.test(grupoNombre ?? "") || (genero ?? "").toUpperCase().startsWith("F");
  return `${m[1]}ª ${fem ? "Femenina" : "Masculina"}`;
}

/** PJ/PG/racha por equipo, derivados del calendario (fcp_partidos). */
export function deriveTeamStats(
  partidos: FcpPartidoLite[]
): Map<string, { pj: number; pg: number; form: ("V" | "D")[] }> {
  const stats = new Map<string, { pj: number; pg: number; form: ("V" | "D")[] }>();
  for (const p of partidos) {
    if (p.estado !== "jugado") continue;
    const sides: [string | null, boolean][] = [
      [p.equipo_local, true],
      [p.equipo_visit, false],
    ];
    for (const [name, isLocal] of sides) {
      if (!name) continue;
      const s = stats.get(name) ?? { pj: 0, pg: 0, form: [] as ("V" | "D")[] };
      s.pj += 1;
      const won =
        (p.ganador === "local" && isLocal) ||
        (p.ganador === "visitante" && !isLocal);
      const decided = p.ganador === "local" || p.ganador === "visitante";
      if (won) s.pg += 1;
      if (decided) s.form.push(won ? "V" : "D");
      stats.set(name, s);
    }
  }
  return stats;
}

/* ── Grupo ─────────────────────────────────────────────────────── */

/** Nombre legible del grupo: la URL sólo trae su identificador. */
export async function fetchFcpGroupHeader(
  sb: SupabaseClient,
  idGrupo: string
): Promise<FcpGroupHeader | null> {
  const { data, error } = await sb
    .from("fcp_grupos")
    .select("nombre, genero, temporada")
    .eq("id_grupo", idGrupo)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    nombre: data.nombre ?? idGrupo,
    genero: data.genero ?? null,
    temporada: data.temporada ?? null,
  };
}

export async function fetchFcpStandings(
  sb: SupabaseClient,
  idGrupo: string
): Promise<FcpStanding[]> {
  // PJ/PG/racha se DERIVAN de fcp_partidos: las columnas de fcp_clasificacion
  // vienen en 0 (el scrape de la matriz no las rellena).
  const [{ data, error }, { data: partidos, error: pe }] = await Promise.all([
    sb
      .from("fcp_clasificacion")
      .select("posicion, id_equipo, equipo, puntos, sets_favor, sets_contra, enf")
      .eq("id_grupo", idGrupo)
      .order("posicion", { ascending: true }),
    sb
      .from("fcp_partidos")
      .select("equipo_local, equipo_visit, ganador, estado, jornada")
      .eq("id_grupo", idGrupo)
      .order("jornada", { ascending: true }),
  ]);
  if (error) throw error;
  if (pe) throw pe;
  const stats = deriveTeamStats((partidos ?? []) as FcpPartidoLite[]);
  return (data ?? []).map((r) => {
    const s = stats.get(r.equipo) ?? { pj: 0, pg: 0, form: [] as ("V" | "D")[] };
    return {
      posicion: r.posicion ?? 0,
      idEquipo: r.id_equipo,
      equipo: r.equipo ?? "—",
      puntos: r.puntos ?? 0,
      pj: s.pj,
      pg: s.pg,
      setsFavor: r.sets_favor ?? 0,
      setsContra: r.sets_contra ?? 0,
      enf: r.enf ?? 0,
      form: s.form.slice(-5),
    };
  });
}

export async function fetchFcpMatches(
  sb: SupabaseClient,
  idGrupo: string,
  limit = 200
): Promise<FcpMatch[]> {
  const { data, error } = await sb
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

/* ── Último cruce entre dos equipos ────────────────────────────── */

/** Nombre de equipo normalizado para cruzar (mayúsculas, sin tildes ni
 *  signos). El de la federación va en mayúsculas y el que escribe el capitán
 *  no, así que la comparación tiene que ser tolerante. */
export function fcpTeamKey(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export interface FcpMeeting {
  idPartido: string;
  jornada: number | null;
  fecha: string | null;
  /** Partidos ganados por «nosotros» y por el rival (null si el acta no
   *  trae un marcador legible). */
  us: number | null;
  them: number | null;
  /** true = ganamos, false = perdimos, null = sin ganador claro. */
  won: boolean | null;
}

/**
 * El último partido JUGADO entre `ours` y `rival` dentro de un calendario de
 * grupo, contado desde el punto de vista de `ours` (el marcador se da la
 * vuelta si fuimos visitantes). `excludeDate` deja fuera el partido de ese
 * día: en la jornada que se está mirando, «último cruce» es el anterior.
 */
export function findLastFcpMeeting(
  matches: FcpMatch[],
  ours: string,
  rival: string,
  excludeDate?: string | null
): FcpMeeting | null {
  const a = fcpTeamKey(ours);
  const b = fcpTeamKey(rival);
  if (!a || !b) return null;
  const hits = matches.filter((m) => {
    if (excludeDate && m.fecha === excludeDate) return false;
    if (m.estado !== "jugado" && !m.resultado) return false;
    const l = fcpTeamKey(m.local);
    const v = fcpTeamKey(m.visitante);
    return (l === a && v === b) || (l === b && v === a);
  });
  if (hits.length === 0) return null;
  hits.sort(
    (x, y) =>
      (y.fecha ?? "").localeCompare(x.fecha ?? "") ||
      (y.jornada ?? 0) - (x.jornada ?? 0)
  );
  const m = hits[0];
  const weLocal = fcpTeamKey(m.local) === a;
  const sc = (m.resultado ?? "").match(/^\s*(\d+)\s*-\s*(\d+)/);
  const l = sc ? Number(sc[1]) : null;
  const v = sc ? Number(sc[2]) : null;
  const won =
    m.ganador === "local"
      ? weLocal
      : m.ganador === "visitante"
        ? !weLocal
        : null;
  return {
    idPartido: m.idPartido,
    jornada: m.jornada,
    fecha: m.fecha,
    us: weLocal ? l : v,
    them: weLocal ? v : l,
    won,
  };
}

/* ── Equipo ────────────────────────────────────────────────────── */

type FcpJugadorRow = {
  id_jugador: string;
  puntos: number | null;
  categoria: string | null;
  nombre_pila: string | null;
  apellido1: string | null;
  apellido2: string | null;
  nombre: string | null;
};

/** Plantilla de un equipo, por id de la Federación. */
export async function fetchFcpRoster(
  sb: SupabaseClient,
  idEquipo: number
): Promise<FcpRosterPlayer[]> {
  const { data } = await sb
    .from("fcp_jugadores")
    .select("id_jugador, nombre_pila, apellido1, apellido2, nombre, puntos, categoria")
    .eq("id_equipo", idEquipo)
    .order("puntos", { ascending: false, nullsFirst: false });
  const rows = (data ?? []) as FcpJugadorRow[];
  // Las caras salen del mismo RPC que el acta; si falla, la lista va sin foto.
  const faces = new Map<string, string | null>();
  if (rows.length > 0) {
    try {
      const { data: fotos } = await sb.rpc("fcp_player_avatars", {
        p_ids: rows.map((r) => r.id_jugador),
      });
      for (const f of (fotos ?? []) as { fcp_id_jugador?: string; id_jugador?: string; avatar_url: string | null }[]) {
        const key = f.fcp_id_jugador ?? f.id_jugador;
        if (key) faces.set(key, f.avatar_url);
      }
    } catch {
      /* sin fotos */
    }
  }
  return rows.map((r) => ({
    idJugador: r.id_jugador,
    name: fcpDisplayName(r),
    puntos: r.puntos ?? 0,
    categoria: r.categoria ?? null,
    avatarUrl: faces.get(r.id_jugador) ?? null,
  }));
}

/**
 * Ficha de un equipo que todavía no tiene calendario.
 *
 * Existe porque la ficha normal arranca resolviendo el grupo desde la
 * CLASIFICACIÓN, y una liga en inscripción no tiene ninguna: la pantalla decía
 * «no hay datos sincronizados» para los 323 equipos de la temporada que viene,
 * cuando en realidad teníamos su categoría, su sede y su plantilla.
 */
async function fetchFcpPreseasonTeam(
  sb: SupabaseClient,
  idEquipo: number
): Promise<FcpTeamProfile | null> {
  // Varias filas y no `maybeSingle`: al rellenar los grupos con el PDF de
  // distribución quedaron un par de filas viejas sin `subgrupo` para equipos
  // que también tienen la buena. De la liga más nueva, gana la que trae grupo.
  const { data } = await sb
    .from("fcp_inscripciones")
    .select(
      "id_liga, id_grupo, equipo, genero, grupo_nombre, confirmado, sede, subgrupo, sede_corta"
    )
    .eq("id_equipo", idEquipo)
    .order("id_liga", { ascending: false })
    .limit(5);
  const filas = (data ?? []) as {
    id_liga: number;
    id_grupo: string;
    equipo: string | null;
    genero: string | null;
    grupo_nombre: string | null;
    confirmado: boolean | null;
    sede: string | null;
    subgrupo: string | null;
    sede_corta: string | null;
  }[];
  if (filas.length === 0) return null;
  const deLaUltima = filas.filter((f) => f.id_liga === filas[0].id_liga);
  const r = deLaUltima.find((f) => f.subgrupo) ?? deLaUltima[0];

  const [{ data: liga }, roster, rivales] = await Promise.all([
    sb
      .from("fcp_ligas")
      .select("temporada, nombre")
      .eq("id_liga", r.id_liga)
      .maybeSingle(),
    fetchFcpRoster(sb, idEquipo),
    fetchFcpGroupRivals(sb, {
      idLiga: r.id_liga,
      idGrupo: r.id_grupo,
      subgrupo: r.subgrupo,
      idEquipo,
    }).catch(() => [] as FcpRival[]),
  ]);

  return {
    idEquipo,
    equipo: (r.equipo ?? "").trim() || "—",
    grupo: r.grupo_nombre,
    idGrupo: null,
    posicion: null,
    puntos: 0,
    pj: 0,
    pg: 0,
    pp: 0,
    setsFavor: 0,
    setsContra: 0,
    form: [],
    roster,
    preseason: {
      categoria: r.grupo_nombre,
      genero: r.genero,
      confirmado: r.confirmado === true,
      sede: r.sede,
      sedeCorta: r.sede_corta ?? null,
      subgrupo: r.subgrupo ?? null,
      rivales,
      temporada:
        (liga as { temporada: string | null } | null)?.temporada ?? null,
    },
  };
}

/**
 * Rivales de un equipo en la liga que viene: misma liga, misma categoría
 * (`id_grupo`) y mismo grupo dentro de ella (`subgrupo`), sin el propio
 * equipo, por nombre.
 *
 * Sin subgrupo devuelve []: la categoría entera son hasta 32 equipos y casi
 * ninguno será rival, así que enseñarla como «su grupo» sería falso. Filtrar
 * por subgrupo deja fuera, de paso, las filas viejas que se quedaron sin él.
 * Mismo criterio que `fetchInscripcionGrupo` en la app.
 */
export async function fetchFcpGroupRivals(
  sb: SupabaseClient,
  f: { idLiga: number; idGrupo: string; subgrupo: string | null; idEquipo?: number | null }
): Promise<FcpRival[]> {
  if (!f.subgrupo) return [];
  const { data, error } = await sb
    .from("fcp_inscripciones")
    .select("id_equipo, equipo, sede_corta, confirmado")
    .eq("id_liga", f.idLiga)
    .eq("id_grupo", f.idGrupo)
    .eq("subgrupo", f.subgrupo)
    .limit(100);
  if (error) throw error;
  const vistos = new Set<number>();
  return ((data ?? []) as {
    id_equipo: number;
    equipo: string | null;
    sede_corta: string | null;
    confirmado: boolean | null;
  }[])
    .filter((r) => {
      if (r.id_equipo === f.idEquipo || !(r.equipo ?? "").trim()) return false;
      if (vistos.has(r.id_equipo)) return false;
      vistos.add(r.id_equipo);
      return true;
    })
    .map((r) => ({
      idEquipo: r.id_equipo,
      equipo: (r.equipo ?? "").trim(),
      sedeCorta: r.sede_corta ?? null,
      confirmado: !!r.confirmado,
    }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo, "es"));
}

/** Grupo principal (liga regular) de un id_equipo federativo: el que tiene más
 *  partidos (donde vive el calendario completo), no un playoff. */
export async function resolveFcpMainGroup(
  sb: SupabaseClient,
  idEquipo: number
): Promise<{ idGrupo: string; equipo: string } | null> {
  const { data, error } = await sb
    .from("fcp_clasificacion")
    .select("id_grupo, equipo")
    .eq("id_equipo", idEquipo);
  if (error) throw error;
  const rows = (data ?? []) as { id_grupo: string; equipo: string }[];
  if (rows.length === 0) return null;
  if (rows.length === 1) return { idGrupo: rows[0].id_grupo, equipo: rows[0].equipo };
  let best = rows[0];
  let bestCount = -1;
  for (const r of rows) {
    const { count } = await sb
      .from("fcp_partidos")
      .select("id_partido", { count: "exact", head: true })
      .eq("id_grupo", r.id_grupo);
    if ((count ?? 0) > bestCount) {
      bestCount = count ?? 0;
      best = r;
    }
  }
  return { idGrupo: best.id_grupo, equipo: best.equipo };
}

export async function fetchFcpTeamProfile(
  sb: SupabaseClient,
  idEquipo: number
): Promise<FcpTeamProfile | null> {
  const main = await resolveFcpMainGroup(sb, idEquipo);
  // Sin clasificación no tiene por qué ser un equipo desconocido: puede estar
  // apuntado a la temporada que viene, que aún no tiene sorteo ni calendario.
  if (!main) return fetchFcpPreseasonTeam(sb, idEquipo);
  const [{ data: cls }, { data: partidos }, { data: g }, { data: jug }] =
    await Promise.all([
      sb
        .from("fcp_clasificacion")
        .select("posicion, puntos, sets_favor, sets_contra")
        .eq("id_equipo", idEquipo)
        .eq("id_grupo", main.idGrupo)
        .maybeSingle(),
      sb
        .from("fcp_partidos")
        .select("equipo_local, equipo_visit, ganador, estado, jornada")
        .eq("id_grupo", main.idGrupo)
        .order("jornada", { ascending: true }),
      sb.from("fcp_grupos").select("nombre").eq("id_grupo", main.idGrupo).maybeSingle(),
      sb
        .from("fcp_jugadores")
        .select("id_jugador, nombre_pila, apellido1, apellido2, nombre, puntos, categoria")
        .eq("id_equipo", idEquipo)
        .order("puntos", { ascending: false, nullsFirst: false }),
    ]);

  // PJ/PG/PP/racha del propio equipo, en orden cronológico.
  let pj = 0;
  let pg = 0;
  let pp = 0;
  const form: ("V" | "D")[] = [];
  for (const p of (partidos ?? []) as (FcpPartidoLite & { jornada: number | null })[]) {
    if (p.estado !== "jugado") continue;
    const isLocal = p.equipo_local === main.equipo;
    const isVisit = p.equipo_visit === main.equipo;
    if (!isLocal && !isVisit) continue;
    pj += 1;
    const won =
      (p.ganador === "local" && isLocal) || (p.ganador === "visitante" && isVisit);
    const decided = p.ganador === "local" || p.ganador === "visitante";
    if (won) pg += 1;
    else if (decided) pp += 1;
    if (decided) form.push(won ? "V" : "D");
  }

  const c = cls as
    | { posicion: number | null; puntos: number | null; sets_favor: number | null; sets_contra: number | null }
    | null;
  const roster: FcpRosterPlayer[] = ((jug ?? []) as FcpJugadorRow[]).map((r) => ({
    idJugador: r.id_jugador,
    name: fcpDisplayName(r),
    puntos: r.puntos ?? 0,
    categoria: r.categoria ?? null,
    avatarUrl: null,
  }));

  return {
    idEquipo,
    equipo: main.equipo,
    grupo: (g as { nombre: string | null } | null)?.nombre ?? null,
    idGrupo: main.idGrupo,
    posicion: c?.posicion ?? null,
    puntos: c?.puntos ?? 0,
    pj,
    pg,
    pp,
    setsFavor: c?.sets_favor ?? 0,
    setsContra: c?.sets_contra ?? 0,
    form,
    preseason: null,
    roster,
  };
}
