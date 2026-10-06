/**
 * Datos del bloque Liga y Federación que no estaban en `lib/queries.ts`:
 * «lo tuyo» en Federación (tu equipo y su puesto, los del club, lo que
 * sigues), el histórico de puntos de un jugador partido a partido y la
 * federación de tu equipo o club. Todo lectura, con las mismas tablas que la
 * app; nada de servidor nuevo.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  catShort,
  fcpSameTeam,
  fetchFcpGroupHeader,
  fetchFcpMatches,
  fetchFcpStandings,
  fetchTeamFcpGroup,
  fetchTeamFcpId,
} from "@/lib/queries";
import { legendFor, type FcpZone } from "@/lib/fcp-zones";
import { fetchTeamPro } from "@/lib/account-queries";
import type { FcpMatch, FcpStanding } from "@/lib/fcp-public";

/* ── Puesto de un equipo TACTIUM en la Federación ─────────────────── */

export interface TeamStanding {
  /** id federativo del vínculo (null: equipo no vinculado). */
  fcpId: number | null;
  idGrupo: string | null;
  grupo: string | null;
  rows: FcpStanding[];
  me: FcpStanding | null;
  zone: FcpZone | null;
  zones: FcpZone[] | null;
  /** La tabla es la de la temporada ANTERIOR: el vínculo apunta a una
   *  inscripción y la nueva aún no tiene grupos. Quien la enseñe tiene que
   *  decirlo (solo con `withPrevious`). */
  previous: boolean;
  /** «2025/2026», o null. */
  temporada: string | null;
  /** Próximo partido de tu equipo en el grupo (solo con `withPrevious` y
   *  si la tabla es de la temporada en juego). */
  nextMatch: FcpMatch | null;
  /** Todos los partidos del grupo jugados: clasificación final. */
  finished: boolean;
}

const EMPTY: TeamStanding = {
  fcpId: null,
  idGrupo: null,
  grupo: null,
  rows: [],
  me: null,
  zone: null,
  zones: null,
  previous: false,
  temporada: null,
  nextMatch: null,
  finished: false,
};

const cache = new Map<string, { at: number; v: TeamStanding }>();
const TTL = 5 * 60_000;

/** «2025-26» / «2026» → «2025/2026». Copia de `seasonLabel` de la app
 *  (`TACTIUM/src/core/services/fcpBrowse.ts`). */
function seasonLabel(temporada: string | null | undefined): string | null {
  const t = (temporada ?? "").trim();
  if (!t) return null;
  const rango = t.match(/^(\d{4})\s*[/-]\s*(\d{2,4})$/);
  if (rango) return `${rango[1]}/${rango[2].length === 2 ? `20${rango[2]}` : rango[2]}`;
  const anio = t.match(/^(\d{4})$/);
  if (anio) return `${Number(anio[1]) - 1}/${anio[1]}`;
  return t;
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * El mismo equipo en la última temporada que SÍ tiene clasificación, cuando
 * el vínculo apunta a una INSCRIPCIÓN (la liga que viene trae equipos meses
 * antes que grupos). Cruce por NOMBRE + GÉNERO: el `id_equipo` cambia cada
 * temporada. Copia de `idEquipoTemporadaAnterior` de la app
 * (`TACTIUM/src/core/services/fcpSeason.ts`).
 */
async function idEquipoTemporadaAnterior(
  fcpIdEquipo: number,
): Promise<{ idEquipo: number; idGrupo: string } | null> {
  const sb = supabaseBrowser();
  const { data: ins } = await sb
    .from("fcp_inscripciones")
    .select("equipo, genero")
    .eq("id_equipo", fcpIdEquipo)
    .limit(1);
  const insc = ((ins ?? []) as { equipo: string | null; genero: string | null }[])[0];
  const nombre = (insc?.equipo ?? "").trim();
  if (!nombre) return null;
  const esFem = (insc?.genero ?? "").toUpperCase().startsWith("F");

  const { data: cl } = await sb
    .from("fcp_clasificacion")
    .select("id_equipo, equipo, id_grupo")
    .ilike("equipo", nombre)
    .limit(500);
  const rows = ((cl ?? []) as {
    id_equipo: number | null;
    equipo: string | null;
    id_grupo: string | null;
  }[]).filter(
    (r) =>
      r.id_equipo != null &&
      r.id_grupo &&
      !/^fase/i.test(r.id_grupo) &&
      norm(r.equipo) === norm(nombre),
  );
  if (rows.length === 0) return null;

  const { data: gr } = await sb
    .from("fcp_grupos")
    .select("id_grupo, id_liga, genero")
    .in("id_grupo", [...new Set(rows.map((r) => r.id_grupo as string))]);
  const gById = new Map(
    ((gr ?? []) as { id_grupo: string; id_liga: number | null; genero: string | null }[]).map(
      (g) => [g.id_grupo, g],
    ),
  );
  let best: { idEquipo: number; idGrupo: string; liga: number } | null = null;
  for (const r of rows) {
    const g = gById.get(r.id_grupo as string);
    if (!g || g.id_liga == null) continue;
    // El género separa homónimos: «MEDIO CUDEYO A» existe en las dos.
    if ((g.genero ?? "").toUpperCase().startsWith("F") !== esFem) continue;
    if (!best || g.id_liga > best.liga) {
      best = { idEquipo: r.id_equipo as number, idGrupo: r.id_grupo as string, liga: g.id_liga };
    }
  }
  return best ? { idEquipo: best.idEquipo, idGrupo: best.idGrupo } : null;
}

/**
 * Puesto de un equipo TACTIUM en su grupo federativo.
 *
 * Con `withPrevious` se comporta como `resolveMainGroupOrPrevious` +
 * `fetchFcpGroupStandings` de la app: si el vínculo apunta a una
 * inscripción sin grupos, cae a la clasificación de la temporada anterior
 * (`previous: true`), y trae también el próximo partido. Sin la opción, el
 * comportamiento de siempre (lo usan Competir y la temporada).
 */
export async function fetchTeamStanding(
  teamId: string,
  opts: { withPrevious?: boolean } = {},
): Promise<TeamStanding> {
  const key = `${teamId}:${opts.withPrevious ? "p" : ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const fcpId = await fetchTeamFcpId(teamId);
  if (fcpId == null) return EMPTY;
  let g = await fetchTeamFcpGroup(teamId);
  // Con quién se compara «tu fila»: el id de la temporada de la tabla, que
  // NO es el del vínculo cuando se tira de la anterior.
  let myId = fcpId;
  let previous = false;
  if (!g && opts.withPrevious) {
    const prev = await idEquipoTemporadaAnterior(fcpId).catch(() => null);
    if (prev) {
      g = { fed: "FCantP", idGrupo: prev.idGrupo };
      myId = prev.idEquipo;
      previous = true;
    }
  }
  if (!g) {
    // Vinculado pero sin grupo: temporada en inscripción (sin sorteo).
    const v = { ...EMPTY, fcpId };
    cache.set(key, { at: Date.now(), v });
    return v;
  }
  const [rows, header, matches] = await Promise.all([
    fetchFcpStandings(g.idGrupo),
    fetchFcpGroupHeader(g.idGrupo).catch(() => null),
    opts.withPrevious ? fetchFcpMatches(g.idGrupo).catch(() => [] as FcpMatch[]) : Promise.resolve(null),
  ]);
  const me = rows.find((r) => Number(r.idEquipo) === myId) ?? null;
  const finished =
    !!matches && matches.length > 0 && matches.every((m) => m.estado === "jugado");
  const nextMatch =
    matches && me && !previous
      ? (matches
          .filter(
            (m) =>
              m.estado !== "jugado" &&
              !m.resultado &&
              (fcpSameTeam(m.local, me.equipo) || fcpSameTeam(m.visitante, me.equipo)),
          )
          .sort((a, b) => (a.jornada ?? 999) - (b.jornada ?? 999))[0] ?? null)
      : null;
  const zones = /^fase/i.test(g.idGrupo) || /ORO|PLATA|PLAY\s*OFF/i.test(header?.nombre ?? "")
    ? null
    : legendFor("FCantP", header?.genero ?? null, catShort(header?.nombre ?? ""));
  const zone = me && zones ? zones.find((z) => me.posicion >= z.from && me.posicion <= z.to) ?? null : null;
  const v: TeamStanding = {
    fcpId,
    idGrupo: g.idGrupo,
    grupo: header?.nombre ?? null,
    rows,
    me,
    zone,
    zones,
    previous,
    temporada: seasonLabel(header?.temporada),
    nextMatch,
    finished,
  };
  cache.set(key, { at: Date.now(), v });
  return v;
}

/* ── «Tu grupo de la Federación» es Pro ───────────────────────────────
   Misma regla que el gate de la app (`hasPremiumAccess`): al jugador no se
   le bloquea nunca; al capitán, según el EQUIPO (sub del club con el equipo
   cubierto, o la del dueño si es independiente). El explorador público de
   /federacion NO pasa por aquí. `true` = puede entrar; ante la duda (null de
   `fetchTeamPro`) no se bloquea. */
export async function fetchFcpGroupUnlocked(teamId: string, isManager: boolean): Promise<boolean> {
  if (!isManager) return true;
  return (await fetchTeamPro(teamId).catch(() => null)) !== false;
}

/* ── Volcar la temporada anterior: aviso, no volcado ──────────────────
   Copia de `isAlreadyInHistoryError` / `previousSeasonImportNotice` de la
   app (`src/core/services/fcpSeason.ts`). */

/** El RPC `import_fcp_season` ya no duplica una temporada del histórico:
 *  lanza «Esa temporada ya está en tu histórico (…)». Es un aviso, no un
 *  fallo. Ver la migración `20261006b_import_fcp_season_no_duplica_historico`. */
export function isAlreadyInHistoryError(message: string | null | undefined): boolean {
  return (message ?? "").includes("ya está en tu histórico");
}

/** Temporada («2026/2027») de la INSCRIPCIÓN a la que apunta un id, o null. */
async function temporadaDeInscripcion(fcpIdEquipo: number): Promise<string | null> {
  const sb = supabaseBrowser();
  const { data: ins } = await sb
    .from("fcp_inscripciones")
    .select("id_liga")
    .eq("id_equipo", fcpIdEquipo)
    .limit(1);
  const idLiga = ((ins ?? []) as { id_liga: number | null }[])[0]?.id_liga ?? null;
  if (idLiga == null) return null;
  const { data: l } = await sb
    .from("fcp_ligas")
    .select("temporada")
    .eq("id_liga", idLiga)
    .maybeSingle();
  return seasonLabel((l as { temporada: string | null } | null)?.temporada);
}

/**
 * Aviso para «Traer de la Federación» cuando lo único publicado es la
 * temporada ANTERIOR (`previous`): el vínculo apunta a la inscripción de la
 * que viene, que aún no tiene grupos. Volcarla duplicaría la del histórico.
 */
export async function previousSeasonImportNotice(
  teamId: string,
  st: Pick<TeamStanding, "fcpId" | "idGrupo" | "temporada" | "finished">,
): Promise<{ title: string; body: string }> {
  const sb = supabaseBrowser();
  const [nueva, enHistorico] = await Promise.all([
    st.fcpId != null ? temporadaDeInscripcion(st.fcpId).catch(() => null) : null,
    st.idGrupo
      ? Promise.resolve(
          sb
            .from("seasons")
            .select("id")
            .eq("team_id", teamId)
            .eq("fcp_id_grupo", st.idGrupo)
            .eq("active", false)
            .limit(1),
        )
          .then(({ data }) => ((data ?? []) as unknown[]).length > 0)
          .catch(() => false)
      : false,
  ]);
  const nuevaTxt = nueva ? `temporada ${nueva}` : "temporada nueva";
  const anteriorTxt = st.temporada ? `temporada ${st.temporada}` : "temporada anterior";
  const cola = [st.finished ? "que ya terminó" : null, enHistorico ? "ya la tienes en el histórico" : null]
    .filter(Boolean)
    .join(" y ");
  return {
    title: "Aún no hay temporada nueva",
    body:
      `La Federación aún no ha publicado el calendario de la ${nuevaTxt}. ` +
      `Lo que hay es la ${anteriorTxt}${cola ? `, ${cola}` : ""}.`,
  };
}

/**
 * Fecha de la Federación en formato humano: «2026-05-23» → «sáb 23 may».
 * Con otro año que el actual, lo añade («sáb 23 may 2025»). Lo que no sea
 * una fecha ISO se devuelve tal cual.
 */
export function fmtFcpDate(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return v;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d
    .toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    })
    .replace(/\./g, "")
    .replace(/,/g, "");
}

/** «2ª Categoría Masculina - Grupo B» → «2ª Masc · Grupo B». */
export function shortGroupName(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const cat = nombre.match(/(\d+)\s*ª/);
  const gen = /FEM/i.test(nombre) ? "Fem" : /MASC/i.test(nombre) ? "Masc" : "";
  const grp = nombre.match(/GRUPO\s+([\wÁÉÍÓÚÑ]+)/i);
  const parts = [
    [cat ? `${cat[1]}ª` : "", gen].filter(Boolean).join(" "),
    grp ? `Grupo ${grp[1].toUpperCase()}` : /ÚNICO|UNICO/i.test(nombre) ? "Grupo único" : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : nombre;
}

/* ── Federación de tu equipo o tu club ────────────────────────────── */

/** Código de federación (`teams.federation` / `clubs.federation`), o null. */
export async function fetchMyFederation(opts: {
  teamId?: string | null;
  clubId?: string | null;
}): Promise<string | null> {
  const sb = supabaseBrowser();
  if (opts.clubId) {
    const { data } = await sb.from("clubs").select("federation").eq("id", opts.clubId).maybeSingle();
    return ((data as { federation: string | null } | null)?.federation ?? null) || null;
  }
  if (opts.teamId) {
    const { data } = await sb.from("teams").select("federation").eq("id", opts.teamId).maybeSingle();
    return ((data as { federation: string | null } | null)?.federation ?? null) || null;
  }
  return null;
}

/** Equipos de un club (para «Tus equipos en la Federación»). */
export async function fetchClubTeamsLite(clubId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await supabaseBrowser()
    .from("teams")
    .select("id, name")
    .eq("club_id", clubId)
    .order("name");
  return ((data ?? []) as { id: string; name: string }[]).slice(0, 12);
}

/* ── Lo que sigues (☆ de la app) ──────────────────────────────────── */

export interface FollowItem {
  kind: "team" | "player";
  refId: string;
  label: string;
  meta: string | null;
}

/** Favoritos de equipos y jugadores de la cuenta. La RLS acota a los tuyos. */
export async function fetchMyFollows(): Promise<FollowItem[]> {
  const { data, error } = await supabaseBrowser()
    .from("favorites")
    .select("kind, ref_id, label, meta, created_at")
    .in("kind", ["team", "player"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as { kind: string; ref_id: string; label: string | null; meta: string | null }[]).map(
    (r) => ({
      kind: r.kind as FollowItem["kind"],
      refId: r.ref_id,
      label: r.label ?? "—",
      meta: r.meta,
    }),
  );
}

/* ── Histórico de puntos de un jugador, partido a partido ─────────── */

export interface HistMatch {
  anio: number | null;
  jornada: number | null;
  fecha: string | null;
  gana: boolean;
  puntosVar: number | null;
  equipoRival: string | null;
  /** Compañero en ese partido. */
  pareja: string | null;
  esPlayoff: boolean;
}

/** Partidos del histórico federativo (`fcp_historico`), cronológicos. */
export async function fetchPlayerHistMatches(idJugador: string): Promise<HistMatch[]> {
  const sb = supabaseBrowser();
  const { data: jRaw } = await sb
    .from("fcp_jugadores")
    .select("nombre_pila, apellido1, apellido2")
    .eq("id_jugador", idJugador)
    .maybeSingle();
  const j = jRaw as { nombre_pila: string | null; apellido1: string | null; apellido2: string | null } | null;
  if (!j) return [];
  const full = [j.nombre_pila, j.apellido1, j.apellido2].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  if (!full) return [];
  const { data: rk } = await sb
    .from("fcp_rankings")
    .select("id_fcp")
    .not("id_fcp", "is", null)
    .ilike("nombre", full)
    .limit(1)
    .maybeSingle();
  const idFcp = (rk as { id_fcp: number } | null)?.id_fcp ?? null;
  if (idFcp == null) return [];
  const { data: rows } = await sb
    .from("fcp_historico")
    .select("anio, jornada, fecha, categoria, gana, puntos_var, equipo_rival, pareja, rivales, resultado")
    .eq("id_fcp", idFcp)
    .order("seq", { ascending: true });
  const seen = new Set<string>();
  const out: HistMatch[] = [];
  for (const r of (rows ?? []) as {
    anio: number | null;
    jornada: string | null;
    fecha: string | null;
    categoria: string | null;
    gana: boolean | null;
    puntos_var: number | null;
    equipo_rival: string | null;
    pareja: string | null;
    rivales: string | null;
    resultado: string | null;
  }[]) {
    // La web de la FCP a veces repite partidos: fuera duplicados.
    const k = [r.jornada, r.fecha, r.categoria, r.equipo_rival, r.rivales, r.resultado, r.gana].join("|");
    if (seen.has(k)) continue;
    seen.add(k);
    const n = Number((r.jornada ?? "").match(/\d+/)?.[0]);
    out.push({
      anio: r.anio,
      jornada: Number.isFinite(n) ? n : null,
      fecha: r.fecha,
      gana: !!r.gana,
      puntosVar: r.puntos_var == null ? null : Number(r.puntos_var),
      equipoRival: r.equipo_rival,
      pareja: r.pareja,
      esPlayoff: /\d+º\s*(al\b|-)/i.test(r.categoria ?? "") || /\b(ORO|PLATA)\b/i.test(r.categoria ?? ""),
    });
  }
  return out;
}

/* ── Cuadro de playoff de tu equipo ───────────────────────────────── */

const normTeam = (s: string | null | undefined) =>
  (s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Primer grupo de playoff (fase 2+) en el que juega tu equipo, o null.
 *  Igual que `fetchTeamPlayoff` de la app: por la liga del grupo regular y
 *  el nombre federativo del equipo. */
export async function fetchTeamPlayoffGroup(
  standing: TeamStanding,
): Promise<{ idGrupo: string; nombre: string } | null> {
  if (!standing.idGrupo || !standing.me) return null;
  const sb = supabaseBrowser();
  const { data: g } = await sb
    .from("fcp_grupos")
    .select("id_liga, genero")
    .eq("id_grupo", standing.idGrupo)
    .maybeSingle();
  const gi = g as { id_liga: number | null; genero: string | null } | null;
  if (gi?.id_liga == null) return null;
  const { data } = await sb
    .from("fcp_partidos")
    .select("id_grupo, equipo_local, equipo_visit")
    .like("id_partido", `fcp_playoff_${gi.id_liga}_%`);
  const tn = normTeam(standing.me.equipo);
  const ids = new Set<string>();
  for (const r of (data ?? []) as { id_grupo: string; equipo_local: string | null; equipo_visit: string | null }[]) {
    if (normTeam(r.equipo_local) === tn || normTeam(r.equipo_visit) === tn) ids.add(r.id_grupo);
  }
  if (ids.size === 0) return null;
  let q = sb.from("fcp_grupos").select("id_grupo, nombre").in("id_grupo", [...ids]);
  if (gi.genero) q = q.eq("genero", gi.genero);
  const { data: grupos } = await q;
  const first = ((grupos ?? []) as { id_grupo: string; nombre: string | null }[])[0];
  return first ? { idGrupo: first.id_grupo, nombre: first.nombre ?? first.id_grupo } : null;
}
