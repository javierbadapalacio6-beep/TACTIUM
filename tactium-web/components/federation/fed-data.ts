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
  fetchFcpGroupHeader,
  fetchFcpStandings,
  fetchTeamFcpGroup,
  fetchTeamFcpId,
} from "@/lib/queries";
import { legendFor, type FcpZone } from "@/lib/fcp-zones";
import type { FcpStanding } from "@/lib/fcp-public";

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
}

const EMPTY: TeamStanding = {
  fcpId: null,
  idGrupo: null,
  grupo: null,
  rows: [],
  me: null,
  zone: null,
  zones: null,
};

const cache = new Map<string, { at: number; v: TeamStanding }>();
const TTL = 5 * 60_000;

export async function fetchTeamStanding(teamId: string): Promise<TeamStanding> {
  const hit = cache.get(teamId);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const fcpId = await fetchTeamFcpId(teamId);
  if (fcpId == null) return EMPTY;
  const g = await fetchTeamFcpGroup(teamId);
  if (!g) {
    // Vinculado pero sin grupo: temporada en inscripción (sin sorteo).
    const v = { ...EMPTY, fcpId };
    cache.set(teamId, { at: Date.now(), v });
    return v;
  }
  const [rows, header] = await Promise.all([
    fetchFcpStandings(g.idGrupo),
    fetchFcpGroupHeader(g.idGrupo).catch(() => null),
  ]);
  const me = rows.find((r) => Number(r.idEquipo) === fcpId) ?? null;
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
  };
  cache.set(teamId, { at: Date.now(), v });
  return v;
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
