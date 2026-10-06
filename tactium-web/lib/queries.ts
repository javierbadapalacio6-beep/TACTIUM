"use client";

import { supabaseBrowser } from "./supabase/client";
import { guardedWrite, type WriteResult } from "./writes";
import type { Position } from "./team-data";
import { FCP_FEDERATION_CODE } from "./federations";
import { fetchClubInscripciones, fetchInscripcionGrupo } from "./club-ops";
import type { FcpSeasonEstado } from "./fcp-season-diff";
import {
  fcpDisplayName,
  fcpTeamKey,
  findLastFcpMeeting,
  type FcpMeeting,
  fetchFcpGroupHeader as fetchFcpGroupHeaderWith,
  fetchFcpMatches as fetchFcpMatchesWith,
  fetchFcpRoster as fetchFcpRosterWith,
  fetchFcpStandings as fetchFcpStandingsWith,
  fetchFcpTeamProfile as fetchFcpTeamProfileWith,
  type FcpGroupHeader,
  type FcpMatch,
  type FcpRosterPlayer,
  type FcpStanding,
  type FcpTeamProfile,
  type FcpRival,
} from "./fcp-public";
export type {
  FcpGroupHeader,
  FcpMatch,
  FcpMeeting,
  FcpPreseason,
  FcpRival,
  FcpRosterPlayer,
  FcpStanding,
  FcpTeamProfile,
} from "./fcp-public";

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
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("players")
    .select("id, name, alias, pts, position, active, available, user_id, photo_url")
    .eq("team_id", teamId)
    .order("pts", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];

  // La foto que el jugador subió a SU cuenta vale para el equipo y el club
  // sin que nadie la suba otra vez: si el jugador está vinculado, se mezcla
  // el avatar de `profiles` (la RLS `profiles_teammate_select` deja leerlo al
  // capitán y al club). La foto puesta a mano en la ficha manda si existe.
  // Mismo criterio que `fetchPlayers` en la app.
  const userIds = [...new Set(rows.map((p) => p.user_id).filter((u): u is string => !!u))];
  const avatarByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, avatar_url")
      .in("id", userIds);
    for (const pr of (profiles ?? []) as { id: string; avatar_url: string | null }[]) {
      avatarByUser.set(pr.id, pr.avatar_url);
    }
  }

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    alias: p.alias,
    pts: p.pts ?? 0,
    position: (p.position ?? "Ambos") as Position,
    active: p.active ?? true,
    available: p.available,
    userId: p.user_id,
    photoUrl: p.photo_url ?? (p.user_id ? (avatarByUser.get(p.user_id) ?? null) : null),
  }));
}

/* ── Escrituras de plantilla (players) ──────────────────────────── */
export async function createPlayer(
  teamId: string,
  input: { name: string; pts: number; position: string },
): Promise<void> {
  const { error } = await supabaseBrowser().from("players").insert({
    team_id: teamId,
    name: input.name,
    pts: input.pts,
    position: input.position,
  });
  if (error) throw error;
}

export async function updatePlayer(
  id: string,
  patch: {
    name?: string;
    pts?: number;
    position?: string;
    active?: boolean;
    alias?: string | null;
  },
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("players")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("players").delete().eq("id", id);
  if (error) throw error;
}

/* ── Alta de club / equipo (onboarding) ─────────────────────────── */
export async function createClub(
  name: string,
  federation?: string | null,
  opts?: {
    /** Espacio de organizador: un club «solo torneos», sin equipos ni cuota. */
    tournamentsOnly?: boolean;
  },
): Promise<string> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");
  const { data, error } = await sb
    .from("clubs")
    .insert({
      owner_id: user.id,
      name,
      federation: federation ?? null,
      ...(opts?.tournamentsOnly ? { tournaments_only: true } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Canjea un código de invitación para unirse a un equipo (RPC). */
export async function redeemInvitation(code: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("redeem_team_invitation", {
    invitation_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
}

export interface DbInvitation {
  id: string;
  code: string;
  role: string;
  used_at: string | null;
  expires_at: string;
}

/** Invitaciones de un equipo (RLS: solo admin del equipo las ve). */
export async function fetchTeamInvitations(
  teamId: string,
): Promise<DbInvitation[]> {
  const { data, error } = await supabaseBrowser()
    .from("team_invitations")
    .select("id, code, role, used_at, expires_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DbInvitation[]) ?? [];
}

/** Crea una invitación; la BD genera el código y valida is_team_admin. */
export async function createInvitation(
  teamId: string,
  role: "captain" | "player" = "player",
): Promise<DbInvitation> {
  const { data, error } = await supabaseBrowser().rpc("create_team_invitation", {
    target_team: teamId,
    target_role: role,
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo crear la invitación");
  return data as DbInvitation;
}

/**
 * Código de jugador nuevo: borra el compartido de siempre y devuelve otro.
 * Quien ya canjeó el anterior sigue en el equipo. Mismo RPC que la app
 * (`rotatePlayerCode`); la BD valida is_team_admin.
 */
export async function rotatePlayerCode(teamId: string): Promise<DbInvitation> {
  const { data, error } = await supabaseBrowser().rpc("rotate_team_player_code", {
    target_team: teamId,
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo generar el código");
  return data as DbInvitation;
}

export function invitationActive(inv: DbInvitation): boolean {
  return inv.used_at === null && new Date(inv.expires_at) > new Date();
}

/* ── Vista previa de una invitación (RPC, también sin sesión) ───── */
export interface InvitationPreviewPlayer {
  id: string;
  name: string;
  position: string | null;
  pts: number | null;
  claimed: boolean;
}

export type InvitationPreview =
  | { valid: false; reason: "not_found" | "used" | "expired" }
  | {
      valid: true;
      role: "player" | "captain";
      team: {
        id: string;
        name: string;
        logo_url: string | null;
        league: string | null;
        category: string | null;
        group_name: string | null;
        federation: string | null;
      };
      club_name: string | null;
      captain_name: string | null;
      players_count: number;
      next_matchday: {
        jornada: number | null;
        date: string | null;
        opponent: string | null;
      } | null;
      roster: InvitationPreviewPlayer[];
    };

/**
 * Lo público de un equipo a partir de un código de invitación: no une a
 * nadie ni escribe nada. Funciona con y sin sesión (RPC `SECURITY DEFINER`
 * concedida a `anon`).
 */
export async function previewInvitation(code: string): Promise<InvitationPreview> {
  const { data, error } = await supabaseBrowser().rpc("preview_team_invitation", {
    p_code: code.replace(/\s+/g, "").toUpperCase(),
  });
  if (error) throw error;
  const d = (data ?? { valid: false, reason: "not_found" }) as InvitationPreview;
  if (!d.valid) return d;
  return {
    ...d,
    players_count: Number(d.players_count) || 0,
    roster: Array.isArray(d.roster) ? d.roster : [],
  };
}

/**
 * Canjea el código y, si el invitado eligió su ficha, le vincula a ella.
 * «Ya estás vinculado a otro jugador del equipo» no es un fallo: ya tiene
 * ficha. Si la vinculación falla por otra cosa, la unión YA está hecha y se
 * devuelve el motivo para avisar sin deshacer nada.
 */
export async function joinTeamWithInvite(
  code: string,
  playerId: string | null,
): Promise<{ claimError: string | null }> {
  await redeemInvitation(code);
  if (!playerId) return { claimError: null };
  try {
    await claimPlayer(playerId);
    return { claimError: null };
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "No se pudo vincular la ficha";
    if (/ya est[aá]s vinculado/i.test(msg)) return { claimError: null };
    return { claimError: msg };
  }
}

/* ── Prueba gratis de 14 días sin tarjeta (RPC) ─────────────────── */
/**
 * Arranca la suscripción de prueba (`trialing`, 14 días, sin tienda). Es
 * idempotente por sujeto: si ya tiene una, la BD no crea otra.
 */
export async function startSubscriptionTrial(
  subjectType: "user" | "club",
  subjectId: string,
  planTier: string,
): Promise<void> {
  const { error } = await supabaseBrowser().rpc("start_subscription_trial", {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_plan_tier: planTier,
  });
  if (error) throw error;
}

export interface DbTrialSubscription {
  planTier: string;
  subjectType: string;
  subjectId: string;
  currentPeriodEnd: string;
}

/**
 * La prueba gratuita EN CURSO del pagador indicado (la de BD: `trialing` con
 * `product_id` `trial_*`, no la de una tienda). null si no hay.
 */
export async function fetchTrialSubscription(
  subjectType: "user" | "club",
  subjectId: string,
): Promise<DbTrialSubscription | null> {
  const { data, error } = await supabaseBrowser()
    .from("subscriptions")
    .select("plan_tier, subject_type, subject_id, product_id, current_period_end")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .eq("status", "trialing")
    .like("product_id", "trial_%")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    planTier: data.plan_tier,
    subjectType: data.subject_type,
    subjectId: data.subject_id,
    currentPeriodEnd: data.current_period_end,
  };
}

/**
 * ¿Este pagador ha tenido ALGUNA VEZ la prueba sin tarjeta (`trial_*`), en
 * curso o ya gastada? Es el mismo criterio con el que el checkout decide si
 * da otra prueba de Stripe (no la da) o cobra desde el primer día.
 */
export async function fetchHadTrial(
  subjectType: "user" | "club",
  subjectId: string,
): Promise<boolean> {
  const { count, error } = await supabaseBrowser()
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .like("product_id", "trial_%");
  if (error) throw error;
  return (count ?? 0) > 0;
}

/* ── Vinculación usuario ↔ jugador de plantilla (claim) ──────────── */
export interface DbClaimablePlayer {
  id: string;
  name: string;
  pts: number | null;
  position: string | null;
  user_id: string | null;
}

/** El jugador de la plantilla vinculado al usuario, o null. */
export async function fetchMyPlayer(
  teamId: string,
  userId: string,
): Promise<DbClaimablePlayer | null> {
  const { data, error } = await supabaseBrowser()
    .from("players")
    .select("id, name, pts, position, user_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as DbClaimablePlayer | null) ?? null;
}

/** Jugadores de la plantilla aún sin usuario asociado (para "¿cuál eres tú?"). */
export async function listUnclaimedPlayers(
  teamId: string,
): Promise<DbClaimablePlayer[]> {
  const { data, error } = await supabaseBrowser().rpc("list_unclaimed_players", {
    p_team_id: teamId,
  });
  if (error) throw error;
  return (data as DbClaimablePlayer[]) ?? [];
}

/** Vincula al usuario autenticado con la ficha de jugador indicada. */
export async function claimPlayer(playerId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("claim_player", {
    p_player_id: playerId,
  });
  if (error) throw error;
}

/** Desvincula al usuario de su ficha de jugador actual. */
export async function unclaimPlayer(playerId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("unclaim_player", {
    p_player_id: playerId,
  });
  if (error) throw error;
}

export async function createTeam(input: {
  name: string;
  gender?: string;
  federation?: string | null;
  league?: string | null;
  category?: string | null;
  group?: string | null;
  clubId?: string | null;
  /** Equipo INVITADO: juega en las pistas de este club sin ser suyo. Da
   *  permiso de horario y nada más, y NO consume cuota del plan. Excluyente
   *  con `clubId`: si fuera del club, sería del club. */
  venueClubId?: string | null;
}): Promise<string> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");
  const { data, error } = await sb
    .from("teams")
    .insert({
      owner_id: user.id,
      name: input.name,
      gender: input.gender ?? "masculino",
      federation: input.federation || null,
      league: input.league || null,
      category: input.category || null,
      group_name: input.group || null,
      club_id: input.clubId ?? null,
      venue_club_id: input.venueClubId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Lee la configuración editable de un equipo (para el formulario de edición). */
export async function fetchTeam(id: string): Promise<{
  id: string;
  name: string;
  category: string | null;
  group_name: string | null;
  gender: string | null;
  federation: string | null;
  league: string | null;
  logo_url: string | null;
} | null> {
  const { data, error } = await supabaseBrowser()
    .from("teams")
    .select("id, name, category, group_name, gender, federation, league, logo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as {
    id: string;
    name: string;
    category: string | null;
    group_name: string | null;
    gender: string | null;
    federation: string | null;
    league: string | null;
    logo_url: string | null;
  } | null) ?? null;
}

/** Actualiza campos de un equipo (edición: categoría/grupo/nombre…). */
export async function updateTeam(
  id: string,
  patch: {
    name?: string;
    category?: string | null;
    group_name?: string | null;
    gender?: string;
    logo_url?: string | null;
  },
): Promise<void> {
  const { error } = await supabaseBrowser().from("teams").update(patch).eq("id", id);
  if (error) throw error;
}

/** Actualiza campos de un club (edición: nombre/federación). */
export async function updateClub(
  id: string,
  patch: {
    name?: string;
    federation?: string | null;
    logo_url?: string | null;
    tournaments_only?: boolean;
  },
): Promise<void> {
  const { error } = await supabaseBrowser().from("clubs").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Escudos de equipo y de club ───────────────────────────────── */
const LOGO_BUCKET = "logos";

/**
 * Sube el escudo al bucket público `logos` (`teams/<id>/…` o `clubs/<id>/…`;
 * las políticas exigen ser capitán/admin de ese equipo o club) y deja la URL
 * en `logo_url`. El timestamp va en el nombre para que el CDN no siga
 * sirviendo el logo viejo; los anteriores se borran.
 */
export async function uploadLogo(
  kind: "team" | "club",
  id: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo tiene que ser una imagen");
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error("El logo no puede pesar más de 3 MB");
  }
  const sb = supabaseBrowser();
  const folder = `${kind === "team" ? "teams" : "clubs"}/${id}`;
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const filename = `logo_${Date.now()}.${ext}`;
  const path = `${folder}/${filename}`;

  const { error: upErr } = await sb.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) throw upErr;

  try {
    const { data: files } = await sb.storage.from(LOGO_BUCKET).list(folder);
    const old = (files ?? []).filter((f) => f.name !== filename).map((f) => `${folder}/${f.name}`);
    if (old.length > 0) await sb.storage.from(LOGO_BUCKET).remove(old);
  } catch {
    /* basura en storage, no es motivo para fallar */
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(LOGO_BUCKET).getPublicUrl(path);

  if (kind === "team") await updateTeam(id, { logo_url: publicUrl });
  else await updateClub(id, { logo_url: publicUrl });
  return publicUrl;
}

/** Quita el escudo: borra los ficheros y limpia la columna. */
export async function deleteLogo(kind: "team" | "club", id: string): Promise<void> {
  const sb = supabaseBrowser();
  const folder = `${kind === "team" ? "teams" : "clubs"}/${id}`;
  const { data: files } = await sb.storage.from(LOGO_BUCKET).list(folder);
  if (files && files.length > 0) {
    await sb.storage.from(LOGO_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  }
  if (kind === "team") await updateTeam(id, { logo_url: null });
  else await updateClub(id, { logo_url: null });
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

/** Crea una temporada (insert en seasons). El trigger de BD cierra la activa
 *  anterior si procede. Pasa por `guardedWrite`. */
export async function createSeason(
  teamId: string,
  input: {
    name: string;
    phase: DbSeason["phase"];
    category?: string | null;
    totalMatchdays?: number | null;
  },
): Promise<void> {
  const { error } = await supabaseBrowser().from("seasons").insert({
    team_id: teamId,
    name: input.name,
    phase: input.phase,
    category: input.category ?? null,
    total_matchdays: input.totalMatchdays ?? null,
    active: true,
  });
  if (error) throw error;
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
  /** Parejas por turno horario, «N-N-N» (p. ej. «1-2»). null si la liga no
   *  usa tandas. Opcional para no obligar a quien construye jornadas a mano. */
  tandas?: string | null;
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
    tandas: (m.tandas as string) ?? null,
  };
}

const MATCHDAY_COLS =
  "id, season_id, jornada_number, match_date, match_time, opponent, is_home, status, outcome, location, score_for, score_against, photo_url, tandas";

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

/** Crea una jornada en una temporada (insert en matchdays). */
export async function createMatchday(
  seasonId: string,
  input: {
    jornada_number: number;
    opponent: string;
    match_date?: string | null;
    match_time?: string | null;
    is_home?: boolean;
    location?: string | null;
  },
): Promise<void> {
  const { error } = await supabaseBrowser().from("matchdays").insert({
    season_id: seasonId,
    jornada_number: input.jornada_number,
    opponent: input.opponent,
    match_date: input.match_date ?? null,
    match_time: input.match_time ?? null,
    is_home: input.is_home ?? true,
    location: input.location ?? null,
  });
  if (error) throw error;
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

/** Capitán/club marca la disponibilidad de un jugador (upsert directo). */
export async function setPlayerAvailability(
  matchdayId: string,
  playerId: string,
  available: boolean,
): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { error } = await sb.from("availability").upsert(
    {
      matchday_id: matchdayId,
      player_id: playerId,
      available,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "matchday_id,player_id" },
  );
  if (error) throw error;
}

/** Quita la marca de un jugador (vuelve a «sin marcar»). */
export async function clearPlayerAvailability(
  matchdayId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("availability")
    .delete()
    .eq("matchday_id", matchdayId)
    .eq("player_id", playerId);
  if (error) throw error;
}

/* ── Disponibilidad en un toque (Voy · Duda · No puedo) ─────────
 * Misma lógica que la app (TACTIUM/src/core/services/availability.ts):
 * fuente de verdad = tabla `availability` por jornada; sin fila = sin
 * contestar. La duda cierra 24 h antes del partido. */
export type AvailStatus = "yes" | "maybe" | "no";
export type MaybeReason = "trabajo" | "molestias" | "viaje" | "pendiente";

export const MAYBE_REASONS: { id: MaybeReason; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "molestias", label: "Molestias" },
  { id: "viaje", label: "Viaje" },
  { id: "pendiente", label: "Lo sé más tarde" },
];

export const STATUS_LABEL: Record<AvailStatus, string> = {
  yes: "Voy",
  maybe: "Duda",
  no: "No puedo",
};

export interface AvailRow {
  status: AvailStatus;
  reason: MaybeReason | null;
  note: string | null;
  autoResolved: boolean;
}

/** Respuestas de una jornada por player_id (con estado, motivo y nota). */
export async function fetchAvailabilityDetail(
  matchdayId: string,
): Promise<Record<string, AvailRow>> {
  // `select *`: antes de la migración no existe `status`; se deriva de `available`.
  const { data, error } = await supabaseBrowser()
    .from("availability")
    .select("*")
    .eq("matchday_id", matchdayId);
  if (error) throw error;
  const out: Record<string, AvailRow> = {};
  for (const a of (data ?? []) as Record<string, unknown>[]) {
    out[a.player_id as string] = {
      status: ((a.status as AvailStatus | undefined) ?? (a.available ? "yes" : "no")),
      reason: (a.reason as MaybeReason | null | undefined) ?? null,
      note: (a.note as string | null | undefined) ?? null,
      autoResolved: !!a.auto_resolved,
    };
  }
  return out;
}

/** Cierre de la duda (24 h antes del partido), o null. */
export async function fetchMaybeDeadline(matchdayId: string): Promise<Date | null> {
  const { data, error } = await supabaseBrowser().rpc("availability_maybe_deadline", {
    p_matchday_id: matchdayId,
  });
  if (error) return null;
  return data ? new Date(data as string) : null;
}

/** Responde por un jugador (él mismo, o el capitán por cualquiera). */
export async function respondAvailability(
  matchdayId: string,
  playerId: string,
  status: AvailStatus,
  reason?: MaybeReason | null,
  note?: string | null,
): Promise<void> {
  const { error } = await supabaseBrowser().rpc("respond_availability", {
    p_matchday_id: matchdayId,
    p_player_id: playerId,
    p_status: status,
    p_reason: reason ?? null,
    p_note: note ?? null,
  });
  if (error) throw error;
}

/** Último «Recordar ahora» de la jornada (bloqueo de 12 h). */
export async function fetchLastReminder(matchdayId: string): Promise<Date | null> {
  const { data, error } = await supabaseBrowser()
    .from("availability_reminders")
    .select("created_at")
    .eq("matchday_id", matchdayId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const row = (data as { created_at: string }[] | null)?.[0];
  return row ? new Date(row.created_at) : null;
}

export type RemindOutcome =
  | { ok: true; reminded: number; withoutApp: string[] }
  | { ok: false; kind: "premium" | "cooldown" | "other"; message: string };

/** Capitán (premium): push a pendientes y dudas. 1 vez / 12 h. */
export async function remindPendingAvailability(matchdayId: string): Promise<RemindOutcome> {
  const { data, error } = await supabaseBrowser().rpc("remind_pending_availability", {
    p_matchday_id: matchdayId,
  });
  if (error) {
    const hint = (error as { hint?: string }).hint ?? "";
    return {
      ok: false,
      kind: hint === "premium_required" ? "premium" : hint.startsWith("cooldown:") ? "cooldown" : "other",
      message: error.message,
    };
  }
  const d = data as { reminded: number; without_app: { name: string }[] };
  return { ok: true, reminded: d.reminded, withoutApp: (d.without_app ?? []).map((p) => p.name) };
}

/** Recuento por estado sobre los ids de la plantilla activa. */
export function countAvail(ids: string[], map: Record<string, AvailRow>) {
  const c = { yes: 0, maybe: 0, no: 0, pending: 0, total: ids.length };
  for (const id of ids) {
    const s = map[id]?.status;
    if (s) c[s] += 1;
    else c.pending += 1;
  }
  return c;
}

/** El propio jugador marca SU disponibilidad (RPC set_player_self_availability,
 *  que resuelve la jornada relevante en el servidor). */
export async function setSelfAvailability(
  playerId: string,
  available: boolean,
): Promise<void> {
  const { error } = await supabaseBrowser().rpc(
    "set_player_self_availability",
    { p_player_id: playerId, p_available: available },
  );
  if (error) throw error;
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

/** Cierra el acta de una jornada (RPC close_matchday). Calcula el resultado a
 *  partir de los match_results y bloquea la edición. Pasa por `guardedWrite`. */
export async function closeMatchday(matchdayId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("close_matchday", {
    target_matchday: matchdayId,
  });
  if (error) throw error;
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

/**
 * `id_equipo` federativo (FCP) vinculado a un equipo TACTIUM, o null. Es lo
 * que identifica a «tu equipo» en una clasificación: el nombre no sirve
 * (dos equipos pueden llamarse igual y el de la federación va en mayúsculas).
 */
export async function fetchTeamFcpId(teamId: string): Promise<number | null> {
  // El vínculo más reciente, sin `maybeSingle`: si un día hubiera dos filas
  // (pasó en la app), esto no tiene que reventar.
  const { data: links } = await supabaseBrowser()
    .from("fcp_team_links")
    .select("fcp_id_equipo")
    .eq("team_id", teamId)
    .order("linked_at", { ascending: false })
    .limit(1);
  return ((links ?? []) as { fcp_id_equipo: number }[])[0]?.fcp_id_equipo ?? null;
}

/**
 * Resuelve el grupo federativo (FCP) de un equipo, para enlazar «Mi grupo» a su
 * clasificación concreta en vez de al explorador general. Devuelve null si el
 * equipo no está vinculado a la Federación Cántabra.
 */
export async function fetchTeamFcpGroup(
  teamId: string,
): Promise<{ fed: string; idGrupo: string } | null> {
  const sb = supabaseBrowser();
  const fcpId = await fetchTeamFcpId(teamId);
  if (fcpId == null) return null;

  // La temporada actual (mayor id_liga), su liga regular (no playoff/fase).
  const { data: rows } = await sb
    .from("fcp_clasificacion")
    .select("id_grupo, id_liga")
    .eq("id_equipo", fcpId)
    .order("id_liga", { ascending: false });
  const row = ((rows ?? []) as { id_grupo: string | null }[]).find(
    (r) => r.id_grupo && !/^fase/i.test(r.id_grupo),
  );
  if (!row?.id_grupo) return null;
  return { fed: FCP_FEDERATION_CODE, idGrupo: row.id_grupo };
}

/**
 * Nombre federativo de un equipo por su `id_equipo` (el de la temporada más
 * reciente). El cuadro de playoff solo guarda NOMBRES, así que para resaltar
 * «tu equipo» por vínculo hay que pasar del id al nombre.
 */
export async function fetchFcpTeamNameById(
  fcpId: number,
  idGrupo?: string,
): Promise<string | null> {
  const { data } = await supabaseBrowser()
    .from("fcp_clasificacion")
    .select("equipo, id_grupo, id_liga")
    .eq("id_equipo", fcpId)
    .order("id_liga", { ascending: false });
  const rows = (data ?? []) as { equipo: string | null; id_grupo: string | null }[];
  // 1) En el propio grupo, si el id aparece; 2) si no (el playoff cambia de
  // id), el nombre en su liga principal (grupo regular, no «fase…»).
  const inGroup = idGrupo ? rows.find((r) => r.id_grupo === idGrupo) : undefined;
  const main = rows.find((r) => r.id_grupo && !/^fase/i.test(r.id_grupo));
  return (inGroup ?? main ?? rows[0])?.equipo ?? null;
}

/**
 * Contexto federativo de una jornada: puesto y racha de los dos equipos y su
 * último cruce en el grupo. Nuestro equipo se reconoce por el VÍNCULO
 * (fcp_team_links); el rival, por nombre normalizado, porque la jornada solo
 * guarda el texto del rival. Sin vínculo devuelve null y la pantalla pinta
 * la cabecera sin puesto ni racha.
 */
export interface MatchdayFcpContext {
  fed: string;
  idGrupo: string;
  us: FcpStanding | null;
  them: FcpStanding | null;
  lastMeeting: FcpMeeting | null;
}

export async function fetchMatchdayFcpContext(
  teamId: string,
  opponent: string,
  matchDate: string | null,
): Promise<MatchdayFcpContext | null> {
  const fcpId = await fetchTeamFcpId(teamId);
  if (fcpId == null) return null;
  const group = await fetchTeamFcpGroup(teamId);
  if (!group) return null;
  const [standings, matches] = await Promise.all([
    fetchFcpStandings(group.idGrupo),
    fetchFcpMatches(group.idGrupo),
  ]);
  const us = standings.find((s) => Number(s.idEquipo) === fcpId) ?? null;
  // Si nuestro id no está en la tabla (el grupo es de una temporada anterior),
  // ni racha ni puesto para nadie: compararíamos contra una tabla vieja.
  if (!us) return { fed: group.fed, idGrupo: group.idGrupo, us: null, them: null, lastMeeting: null };
  const key = fcpTeamKey(opponent);
  let them = standings.find((s) => fcpTeamKey(s.equipo) === key) ?? null;
  if (!them && key) {
    // Tolerancia: «Medio Cudeyo» frente a «MEDIO CUDEYO A». Solo si hay UN
    // candidato; con dos, mejor no decir nada que decir el de otro.
    const loose = standings.filter((s) => {
      const k = fcpTeamKey(s.equipo);
      return s !== us && (k.startsWith(key + " ") || key.startsWith(k + " "));
    });
    if (loose.length === 1) them = loose[0];
  }
  const lastMeeting =
    us && them ? findLastFcpMeeting(matches, us.equipo, them.equipo, matchDate) : null;
  return { fed: group.fed, idGrupo: group.idGrupo, us, them, lastMeeting };
}

export async function fetchClub(clubId: string) {
  const { data, error } = await supabaseBrowser()
    .from("clubs")
    .select("id, name, federation, logo_url, tournaments_only")
    .eq("id", clubId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    name: string;
    federation: string | null;
    logo_url: string | null;
    tournaments_only: boolean | null;
  } | null;
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

/**
 * Equipos INVITADOS: juegan en las pistas del club sin ser suyos
 * (`teams.venue_club_id`). El club les pone día, hora y pista, y nada más —ni
 * plantilla ni alineaciones—, así que no consumen cuota del plan.
 */
export interface DbVenueTeam {
  team_id: string;
  team_name: string;
  category: string | null;
  gender: string | null;
  group_name: string | null;
  preferred_home_slots: string[];
}

export async function fetchVenueTeams(clubId: string): Promise<DbVenueTeam[]> {
  const { data, error } = await supabaseBrowser().rpc("get_venue_teams", {
    target_club: clubId,
  });
  if (error) throw error;
  return ((data ?? []) as DbVenueTeam[]).map((t) => ({
    ...t,
    preferred_home_slots: t.preferred_home_slots ?? [],
  }));
}

/** Partidos de local de los equipos INVITADOS. Misma forma que los propios
 *  para que la pantalla pueda mezclarlos sin saber de cuál es cada uno. */
export async function fetchVenueHomeSchedule(
  clubId: string,
): Promise<DbClubHomeMatch[]> {
  const { data, error } = await supabaseBrowser().rpc("get_venue_home_schedule", {
    target_club: clubId,
  });
  if (error) throw error;
  return ((data ?? []) as DbClubHomeMatch[]).map((m) => ({
    ...m,
    preferred_home_slots: m.preferred_home_slots ?? [],
  }));
}

/**
 * Día, hora y pista de un partido.
 *
 * Son DOS caminos y no es un capricho:
 *
 *  · Equipo PROPIO → se escribe en `matchdays` y se manda push. Poner
 *    día/hora/pista ES confirmar que se juega aquí, así que se levanta
 *    `home_unconfirmed`.
 *  · Equipo INVITADO → el club no es su administrador y la RLS no le deja
 *    tocar la jornada. Va por `set_venue_matchday_slot`, que abre sólo esos
 *    tres campos y avisa al CAPITÁN del invitado por la campana. Por push no
 *    puede: la edge `send-push` autoriza por club del equipo, y ese equipo no
 *    es de este club.
 */
export async function setHomeMatchSlot(input: {
  matchdayId: string;
  isGuest: boolean;
  matchDate: string | null;
  matchTime: string | null;
  location: string | null;
}): Promise<void> {
  const sb = supabaseBrowser();
  if (input.isGuest) {
    const { error } = await sb.rpc("set_venue_matchday_slot", {
      p_matchday_id: input.matchdayId,
      p_match_date: input.matchDate,
      p_match_time: input.matchTime,
      p_location: input.location,
    });
    if (error) throw error;
    return;
  }

  const { error } = await sb
    .from("matchdays")
    .update({
      ...(input.matchDate ? { match_date: input.matchDate } : {}),
      match_time: input.matchTime,
      location: input.location,
      home_unconfirmed: false,
    })
    .eq("id", input.matchdayId);
  if (error) throw error;

  // El aviso no puede tumbar el guardado: si la push falla, el horario ya
  // está puesto y eso es lo que importa.
  try {
    await sb.functions.invoke("send-push", {
      body: { type: "schedule_set", matchdayId: input.matchdayId },
    });
  } catch {
    /* el horario ya está guardado */
  }
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
  cancelAtPeriodEnd: boolean;
  billingPeriod: string | null;
}

/* ── Notificaciones in-app (campanita) ──────────────────────────────
   Espejo de TACTIUM/src/core/services/notifications.ts. Las filas SOLO las
   escriben triggers/edge; el cliente solo LEE (la RLS acota a las tuyas). */
export interface DbNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  /** A dónde lleva el aviso. Null si no hay destino para ese tipo. */
  href: string | null;
  /** Jornada / torneo a los que se refiere (para los botones en línea). */
  matchdayId: string | null;
  tournamentId: string | null;
  /** `new_follower`: quién te sigue. `clubId` sólo si sigue a tu club. */
  actor: NotifActor | null;
  clubId: string | null;
}

export interface NotifActor {
  id: string;
  /** Nombre completo del perfil, o null si no se pudo leer. */
  name: string | null;
  username: string | null;
  /** Si tú ya le sigues (tabla `follows`). */
  following: boolean;
}

/**
 * A dónde lleva cada aviso.
 *
 * OJO con las claves de `data`: los triggers de Postgres escriben en
 * snake_case (`team_id`, `tournament_id`) y las edge functions en camelCase
 * (`matchdayId`, `tournamentId`). Se aceptan las dos o la mitad de los
 * avisos se quedan sin enlace.
 */
function notifHref(type: string, data: Record<string, unknown> | null): string | null {
  const g = (...keys: string[]) => {
    for (const k of keys) {
      const v = data?.[k];
      if (typeof v === "string" && v) return v;
    }
    return null;
  };
  const jornada = g("matchdayId", "matchday_id");
  const torneo = g("tournamentId", "tournament_id");

  switch (type) {
    case "availability_reminder":
      return jornada ? `/jornada/${jornada}/disponibilidad` : null;
    case "lineup_reminder":
      return jornada ? `/jornada/${jornada}/alineacion` : null;
    case "lineup_published":
    case "matchday_created":
      return jornada ? `/jornada/${jornada}` : null;
    case "tournament_schedule":
    case "tournament_bracket":
    case "tournament_moved":
      return torneo ? `/torneos/${torneo}` : null;
    case "tournament_payment_due":
      return torneo ? `/torneos/${torneo}/inscripcion` : null;
    case "tournament_signup":
      return torneo ? `/torneos/${torneo}` : "/club/torneos";
    case "joined_team":
    case "member_joined":
    case "player_claimed":
      return "/equipo";
    case "schedule_set":
      return "/club/horarios";
    // Encuesta de hora: el bloque vive en la jornada. Al gestor del club que
    // no es del equipo se le avisa de la hora fijada → Horarios.
    case "time_poll_open":
    case "time_poll_reminder":
      return jornada ? `/jornada/${jornada}` : null;
    case "time_poll_fixed":
      if (data?.for_club) return "/club/horarios";
      return jornada ? `/jornada/${jornada}` : null;
    case "kudos": {
      // data = {type, actor_id, target_kind: 'casual'|'league', target_id}
      const target = g("target_id", "targetId");
      if (!target) return null;
      return g("target_kind", "targetKind") === "league"
        ? `/jornada/${target}`
        : `/amistosos/${target}`;
    }
    default:
      return null;
  }
}

/** Avisos más recientes primero. `offset`/`limit` para paginar `/avisos`. */
export async function fetchNotifications(
  opts: { offset?: number; limit?: number } = {},
): Promise<DbNotification[]> {
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 30;
  const { data, error } = await supabaseBrowser()
    .from("notifications")
    .select("id, type, title, body, data, read_at, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as (Omit<DbNotification, "href"> & {
    data: Record<string, unknown> | null;
  })[];

  const str = (d: Record<string, unknown> | null, ...keys: string[]) => {
    for (const k of keys) {
      const v = d?.[k];
      if (typeof v === "string" && v) return v;
    }
    return null;
  };

  const out: DbNotification[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    read_at: r.read_at,
    created_at: r.created_at,
    href: notifHref(r.type, r.data),
    matchdayId: str(r.data, "matchdayId", "matchday_id"),
    tournamentId: str(r.data, "tournamentId", "tournament_id"),
    actor: null,
    clubId: r.type === "new_follower" ? str(r.data, "club_id", "clubId") : null,
  }));

  // «X te ha empezado a seguir» sólo trae el uuid, y el perfil público va
  // por nombre de usuario. Se resuelven aparte, que suelen ser pocos. De paso
  // se mira si ya le sigues, para el botón «Seguir también».
  const actorIds = [
    ...new Set(
      out
        .filter((r) => r.type === "new_follower")
        .map((r) => str(rows.find((x) => x.id === r.id)?.data ?? null, "actor_id"))
        .filter((id): id is string => !!id)
    ),
  ];
  if (actorIds.length > 0) {
    const [perfiles, siguiendo] = await Promise.all([
      Promise.all(
        actorIds.map(async (id) => {
          const { data: p } = await supabaseBrowser().rpc("get_public_user_profile", {
            target: id,
          });
          const prof = (Array.isArray(p) ? p[0] : p) as
            | { username?: string | null; full_name?: string | null }
            | null;
          return [id, prof] as const;
        })
      ),
      fetchFollowedUserIds(actorIds).catch(() => new Set<string>()),
    ]);
    const byId = new Map(perfiles);
    for (const r of out) {
      if (r.type !== "new_follower") continue;
      const actorId = str(rows.find((x) => x.id === r.id)?.data ?? null, "actor_id");
      if (!actorId) {
        r.href = "/comunidad";
        continue;
      }
      const prof = byId.get(actorId) ?? null;
      const username = prof?.username ?? null;
      r.actor = {
        id: actorId,
        name: prof?.full_name?.trim() || null,
        username,
        following: siguiendo.has(actorId),
      };
      r.href = username ? `/u/${username}` : "/comunidad";
    }
  }

  return out;
}

/** De una lista de usuarios, a cuáles sigues tú (tabla `follows`). */
export async function fetchFollowedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new Set();
  const { data, error } = await sb
    .from("follows")
    .select("target_id")
    .eq("follower_id", user.id)
    .eq("target_type", "user")
    .in("target_id", userIds);
  if (error) throw error;
  return new Set(((data ?? []) as { target_id: string }[]).map((f) => f.target_id));
}

/**
 * Tu respuesta a una jornada, para los botones del aviso de disponibilidad.
 *
 * Tu ficha se resuelve en el equipo DE ESA JORNADA (jornada → temporada →
 * equipo → jugador con tu `user_id`), no en el equipo activo: el aviso puede
 * ser de otro equipo tuyo. Null si no eres jugador de ese equipo o la
 * jornada no existe.
 */
export async function fetchMyMatchdayAvailability(matchdayId: string): Promise<{
  playerId: string;
  status: AvailStatus | null;
  upcoming: boolean;
} | null> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const md = await fetchMatchday(matchdayId);
  if (!md) return null;
  const { data: season } = await sb
    .from("seasons")
    .select("team_id")
    .eq("id", md.seasonId)
    .maybeSingle();
  const teamId = (season as { team_id: string | null } | null)?.team_id ?? null;
  if (!teamId) return null;
  const { data: players } = await sb
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .limit(1);
  const playerId = ((players ?? []) as { id: string }[])[0]?.id ?? null;
  if (!playerId) return null;
  const detail = await fetchAvailabilityDetail(matchdayId);
  return {
    playerId,
    status: detail[playerId]?.status ?? null,
    upcoming: md.status === "upcoming",
  };
}

/** Borra un aviso. La RLS acota a los tuyos. */
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("notifications").delete().eq("id", id);
  if (error) throw error;
}

/** Vacía la campana entera. */
export async function deleteAllNotifications(): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb.from("notifications").delete().eq("user_id", user.id);
  if (error) throw error;
}

/** Marca como leídos todos los avisos del usuario (RLS acota a los suyos). Es
 *  una ESCRITURA: el llamador decide si la ejecuta (la web es solo-lectura por
 *  defecto; el badge se limpia igual en local aunque no se persista). */
export async function markNotificationsRead(): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw error;
}

/** Marca UN aviso como leído (al tocarlo). Igual que `markOneRead` de la app. */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function fetchSubscription(): Promise<DbSubscription | null> {
  const { data, error } = await supabaseBrowser()
    .from("subscriptions")
    .select(
      "id, status, plan_tier, platform, subject_type, current_period_end, scheduled_plan_tier, billing_period, cancel_at_period_end"
    )
    .in("status", ["trialing", "active", "grace_period"])
    // El periodo tiene que seguir vivo, no basta con el estado.
    //
    // Hay filas zombi: suscripciones que se quedaron en `active` con la fecha ya
    // pasada. Salen cuando al comprar conviven la fila que crea la app y la que
    // crea el webhook, cada una con su id de transaccion, y los eventos de la
    // tienda solo tocan la suya. Sin esta condicion, la web enseñaba «ACTIVA ·
    // renueva el 14 de septiembre» el dia 15. Mismo arreglo que `isLiveSub` en
    // la app; aqui se hace en la consulta porque solo se pide una fila.
    .gt("current_period_end", new Date().toISOString())
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
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
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
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("public_get_tournament", { p_id: id });
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  if (row) {
    // La RPC pública no trae billing_status; el organizador lo necesita para
    // saber si el torneo ya está pagado/publicado. Lectura directa best-effort
    // (RLS: solo la devuelve al dueño; el espectador recibe null y no la usa).
    // `club_id` va aquí y no en la RPC pública a propósito: sirve para saber
    // si QUIEN MIRA organiza ESTE torneo. La RLS solo devuelve la fila a quien
    // puede verla, así que un espectador recibe null y la pantalla le da la
    // vista de espectador.
    const { data: b } = await sb
      .from("tournaments")
      .select("billing_status, club_id")
      .eq("id", id)
      .maybeSingle();
    const own = b as { billing_status?: string; club_id?: string } | null;
    return {
      ...row,
      billing_status: own?.billing_status ?? null,
      club_id: own?.club_id ?? null,
    };
  }
  // Borrador / no publicado: la RPC pública lo oculta. Lectura directa — la RLS
  // devuelve el torneo solo si el usuario puede verlo (el organizador, el suyo).
  const { data: direct } = await sb
    .from("tournaments")
    .select(
      "id, name, format, status, starts_on, ends_on, location, signup_code, max_pairs, entry_fee, fee_currency, gender, genders, category, categories, match_format, phase_formats, billing_status, club_id, courts, start_time, end_time, slot_minutes, rest_minutes",
    )
    .eq("id", id)
    .maybeSingle();
  return direct ?? null;
}

/** Ventana horaria de juego del torneo (para pintar la rejilla de
 *  disponibilidad de la inscripción). Sale de la RPC pública `tournament_lookup`
 *  (SECURITY DEFINER, accesible por anon) por código: es la MISMA fuente que la
 *  app. `null` si el torneo no está abierto o no se encuentra. */
export interface TournamentSignupWindow {
  start_time: string | null;
  end_time: string | null;
  max_removable_hours: number | null;
  entry_fee: number | null;
  entry_fee_2: number | null;
  category_rules: unknown | null;
  // Condiciones de participación ya resueltas por el servidor (las del club o
  // las estándar). Es el texto exacto que se guarda al aceptarlas.
  terms: string | null;
}
export async function fetchTournamentSignupWindow(
  code: string,
): Promise<TournamentSignupWindow | null> {
  if (!code) return null;
  const { data, error } = await supabaseBrowser().rpc("tournament_lookup", {
    p_code: code,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? (data[0] ?? null) : (data ?? null)) as
    | Partial<TournamentSignupWindow>
    | null;
  if (!row) return null;
  return {
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    max_removable_hours: row.max_removable_hours ?? null,
    entry_fee: row.entry_fee ?? null,
    entry_fee_2: row.entry_fee_2 ?? null,
    category_rules: row.category_rules ?? null,
    terms: row.terms ?? null,
  };
}

/** Código de inscripción de 6 caracteres (mismo alfabeto que la app: sin
 *  caracteres confundibles I/L/O/0/1). Espejo de `genCode` en tournaments.ts. */
function genTournamentCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Crea un torneo (insert en tournaments). Espejo de los campos que siempre
 *  pone la app: incluye `signup_code` (antes quedaba null y nadie podía
 *  apuntarse) y `pair_based`. Devuelve id + el código real generado. */
export async function createTournament(input: {
  clubId: string;
  name: string;
  format: string;
  matchFormat?: string;
  genders?: string[];
  categories?: string[];
  seedingMode?: string;
  entryFee?: number | null;
  entryFee2?: number | null;
  paymentDeadlineDays?: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
  // Ventana horaria de juego (para el horario y la disponibilidad de la
  // inscripción). "HH:MM". Igual que en la app.
  startTime?: string | null;
  endTime?: string | null;
  maxRemovableHours?: number | null;
  /** Condiciones de participación que el inscrito tiene que aceptar. */
  terms?: string | null;
  /** Lugar del torneo (opcional). */
  location?: string | null;
  /** Límites por categoría (puntos ≤ / nivel ≥), igual que en la app. */
  categoryRules?: {
    mode: "both" | "points" | "nivel";
    byCategory: Record<string, { puntos: number | null; nivel: number | null } | null>;
  } | null;
}): Promise<{ id: string; code: string }> {
  const code = genTournamentCode();
  const social = input.format === "americano" || input.format === "mexicano";
  const { data, error } = await supabaseBrowser()
    .from("tournaments")
    .insert({
      club_id: input.clubId,
      name: input.name,
      format: input.format,
      match_format: input.matchFormat ?? "bo3_stb",
      phase_formats: {},
      genders: input.genders ?? [],
      categories: input.categories ?? [],
      seeding_mode: input.seedingMode ?? "points",
      signup_code: code,
      pair_based: !social,
      entry_fee: input.entryFee ?? null,
      entry_fee_2: input.entryFee2 ?? null,
      ...(input.paymentDeadlineDays != null
        ? { payment_deadline_days: input.paymentDeadlineDays }
        : {}),
      ...(input.startsOn ? { starts_on: input.startsOn } : {}),
      ...(input.endsOn ? { ends_on: input.endsOn } : {}),
      ...(input.startTime ? { start_time: input.startTime } : {}),
      ...(input.endTime ? { end_time: input.endTime } : {}),
      ...(input.maxRemovableHours != null
        ? { max_removable_hours: input.maxRemovableHours }
        : {}),
      ...(input.terms?.trim() ? { terms: input.terms.trim() } : {}),
      ...(input.location?.trim() ? { location: input.location.trim() } : {}),
      ...(input.categoryRules ? { category_rules: input.categoryRules } : {}),
      // Nace PUBLICADO, como en la app (modelo «cobro al cerrar la
      // inscripción», 20260904b): la inscripción corre desde el primer día y
      // el peaje está al generar los cuadros. Antes la web lo creaba en
      // borrador y quedaba retenido esperando un pago que ya no toca.
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, code };
}

/** Torneos de un club (lectura directa, RLS: el club ve los SUYOS, incluidos
 *  los borradores — al contrario que la RPC pública, que oculta los draft). */
export interface DbClubTournament {
  id: string;
  name: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  categories: string[] | null;
  genders: string[] | null;
  billing_status?: string | null;
  location?: string | null;
  max_pairs?: number | null;
  signup_code?: string | null;
}
export async function fetchClubTournaments(
  clubId: string,
): Promise<DbClubTournament[]> {
  const { data, error } = await supabaseBrowser()
    .from("tournaments")
    .select(
      "id, name, format, status, starts_on, ends_on, categories, genders, billing_status, location, max_pairs, signup_code",
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbClubTournament[];
}

export async function fetchTournamentMatches(id: string) {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("public_tournament_matches", { p_id: id });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length) return rows;
  // Borrador / recién generado: fallback directo (RLS) para el organizador.
  const { data: direct } = await sb
    .from("tournament_matches")
    .select(
      "id, gender, category, group_no, bracket, round, slot, home_reg, away_reg, home_reg2, away_reg2, home_score, away_score, winner_reg, status, sets, scheduled_at, court",
    )
    .eq("tournament_id", id);
  return (direct ?? []) as Record<string, unknown>[];
}

export async function fetchTournamentRegs(id: string) {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("public_tournament_regs", { p_id: id });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length) return rows;
  // Borrador: fallback directo (RLS) para el organizador (incluye contacto).
  const { data: direct } = await sb
    .from("tournament_registrations")
    .select(
      "id, gender, category, group_no, pair_label, p1_name, p2_name, p1_phone, p1_email, p1_user_id, p2_user_id, seed, seed_points, status",
    )
    .eq("tournament_id", id);
  return (direct ?? []) as Record<string, unknown>[];
}

/**
 * Inscripciones de un torneo en las que está el usuario (como jugador 1 o 2).
 * Sirve para resaltar «Tu camino» en el cuadro. Lee directo bajo RLS, que deja
 * ver a cada uno sus propias inscripciones; si no puede, devuelve vacío y el
 * cuadro se pinta sin resaltar (nunca rompe la pantalla).
 */
export async function fetchMyTournamentRegIds(
  tournamentId: string,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabaseBrowser()
    .from("tournament_registrations")
    .select("id")
    .eq("tournament_id", tournamentId)
    .or(`p1_user_id.eq.${userId},p2_user_id.eq.${userId}`);
  if (error) return [];
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Estado de cobro de las inscripciones (para el organizador). La RPC pública no
 *  lo expone; el organizador lo lee directo (RLS). Devuelve mapa id → estado. */
export async function fetchRegsPayments(
  tournamentId: string,
): Promise<Record<string, { paymentStatus: string | null; paymentMethod: string | null }>> {
  const { data } = await supabaseBrowser()
    .from("tournament_registrations")
    .select("id, payment_status, payment_method")
    .eq("tournament_id", tournamentId);
  const map: Record<string, { paymentStatus: string | null; paymentMethod: string | null }> = {};
  for (const r of (data ?? []) as {
    id: string;
    payment_status: string | null;
    payment_method: string | null;
  }[]) {
    map[r.id] = { paymentStatus: r.payment_status, paymentMethod: r.payment_method };
  }
  return map;
}

/** Marca el cobro de una inscripción (organizador): pagada / pendiente. */
export async function setRegistrationPayment(
  id: string,
  status: "paid" | "pending_club",
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("tournament_registrations")
    .update({ payment_status: status })
    .eq("id", id);
  if (error) throw error;
}

/** Inscripción pública a un torneo por código (el que llama es el jugador 1).
 *  RPC tournament_signup: valida elegibilidad y crea la inscripción en servidor. */
export async function tournamentSignup(input: {
  code: string;
  category?: string | null;
  gender?: string | null;
  p1Name: string;
  p2Name: string;
  p1Email?: string | null;
  p1Phone?: string | null;
  p2Email?: string | null;
  seedPoints?: number | null;
  leagueSum?: number | null;
  availability?: string[];
  // Casilla de condiciones: el servidor la exige.
  termsAccepted: boolean;
}): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc("tournament_signup", {
    p_code: input.code.trim().toUpperCase(),
    p1_name: input.p1Name.trim(),
    p1_email: input.p1Email ?? null,
    p1_phone: input.p1Phone ?? null,
    p2_name: input.p2Name.trim(),
    p2_email: input.p2Email ?? null,
    p2_phone: null,
    p_availability: input.availability ?? [],
    p_category: input.category ?? null,
    p_gender: input.gender ?? null,
    p_seed_points: input.seedPoints ?? null,
    p_league_sum: input.leagueSum ?? null,
    p_terms_accepted: input.termsAccepted,
  });
  if (error) throw error;
  return data as string;
}

/** Inscripción "pagar EN EL CLUB": inscribe como pendiente de pago en el club
 *  (sin Stripe). El club la confirma al cobrar el efectivo. */
export async function tournamentSignupOffline(input: {
  code: string;
  category?: string | null;
  gender?: string | null;
  p1Name: string;
  p2Name: string;
  p1Email?: string | null;
  p1Phone?: string | null;
  p2Email?: string | null;
  seedPoints?: number | null;
  leagueSum?: number | null;
  availability?: string[];
  // Casilla de condiciones: el servidor la exige.
  termsAccepted: boolean;
}): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc("tournament_signup_offline", {
    p_code: input.code.trim().toUpperCase(),
    p1_name: input.p1Name.trim(),
    p1_email: input.p1Email ?? null,
    p1_phone: input.p1Phone ?? null,
    p2_name: input.p2Name.trim(),
    p2_email: input.p2Email ?? null,
    p2_phone: null,
    p_availability: input.availability ?? [],
    p_category: input.category ?? null,
    p_gender: input.gender ?? null,
    p_seed_points: input.seedPoints ?? null,
    p_league_sum: input.leagueSum ?? null,
    p_terms_accepted: input.termsAccepted,
  });
  if (error) throw error;
  return data as string;
}

/* ── Mis torneos (jugador) ─────────────────────────────────────── */
export interface MyTournament {
  id: string;
  name: string;
  club_name: string | null;
  cover_url: string | null;
  location: string | null;
  starts_on: string | null;
  status: string;
  format: string;
  genders: string[];
  categories: string[];
  signup_code: string | null;
  players: number;
  entry_fee: number | null;
  fee_currency: string | null;
}

/** Torneos en los que el usuario está inscrito (p1 o p2). RPC `my_tournaments`
 *  (SECURITY DEFINER, usa auth.uid()); requiere sesión. Espejo de la app. */
export async function fetchMyTournaments(): Promise<MyTournament[]> {
  const { data, error } = await supabaseBrowser().rpc("my_tournaments", {});
  if (error) throw error;
  return ((data ?? []) as MyTournament[]).map((r) => ({
    ...r,
    players: Number(r.players ?? 0),
    entry_fee: r.entry_fee == null ? null : Number(r.entry_fee),
  }));
}

/** Código de compañero de una inscripción (solo lo ve el jugador 1 / vinculado).
 *  RPC `registration_partner_code`. Sirve para que P1 se lo pase a su pareja. */
export async function getRegistrationPartnerCode(
  regId: string,
): Promise<string | null> {
  const { data, error } = await supabaseBrowser().rpc(
    "registration_partner_code",
    { p_reg_id: regId },
  );
  if (error) return null;
  const v = data as unknown;
  if (typeof v === "string") return v;
  const rows = (v ?? []) as { registration_partner_code?: string }[];
  return rows[0]?.registration_partner_code ?? null;
}

/** El compañero mete su código y vincula su cuenta como jugador 2. Devuelve el
 *  id del torneo. RPC `claim_partner_by_code`. Espejo de la app. */
export async function claimTournamentPartner(code: string): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc("claim_partner_by_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as string;
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

/* ── Seguir / dejar de seguir (tabla follows) ───────────────────── */
export async function followTarget(
  type: "user" | "club",
  id: string,
): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Inicia sesión para seguir.");
  const { error } = await sb
    .from("follows")
    .insert({ follower_id: user.id, target_type: type, target_id: id });
  if (error) throw error;
}

export async function unfollowTarget(
  type: "user" | "club",
  id: string,
): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Inicia sesión.");
  const { error } = await sb
    .from("follows")
    .delete()
    .match({ follower_id: user.id, target_type: type, target_id: id });
  if (error) throw error;
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
  /** Kudos recibidos por el resultado (migración 20261002b_activity_kudos). */
  kudos_count: number;
  /** Si el usuario ya dio el suyo. */
  i_gave_kudos: boolean;
}

export async function fetchFeed(limit = 30): Promise<FeedRow[]> {
  const { data, error } = await supabaseBrowser().rpc("social_feed", {
    p_limit: limit,
  });
  if (error) throw error;
  // Un amistoso entre dos personas que sigues llega una vez por cada una: se
  // enseña una sola tarjeta por partido, como en la app.
  const seen = new Set<string>();
  const rows = ((data ?? []) as Partial<FeedRow>[]).filter((r) => {
    const k = `${r.kind}-${r.ref_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Un servidor sin la migración de kudos no trae las columnas: se rellenan.
  return rows.map((r) => ({
    ...(r as FeedRow),
    kudos_count: Number(r.kudos_count ?? 0),
    i_gave_kudos: !!r.i_gave_kudos,
  }));
}

/**
 * Da o quita tu kudos a un resultado del feed (toggle). Pasa por
 * `guardedWrite`. En un amistoso, `targetUserId` es el `actor_id` del ítem
 * (a quién le llega el aviso); en una jornada, null.
 */
export async function toggleActivityKudos(
  kind: "casual" | "league",
  targetId: string,
  targetUserId: string | null = null,
): Promise<WriteResult<{ given: boolean; count: number }>> {
  return guardedWrite("dar kudos", async () => {
    const { data, error } = await supabaseBrowser().rpc("toggle_activity_kudos", {
      p_kind: kind,
      p_target_id: targetId,
      p_target_user_id: kind === "casual" ? targetUserId : null,
    });
    if (error) throw error;
    const d = (data ?? {}) as { given?: boolean; count?: number };
    return { given: !!d.given, count: Number(d.count ?? 0) };
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Perfil público por id o por @usuario (las URLs /u/<x> usan las dos formas). */
export async function fetchPublicProfile(idOrUsername: string) {
  const sb = supabaseBrowser();
  let userId = idOrUsername;
  if (!UUID_RE.test(idOrUsername)) {
    const handle = decodeURIComponent(idOrUsername).replace(/^@/, "");
    const { data: resolved, error: rErr } = await sb.rpc("resolve_username", {
      p_username: handle,
    });
    if (rErr) throw rErr;
    if (!resolved) return null;
    userId = resolved as string;
  }
  const { data, error } = await sb.rpc("get_public_user_profile", {
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
  /** Cuentas vinculadas de cada lado (null = jugador sin cuenta). Sirve para
   *  saber en qué lado jugó el usuario, que NO siempre es el 0. */
  userIdsA: (string | null)[];
  userIdsB: (string | null)[];
}

export async function fetchCasualMatches(limit = 30): Promise<DbCasual[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("casual_matches")
    .select(
      "id, type, played_on, sets, winner_side, claim_code, photo_url, casual_match_participants(side, slot, name, user_id)"
    )
    .order("played_on", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((m) => {
    const parts = ((m.casual_match_participants ?? []) as {
      side: number;
      slot: number;
      name: string;
      user_id: string | null;
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
      userIdsA: parts.filter((p) => p.side === 0).map((p) => p.user_id ?? null),
      userIdsB: parts.filter((p) => p.side === 1).map((p) => p.user_id ?? null),
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
  /** Aún sin sorteo: hay equipos inscritos pero no hay grupos. */
  upcoming: boolean;
}

/**
 * Temporadas disponibles, de la más reciente a la más antigua.
 *
 * Se descartan las ligas VACÍAS —la federación crea entradas que luego no usa—
 * pero una liga EN INSCRIPCIÓN no está vacía: no tiene grupos porque no se ha
 * hecho el sorteo, y sí tiene equipos apuntados. Esconderla era esconder justo
 * lo que interesa mientras se fichan jugadores. Mismo criterio que
 * `fetchFcpYears` en la app.
 */
export async function fetchFcpLeagues(): Promise<FcpLeague[]> {
  const [{ data: grupos }, { data: inscritas }, { data: ligas, error }] =
    await Promise.all([
      // El limit explícito importa: PostgREST corta en 1000 por defecto y los
      // grupos crecen ~130 por temporada, así que sin esto las temporadas
      // viejas irían desapareciendo del selector sin avisar.
      supabaseBrowser().from("fcp_grupos").select("id_liga").limit(20000),
      supabaseBrowser().from("fcp_inscripciones").select("id_liga").limit(20000),
      supabaseBrowser().from("fcp_ligas").select("id_liga, nombre, temporada"),
    ]);
  if (error) throw error;
  const conGrupos = new Set((grupos ?? []).map((g) => g.id_liga));
  const conInscritos = new Set((inscritas ?? []).map((i) => i.id_liga));
  return (ligas ?? [])
    .filter((l) => conGrupos.has(l.id_liga) || conInscritos.has(l.id_liga))
    .map((l) => ({
      idLiga: l.id_liga,
      nombre: l.nombre ?? String(l.id_liga),
      temporada: l.temporada,
      upcoming: !conGrupos.has(l.id_liga),
    }))
    .sort((a, b) => (b.temporada ?? "").localeCompare(a.temporada ?? ""));
}

/* ── Inscripción del propio equipo a la temporada que viene ──────────── */

export interface FcpTeamInscripcion {
  temporada: string;
  /** Nombre con el que lo inscribe la Federación (puede no ser el de TACTIUM). */
  equipo: string;
  /** id federativo de la inscripción, para enlazar su ficha pública. */
  idEquipo: number;
  categoria: string | null;
  /** Su categoría de ahora, para ver de un vistazo si sube o baja. */
  categoriaActual: string | null;
  /** Grupo dentro de la categoría ('A' | 'B'…), null si aún no se conoce. */
  subgrupo: string | null;
  confirmado: boolean;
  sede: string | null;
  /** La sede en corto («SMASH»), como la escribe el PDF de la Federación. */
  sedeCorta: string | null;
  estado: FcpSeasonEstado;
  /** «Sigue en 2ª», «4ª → 3ª», «Antes …», «Nuevo». */
  estadoLabel: string;
  /** Los demás equipos de su grupo (vacío sin subgrupo). */
  rivales: FcpRival[];
  roster: FcpRosterPlayer[];
}

/**
 * ¿Está MI equipo apuntado a la temporada que viene?
 *
 * El club tenía esto en su panel desde hace tiempo; un capitán independiente no
 * tenía dónde verlo, y es exactamente la misma pregunta: si está inscrito, si
 * se lo han confirmado, en qué categoría y grupo ha quedado y con qué
 * plantilla.
 *
 * Es el mismo cruce que el panel del club (`fetchClubInscripciones`): por
 * jugadores en común y, si no, por nombre sin patrocinador. Antes iba por
 * nombre exacto, y como la FCP reasigna letras entre temporadas, un equipo
 * podía ver la inscripción de su hermano («RACKET SPORT B» de 1ª es el «A» que
 * jugaba en 2ª). `hermanos` son los demás equipos del mismo club que ve el
 * usuario: con ellos delante, el cruce no le adjudica a este equipo la fila de
 * otro del club que comparta un par de jugadores. Como en la app.
 *
 * Devuelve null si no hay liga en inscripción o si ese equipo no aparece: así
 * la pantalla no pinta nada el resto del año.
 */
export async function fetchTeamInscripcion(
  team: { id: string; name: string; gender: string | null; category: string | null },
  hermanos: { id: string; name: string; gender: string | null; category: string | null }[] = []
): Promise<FcpTeamInscripcion | null> {
  if ((team.name ?? "").trim().length < 2) return null;
  const lista = [...hermanos.filter((t) => t.id !== team.id), team];
  const r = await fetchClubInscripciones(lista);
  const fila = r?.rows.find((x) => x.teamId === team.id);
  if (!r || !fila) return null;

  const [roster, rivales] = await Promise.all([
    fetchFcpRoster(fila.idEquipo),
    fetchInscripcionGrupo(fila).catch(() => [] as FcpRival[]),
  ]);
  return {
    temporada: r.temporada,
    equipo: fila.equipo,
    idEquipo: fila.idEquipo,
    categoria: fila.categoria,
    categoriaActual: fila.categoriaActual ?? team.category,
    subgrupo: fila.subgrupo,
    confirmado: fila.confirmado,
    sede: fila.sede,
    sedeCorta: fila.sedeCorta,
    estado: fila.estado,
    estadoLabel: fila.estadoLabel,
    rivales,
    roster,
  };
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
 * Cabecera de un grupo: su nombre legible y la temporada. La pantalla de
 * clasificación recibe el `id_grupo` por la URL y sin esto pintaba el propio
 * identificador como título ("31271" en vez de "2ª Categoría Femenina · A").
 */
export async function fetchFcpGroupHeader(
  idGrupo: string,
): Promise<FcpGroupHeader | null> {
  return fetchFcpGroupHeaderWith(supabaseBrowser(), idGrupo);
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
  /** Solo en una liga en inscripción (de `fcp_inscripciones`): con esto la
   *  lista se agrupa por categoría y por el grupo que reparte la Federación. */
  insc?: {
    /** «2ª CATEGORIA MASCULINA». */
    grupoNombre: string | null;
    genero: "M" | "F" | null;
    /** 'A' | 'B'…, null si la categoría aún no está repartida. */
    subgrupo: string | null;
    sedeCorta: string | null;
    confirmado: boolean;
  };
}

/**
 * Equipos federados. Salen de la clasificación, que es donde vive el nombre
 * del equipo junto a su grupo; `fcp_grupos` no los lista.
 */
export async function searchFcpTeams(opts: {
  query?: string;
  grupoIds?: string[];
  limit?: number;
  /** Liga en inscripción: los equipos salen de `fcp_inscripciones`, no de la
   *  clasificación, que todavía no existe. */
  idLigaSinGrupos?: number | null;
}): Promise<FcpTeamResult[]> {
  const { query = "", grupoIds, limit = 60, idLigaSinGrupos = null } = opts;
  // La misma forma de salida para las dos fuentes: la pantalla no tiene por qué
  // saber si el sorteo está hecho.
  let sel = idLigaSinGrupos
    ? supabaseBrowser()
        .from("fcp_inscripciones")
        .select(
          "id_equipo, equipo, id_grupo, grupo_nombre, genero, subgrupo, sede_corta, confirmado"
        )
        .eq("id_liga", idLigaSinGrupos)
    : supabaseBrowser()
        .from("fcp_clasificacion")
        .select("id_equipo, equipo, id_grupo");
  const q = query.replace(/[%,()]/g, " ").trim();
  if (q.length >= 2) sel = sel.ilike("equipo", `%${q}%`);
  if (grupoIds?.length) sel = sel.in("id_grupo", grupoIds.slice(0, 200));

  // Ordenar en la BASE, no solo en JS. Sin ORDER BY, el `limit` se lleva filas
  // arbitrarias y el orden alfabético de después solo ordena el trozo que haya
  // tocado: con los 323 equipos de una liga en inscripción salían 60 «al azar»
  // y no había forma de dar con el tuyo.
  sel = sel.order("equipo", { ascending: true });

  // La clasificación repite equipo por grupo, así que hay que pedir de más
  // para que el dedup no deje la lista corta. Las inscripciones son una fila
  // por equipo: pedir de más solo gastaría ancho de banda.
  const { data, error } = await sel.limit(idLigaSinGrupos ? limit : limit * 4);
  if (error) throw error;

  if (idLigaSinGrupos) {
    return (
      await inscritosUnicos((data ?? []) as unknown as InscritoRow[])
    ).slice(0, limit);
  }

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

type InscritoRow = {
  id_equipo: number | null;
  equipo: string | null;
  id_grupo: string;
  grupo_nombre: string | null;
  genero: string | null;
  subgrupo: string | null;
  sede_corta: string | null;
  confirmado: boolean | null;
};

/**
 * Una fila por equipo de una liga en inscripción.
 *
 * Al rellenar los grupos con el PDF de distribución de la Federación quedaron
 * filas viejas sin `subgrupo` en categorías que sí lo tienen (un equipo que
 * también sale bien colocado, o uno que la FCP ya no publica). Se descartan:
 * si no, el equipo salía dos veces o en un «sin grupo» que no existe. Lo de
 * «esa categoría tiene grupos» se pregunta a la tabla y no a lo que ha
 * devuelto la búsqueda, que con un término es solo un trozo. Mismo criterio
 * que `fetchGroupInscritos` en la app.
 */
async function inscritosUnicos(rows: InscritoRow[]): Promise<FcpTeamResult[]> {
  const dudosas = [
    ...new Set(rows.filter((r) => !r.subgrupo).map((r) => r.id_grupo)),
  ];
  const conSubgrupos = new Set<string>();
  if (dudosas.length > 0) {
    const { data } = await supabaseBrowser()
      .from("fcp_inscripciones")
      .select("id_grupo")
      .in("id_grupo", dudosas)
      .not("subgrupo", "is", null)
      .limit(5000);
    for (const g of (data ?? []) as { id_grupo: string }[]) conSubgrupos.add(g.id_grupo);
  }
  const seen = new Map<number, FcpTeamResult>();
  for (const r of rows) {
    if (r.id_equipo == null) continue;
    if (!r.subgrupo && conSubgrupos.has(r.id_grupo)) continue;
    const prev = seen.get(r.id_equipo);
    if (prev && (prev.insc?.subgrupo || !r.subgrupo)) continue;
    seen.set(r.id_equipo, {
      idEquipo: r.id_equipo,
      equipo: (r.equipo ?? "").trim() || "—",
      idGrupo: r.id_grupo,
      insc: {
        grupoNombre: r.grupo_nombre,
        genero: r.genero === "F" ? "F" : r.genero === "M" ? "M" : null,
        subgrupo: r.subgrupo ?? null,
        sedeCorta: r.sede_corta ?? null,
        confirmado: r.confirmado === true,
      },
    });
  }
  return [...seen.values()].sort((a, b) => a.equipo.localeCompare(b.equipo, "es"));
}

export interface FcpRankingRow {
  posicion: number;
  name: string;
  puntos: number | null;
  /** Ficha del jugador, para enlazar. Null si el nombre no cruza. */
  idJugador: string | null;
  avatarUrl: string | null;
  /** Lo ganado en el año, del histórico. Null si no lo tenemos. */
  puntosAnio: number | null;
}

/**
 * Pone ficha y cara a las filas del ranking.
 *
 * `fcp_rankings` NO trae el id real del jugador —su `id_jugador` es una
 * clave sintética de la propia fila y `id_fcp` está a null—, así que lo
 * único que comparten ranking y censo es el nombre. El cruce se hace en el
 * servidor (`fcp_ranking_identities`) porque implica normalizar 32.000
 * fichas, y de paso trae la foto en la misma llamada.
 */
async function conIdentidad(rows: FcpRankingRow[]): Promise<FcpRankingRow[]> {
  const nombres = [...new Set(rows.map((r) => r.name).filter((n) => n && n !== "—"))];
  if (nombres.length === 0) return rows;

  const found = new Map<
    string,
    { idJugador: string; avatarUrl: string | null; puntosAnio: number | null }
  >();
  for (let i = 0; i < nombres.length; i += 300) {
    const { data } = await supabaseBrowser().rpc("fcp_ranking_identities", {
      p_nombres: nombres.slice(i, i + 300),
    });
    for (const d of (data ?? []) as {
      nombre: string;
      id_jugador: string;
      avatar_url: string | null;
      puntos_anio: number | null;
    }[]) {
      found.set(d.nombre, {
        idJugador: d.id_jugador,
        avatarUrl: d.avatar_url,
        puntosAnio: d.puntos_anio,
      });
    }
  }
  return rows.map((r) => ({ ...r, ...(found.get(r.name) ?? {}) }));
}

/** Ranking FCP por género/categoría. Con término, filtra por nombre. */
export async function fetchFcpRanking(opts: {
  genero: "all" | "M" | "F";
  categoria: string;
  query?: string;
  limit?: number;
}): Promise<FcpRankingRow[]> {
  const { genero, categoria, query = "", limit = 150 } = opts;
  const q = query.replace(/[%,()]/g, " ").trim();

  // "Ambos": la FCP no tiene una lista combinada de ambos géneros (antes esto
  // caía al ranking masculino y "Ambos" mostraba solo hombres). Traemos las dos
  // listas (M y F) y las fusionamos reordenando por puntos — la `posicion`
  // oficial es por lista, así que al unir hay que recalcularla.
  if (genero === "all") {
    let sel = supabaseBrowser()
      .from("fcp_rankings")
      .select("posicion, nombre, puntos")
      .in("categoria", [
        rankingCategoria("M", categoria),
        rankingCategoria("F", categoria),
      ]);
    if (q.length >= 2) sel = sel.ilike("nombre", `%${q}%`);
    const { data, error } = await sel
      .order("puntos", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return conIdentidad(
      (data ?? []).map((r, i) => ({
        posicion: i + 1,
        name: r.nombre ?? "—",
        puntos: r.puntos == null ? null : Number(r.puntos),
        idJugador: null,
        avatarUrl: null,
        puntosAnio: null,
      }))
    );
  }

  let sel = supabaseBrowser()
    .from("fcp_rankings")
    .select("posicion, nombre, puntos")
    .eq("categoria", rankingCategoria(genero, categoria));
  if (q.length >= 2) sel = sel.ilike("nombre", `%${q}%`);
  const { data, error } = await sel
    .order("posicion", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return conIdentidad(
    (data ?? []).map((r) => ({
      posicion: r.posicion,
      name: r.nombre ?? "—",
      puntos: r.puntos == null ? null : Number(r.puntos),
      idJugador: null,
      avatarUrl: null,
      puntosAnio: null,
    }))
  );
}

export async function fetchFcpStandings(
  idGrupo: string
): Promise<FcpStanding[]> {
  return fetchFcpStandingsWith(supabaseBrowser(), idGrupo);
}

export async function fetchFcpMatches(
  idGrupo: string,
  limit = 200
): Promise<FcpMatch[]> {
  return fetchFcpMatchesWith(supabaseBrowser(), idGrupo, limit);
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

/** Sanea un término para los filtros ilike/.or de PostgREST (%,() rompen). */
const cleanFcpTerm = (s: string) =>
  s.replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim();

// `fcpDisplayName` (orden natural "Nombre Apellido1 Apellido2") ya está definido
// más abajo en este mismo archivo; se reutiliza aquí (declaración hoisted).

export async function searchFcpPlayers(
  q: string,
  limit = 40
): Promise<FcpPlayerRow[]> {
  const cleaned = cleanFcpTerm(q);
  if (cleaned.length < 3) return [];
  // TOKENIZAR: el nombre se guarda como "APELLIDOS, NOMBRE"; buscar la cadena
  // entera falla si el usuario escribe en orden natural ("Javier Bada Palacio").
  // Encadenar .or() por token los combina con AND -> todos deben aparecer, en
  // cualquier orden y columna (nombre/apellido1/apellido2/nombre_pila).
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  if (!tokens.length) return [];
  let sel = supabaseBrowser()
    .from("fcp_jugadores")
    .select(
      "id_jugador, nombre, apellido1, apellido2, nombre_pila, categoria, puntos, id_equipo, nombre_equipo"
    );
  for (const tok of tokens) {
    sel = sel.or(
      `nombre.ilike.%${tok}%,apellido1.ilike.%${tok}%,apellido2.ilike.%${tok}%,nombre_pila.ilike.%${tok}%`
    );
  }
  const { data, error } = await sel
    .order("puntos", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    idJugador: r.id_jugador,
    nombre: fcpDisplayName(r),
    categoria: r.categoria,
    puntos: r.puntos ?? 0,
    idEquipo: r.id_equipo,
    nombreEquipo: r.nombre_equipo,
  }));
}

export interface FcpPlayerCandidate {
  idJugador: string;
  name: string;
  puntos: number | null; // puntos de LIGA
  // El nivel que cuenta = la MEJOR categoría del jugador (nº menor) entre la de
  // LIGA (división de su equipo) y la de CIRCUITO (rankings "2ª CATEGORIA…").
  nivel: number | null;
  categoriaDiv: string | null; // "2ª" — la del nivel que manda
  nivelLiga: number | null;
  nivelCircuito: number | null;
  origenNivel: "liga" | "circuito" | "ambos" | null;
  equipo: string | null;
  genero: "M" | "F" | null;
}

// Categoría de CIRCUITO (espejo de fcpSearch.ts en la app). Se cruza por nombre
// porque `fcp_jugadores` no guarda el `id_fcp` estable del ranking.
const CIRCUITO_CAT_RE = /(\d+)\s*ª\s*CATEGORIA\s*(MASCULINA|FEMENINA)?/i;

const fcpNameTokens = (s: string): string[] =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 3);

const fcpSameName = (a: string[], b: string[]): boolean => {
  if (a.length === 0 || b.length === 0) return false;
  const overlap = a.filter((t) => b.includes(t)).length;
  return overlap >= 2 && overlap >= Math.min(3, Math.min(a.length, b.length));
};

interface FcpCircuitRow {
  idJugador: string;
  name: string;
  tokens: string[];
  nivel: number;
  genero: "M" | "F" | null;
}

/** "GONZALEZ PEREZ, Ana" → "Ana Gonzalez Perez" (el ranking invierte el orden). */
const prettyRankingName = (raw: string): string => {
  const s = raw.trim().replace(/\s+/g, " ");
  const i = s.indexOf(",");
  const full = i >= 0 ? `${s.slice(i + 1).trim()} ${s.slice(0, i).trim()}` : s;
  return full
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
};

async function fetchFcpCircuitRows(tokens: string[]): Promise<FcpCircuitRow[]> {
  if (tokens.length === 0) return [];
  let sel = supabaseBrowser()
    .from("fcp_rankings")
    .select("id_jugador, nombre, categoria")
    .ilike("categoria", "%CATEGORIA%");
  for (const tok of tokens) sel = sel.ilike("nombre", `%${tok}%`);
  const { data } = await sel.limit(120);
  const byPerson = new Map<string, FcpCircuitRow>();
  for (const r of (data ?? []) as {
    id_jugador: string;
    nombre: string | null;
    categoria: string | null;
  }[]) {
    const m = (r.categoria ?? "").match(CIRCUITO_CAT_RE);
    if (!m) continue;
    const nivel = parseInt(m[1], 10);
    if (!Number.isFinite(nivel)) continue;
    const toks = fcpNameTokens(r.nombre ?? "");
    if (toks.length === 0) continue;
    const key = [...toks].sort().join(" ");
    const prev = byPerson.get(key);
    if (prev && prev.nivel <= nivel) continue;
    byPerson.set(key, {
      idJugador: String(r.id_jugador),
      name: prettyRankingName(r.nombre ?? ""),
      tokens: toks,
      nivel,
      genero: m[2] ? (m[2].toUpperCase().startsWith("F") ? "F" : "M") : null,
    });
  }
  return [...byPerson.values()];
}

/** Candidatos de la Federación por nombre, con puntos + DIVISIÓN de liga
 *  resuelta desde el grupo de su equipo (no la `categoria`="ABS"). Espejo de
 *  `resolveFcpPlayer` de la app. Ordenados por puntos desc. */
export async function resolveFcpPlayer(name: string): Promise<FcpPlayerCandidate[]> {
  const q = cleanFcpTerm(name);
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (q.length < 3 || tokens.length === 0) return [];

  let sel = supabaseBrowser()
    .from("fcp_jugadores")
    .select(
      "id_jugador, nombre, apellido1, apellido2, nombre_pila, puntos, id_equipo, nombre_equipo"
    );
  for (const tok of tokens) {
    sel = sel.or(
      `nombre.ilike.%${tok}%,apellido1.ilike.%${tok}%,apellido2.ilike.%${tok}%,nombre_pila.ilike.%${tok}%`
    );
  }
  const [{ data }, circuitRows] = await Promise.all([
    sel.order("puntos", { ascending: false }).limit(80),
    fetchFcpCircuitRows(tokens),
  ]);
  const rows = (data ?? []) as {
    id_jugador: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    nombre_pila: string | null;
    puntos: number | null;
    id_equipo: number | null;
    nombre_equipo: string | null;
  }[];
  if (!rows.length) return [];

  // Dedup por persona (la licencia cambia por temporada). 1ª fila = más puntos.
  type Person = { rep: (typeof rows)[number]; equipos: Set<number> };
  const byPerson = new Map<string, Person>();
  for (const r of rows) {
    const key = String(r.id_jugador).replace(/^fcp_\d+_/, "");
    let e = byPerson.get(key);
    if (!e) {
      e = { rep: r, equipos: new Set() };
      byPerson.set(key, e);
    }
    if (r.id_equipo != null) e.equipos.add(r.id_equipo);
  }
  const people = [...byPerson.values()].slice(0, 6);

  // División por id_equipo → nivel + género + temporada (id_liga) del grupo.
  const allEquipos = [...new Set(people.flatMap((p) => [...p.equipos]))];
  const divByEquipo = new Map<
    number,
    { nivel: number; cat: string; genero: string; idLiga: number }
  >();
  if (allEquipos.length) {
    const { data: cl } = await supabaseBrowser()
      .from("fcp_clasificacion")
      .select("id_equipo, id_grupo")
      .in("id_equipo", allEquipos);
    const clRows = ((cl ?? []) as { id_equipo: number; id_grupo: string }[]).filter(
      (r) => !/^fase/i.test(r.id_grupo)
    );
    const grupoIds = [...new Set(clRows.map((r) => r.id_grupo))];
    const gMap = new Map<string, { nombre: string; genero: string; idLiga: number }>();
    if (grupoIds.length) {
      const { data: gr } = await supabaseBrowser()
        .from("fcp_grupos")
        .select("id_grupo, nombre, genero, id_liga")
        .in("id_grupo", grupoIds);
      for (const g of (gr ?? []) as {
        id_grupo: string;
        nombre: string;
        genero: string;
        id_liga: number | null;
      }[]) {
        gMap.set(g.id_grupo, { nombre: g.nombre, genero: g.genero, idLiga: g.id_liga ?? 0 });
      }
    }
    for (const r of clRows) {
      const g = gMap.get(r.id_grupo);
      if (!g) continue;
      const cat = catShort(g.nombre);
      const nivel = cat ? parseInt(cat, 10) : NaN;
      if (!Number.isFinite(nivel)) continue;
      const prev = divByEquipo.get(r.id_equipo);
      if (!prev || g.idLiga > prev.idLiga)
        divByEquipo.set(r.id_equipo, { nivel, cat: cat!, genero: g.genero, idLiga: g.idLiga });
    }
  }

  // Filas de circuito ya fundidas con un jugador de liga (no duplicar persona).
  const usedCircuit = new Set<string>();

  const out: FcpPlayerCandidate[] = people.map((p) => {
    let best: { nivel: number; cat: string; genero: string; idLiga: number } | null = null;
    for (const eq of p.equipos) {
      const d = divByEquipo.get(eq);
      if (!d) continue;
      if (
        !best ||
        d.idLiga > best.idLiga ||
        (d.idLiga === best.idLiga && d.nivel < best.nivel)
      )
        best = d;
    }
    const name = fcpDisplayName(p.rep);
    const genero: "M" | "F" | null = best ? (best.genero === "F" ? "F" : "M") : null;
    const nivelLiga = best ? best.nivel : null;
    const myTokens = fcpNameTokens(name);
    let nivelCircuito: number | null = null;
    for (const cr of circuitRows) {
      if (genero && cr.genero && cr.genero !== genero) continue;
      if (!fcpSameName(myTokens, cr.tokens)) continue;
      usedCircuit.add(cr.idJugador);
      if (nivelCircuito == null || cr.nivel < nivelCircuito) nivelCircuito = cr.nivel;
    }
    const nivel =
      nivelLiga == null
        ? nivelCircuito
        : nivelCircuito == null
          ? nivelLiga
          : Math.min(nivelLiga, nivelCircuito);
    const origenNivel: FcpPlayerCandidate["origenNivel"] =
      nivel == null
        ? null
        : nivelLiga === nivelCircuito
          ? "ambos"
          : nivel === nivelCircuito
            ? "circuito"
            : "liga";
    return {
      idJugador: String(p.rep.id_jugador),
      name,
      puntos: p.rep.puntos,
      nivel,
      categoriaDiv: nivel != null ? `${nivel}ª` : null,
      nivelLiga,
      nivelCircuito,
      origenNivel,
      equipo: p.rep.nombre_equipo,
      genero,
    };
  });

  // Quien SOLO juega circuito no está en `fcp_jugadores` (plantillas de liga):
  // lo añadimos desde el ranking. Sin puntos de LIGA (los que cuentan) → 0.
  for (const cr of circuitRows) {
    if (usedCircuit.has(cr.idJugador)) continue;
    if (out.length >= 8) break;
    out.push({
      idJugador: cr.idJugador,
      name: cr.name,
      puntos: 0,
      nivel: cr.nivel,
      categoriaDiv: `${cr.nivel}ª`,
      nivelLiga: null,
      nivelCircuito: cr.nivel,
      origenNivel: "circuito",
      equipo: null,
      genero: cr.genero,
    });
  }

  return out;
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

/* ── Federación · perfiles, cuadros y stats derivadas ────────────────
   Portado de TACTIUM/src/core/services/fcp{Profiles,Bracket,Season,Browse}.ts.
   Todo es lectura pública sobre fcp_* (migración 20260811c). Las columnas
   pj/pg de fcp_clasificacion llegan en 0 (el scrape de matriz no las rellena),
   así que se DERIVAN de fcp_partidos, exactamente igual que en la app. */

/** Normaliza un nombre para comparar entre temporadas / actas. */
const fcpNorm = (s: string | null | undefined): string =>
  (s ?? "")
    .toString()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Nombre tal como aparece en el acta: "nombre_pila apellido1". */
const fcpActaName = (r: {
  nombre_pila?: string | null;
  apellido1?: string | null;
}): string => `${(r.nombre_pila ?? "").trim()} ${(r.apellido1 ?? "").trim()}`.trim();

const fcpPair = (a: string | null, b: string | null): string =>
  [a, b].filter(Boolean).join(" / ") || "—";

/** "5ª CATEGORIA MASC." → "5ª Masc" (para la trayectoria por año). */
function fcpShortCatFromGroup(nombre: string | null): string | null {
  if (!nombre) return null;
  const m = nombre.match(/(\d+)\s*ª/);
  const g = /FEM/i.test(nombre) ? "Fem" : /MASC/i.test(nombre) ? "Masc" : "";
  const cat = m ? `${m[1]}ª` : "";
  return [cat, g].filter(Boolean).join(" ") || null;
}


/* ── Clasificación de grupo (con PJ/PG/racha derivados) ─────────────── */
export interface FcpGroupMeta {
  equiposCount: number;
  jornadaActual: number;
  jornadaTotal: number;
  estado: "finalizada" | "en_curso" | "sin_datos";
  live: boolean;
}

/** Meta de varios grupos a la vez (nº equipos, progreso de jornadas, estado). */
export async function fetchFcpGroupMetas(
  idGrupos: string[]
): Promise<Record<string, FcpGroupMeta>> {
  const out: Record<string, FcpGroupMeta> = {};
  if (idGrupos.length === 0) return out;
  const ids = idGrupos.slice(0, 200);
  const sb = supabaseBrowser();
  const [{ data: cls }, { data: parts }] = await Promise.all([
    sb.from("fcp_clasificacion").select("id_grupo").in("id_grupo", ids),
    sb.from("fcp_partidos").select("id_grupo, jornada, estado, fecha").in("id_grupo", ids),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const r of (cls ?? []) as { id_grupo: string }[]) {
    counts.set(r.id_grupo, (counts.get(r.id_grupo) ?? 0) + 1);
  }
  const agg = new Map<string, { total: number; actual: number; live: boolean }>();
  for (const p of (parts ?? []) as {
    id_grupo: string;
    jornada: number | null;
    estado: string | null;
    fecha: string | null;
  }[]) {
    const a = agg.get(p.id_grupo) ?? { total: 0, actual: 0, live: false };
    const j = p.jornada ?? 0;
    if (j > a.total) a.total = j;
    if (p.estado === "jugado" && j > a.actual) a.actual = j;
    if (p.estado !== "jugado" && (p.fecha ?? "").slice(0, 10) === today) a.live = true;
    agg.set(p.id_grupo, a);
  }
  for (const id of ids) {
    const a = agg.get(id) ?? { total: 0, actual: 0, live: false };
    out[id] = {
      equiposCount: counts.get(id) ?? 0,
      jornadaActual: a.actual,
      jornadaTotal: a.total,
      estado:
        a.total > 0 && a.actual >= a.total
          ? "finalizada"
          : a.actual > 0
            ? "en_curso"
            : "sin_datos",
      live: a.live,
    };
  }
  return out;
}

/* ── Equipo federado: perfil completo (hero + stats + racha + plantilla) ─
   La implementación vive en `fcp-public.ts` (compartida con el servidor). */
async function fetchFcpRoster(idEquipo: number): Promise<FcpRosterPlayer[]> {
  return fetchFcpRosterWith(supabaseBrowser(), idEquipo);
}

export async function fetchFcpTeamProfile(
  idEquipo: number
): Promise<FcpTeamProfile | null> {
  return fetchFcpTeamProfileWith(supabaseBrowser(), idEquipo);
}

/** Puesto del jugador dentro de su plantilla por puntos (Nº X en el equipo). */
export async function fetchFcpPlayerTeamRank(
  idEquipo: number,
  idJugador: string
): Promise<{ rank: number; total: number } | null> {
  const { data } = await supabaseBrowser()
    .from("fcp_jugadores")
    .select("id_jugador, puntos")
    .eq("id_equipo", idEquipo)
    .order("puntos", { ascending: false, nullsFirst: false });
  const rows = (data ?? []) as { id_jugador: string; puntos: number | null }[];
  const total = rows.length;
  const idx = rows.findIndex((r) => r.id_jugador === idJugador);
  if (idx < 0) return total ? { rank: 0, total } : null;
  return { rank: idx + 1, total };
}

/* ── Jugador federado: perfil + trayectoria por año + partidos ──────── */
export interface FcpPlayerProfile {
  idJugador: string;
  name: string;
  equipo: string | null;
  categoria: string | null;
  puntos: number;
  /** De `fcp_player_photos`, la tabla que se carga a mano. */
  avatarUrl: string | null;
}

export async function fetchFcpPlayerProfile(
  idJugador: string
): Promise<FcpPlayerProfile | null> {
  const { data } = await supabaseBrowser()
    .from("fcp_jugadores")
    .select("id_jugador, nombre_pila, apellido1, apellido2, nombre, categoria, puntos, nombre_equipo")
    .eq("id_jugador", idJugador)
    .maybeSingle();
  const j = data as
    | {
        nombre_pila: string | null;
        apellido1: string | null;
        apellido2: string | null;
        nombre: string | null;
        categoria: string | null;
        puntos: number | null;
        nombre_equipo: string | null;
      }
    | null;
  if (!j) return null;
  // La cara, de la tabla de fotos federativas. Mismo RPC que el acta.
  let avatarUrl: string | null = null;
  const { data: fotos } = await supabaseBrowser().rpc("fcp_player_avatars", {
    p_ids: [idJugador],
  });
  const f = ((fotos ?? []) as { avatar_url: string | null }[])[0];
  if (f) avatarUrl = f.avatar_url;

  return {
    idJugador,
    name: fcpDisplayName(j),
    equipo: j.nombre_equipo ?? null,
    categoria: j.categoria ?? null,
    puntos: j.puntos ?? 0,
    avatarUrl,
  };
}

export interface FcpPlayerYearTeam {
  anio: string;
  idLiga: number;
  idEquipo: number | null;
  equipo: string | null;
  categoria: string | null;
  puntos: number;
}

/** Trayectoria por temporada: en qué equipo jugó, categoría y puntos de ese año.
 *  Reconstruida a partir de las filas de fcp_jugadores (una por liga scrapeada). */
export async function fetchFcpPlayerYears(
  idJugador: string
): Promise<FcpPlayerYearTeam[]> {
  const sb = supabaseBrowser();
  const { data: jRaw } = await sb
    .from("fcp_jugadores")
    .select("nombre_pila, apellido1, apellido2")
    .eq("id_jugador", idJugador)
    .maybeSingle();
  const j = jRaw as
    | { nombre_pila: string | null; apellido1: string | null; apellido2: string | null }
    | null;
  if (!j || !j.nombre_pila || !j.apellido1) return [];

  const { data: rowsRaw } = await sb
    .from("fcp_jugadores")
    .select("id_liga, id_equipo, nombre_equipo, apellido2, puntos")
    .eq("nombre_pila", j.nombre_pila)
    .eq("apellido1", j.apellido1);
  const rows = ((rowsRaw ?? []) as {
    id_liga: number;
    id_equipo: number | null;
    nombre_equipo: string | null;
    apellido2: string | null;
    puntos: number | null;
  }[]).filter((r) => (r.apellido2 ?? "") === (j.apellido2 ?? ""));
  if (rows.length === 0) return [];

  const { data: ligas } = await sb.from("fcp_ligas").select("id_liga, temporada");
  const yearOf = new Map(
    ((ligas ?? []) as { id_liga: number; temporada: string | null }[]).map((l) => [
      l.id_liga,
      l.temporada ?? "",
    ])
  );

  // Categoría del equipo por año (id_equipo → grupo regular → nombre → "Nª Gen").
  const equipos = [...new Set(rows.map((r) => r.id_equipo).filter((x): x is number => x != null))];
  const catByEquipo = new Map<number, string | null>();
  if (equipos.length) {
    const { data: cls } = await sb
      .from("fcp_clasificacion")
      .select("id_equipo, id_grupo")
      .in("id_equipo", equipos);
    const grupoByEq = new Map<number, string>();
    for (const cRow of (cls ?? []) as { id_equipo: number; id_grupo: string }[]) {
      if (/^fase/i.test(cRow.id_grupo)) continue;
      if (!grupoByEq.has(cRow.id_equipo)) grupoByEq.set(cRow.id_equipo, cRow.id_grupo);
    }
    const grupos = [...new Set([...grupoByEq.values()])];
    const catByGrupo = new Map<string, string | null>();
    if (grupos.length) {
      const { data: gr } = await sb.from("fcp_grupos").select("id_grupo, nombre").in("id_grupo", grupos);
      for (const g of (gr ?? []) as { id_grupo: string; nombre: string | null }[]) {
        catByGrupo.set(g.id_grupo, fcpShortCatFromGroup(g.nombre));
      }
    }
    for (const [eq, grp] of grupoByEq) catByEquipo.set(eq, catByGrupo.get(grp) ?? null);
  }

  const byLiga = new Map<number, FcpPlayerYearTeam>();
  for (const r of rows) {
    const anio = yearOf.get(r.id_liga);
    if (!anio) continue;
    const cand: FcpPlayerYearTeam = {
      anio,
      idLiga: r.id_liga,
      idEquipo: r.id_equipo ?? null,
      equipo: r.nombre_equipo ?? null,
      categoria: r.id_equipo != null ? catByEquipo.get(r.id_equipo) ?? null : null,
      puntos: r.puntos ?? 0,
    };
    const cur = byLiga.get(r.id_liga);
    if (!cur || cand.puntos > cur.puntos) byLiga.set(r.id_liga, cand);
  }
  return [...byLiga.values()].sort((a, b) => b.anio.localeCompare(a.anio));
}

export interface FcpPlayerMatch {
  myPair: string;
  partner: string | null;
  rivalPair: string;
  parciales: string | null;
  sets: string;
  won: boolean;
  jornada: number | null;
  fecha: string | null;
  esPlayoff: boolean;
}
export interface FcpPlayerYearMatches {
  matches: FcpPlayerMatch[];
  pj: number;
  pg: number;
  pp: number;
  setsFor: number;
  setsAgainst: number;
  hasData: boolean;
}

/** Partidos + stats de un jugador en UNA temporada, desde fcp_actas (casando por
 *  nombre) y ordenados por jornada con fcp_partidos. */
export async function fetchFcpPlayerYearMatches(
  idJugador: string,
  idLiga: number
): Promise<FcpPlayerYearMatches> {
  const empty: FcpPlayerYearMatches = {
    matches: [],
    pj: 0,
    pg: 0,
    pp: 0,
    setsFor: 0,
    setsAgainst: 0,
    hasData: false,
  };
  const sb = supabaseBrowser();
  const { data: jRaw } = await sb
    .from("fcp_jugadores")
    .select("nombre_pila, apellido1")
    .eq("id_jugador", idJugador)
    .maybeSingle();
  const j = jRaw as { nombre_pila: string | null; apellido1: string | null } | null;
  if (!j || !j.nombre_pila || !j.apellido1) return empty;
  const actaName = `${j.nombre_pila.trim()} ${j.apellido1.trim()}`;

  const { data: any1 } = await sb
    .from("fcp_actas")
    .select("id_partido")
    .eq("id_liga", idLiga)
    .limit(1);
  const hasData = ((any1 ?? []) as unknown[]).length > 0;

  const cols =
    "id_partido, partido_num, local_j1, local_j2, visit_j1, visit_j2, sets_local, sets_visit, parciales";
  const bySlot = (col: string) =>
    sb.from("fcp_actas").select(cols).eq("id_liga", idLiga).eq(col, actaName);
  const results = await Promise.all([
    bySlot("local_j1"),
    bySlot("local_j2"),
    bySlot("visit_j1"),
    bySlot("visit_j2"),
  ]);

  type ActaRow = {
    id_partido: string;
    partido_num: number;
    local_j1: string | null;
    local_j2: string | null;
    visit_j1: string | null;
    visit_j2: string | null;
    sets_local: number | null;
    sets_visit: number | null;
    parciales: string | null;
  };
  const seen = new Set<string>();
  const rows: ActaRow[] = [];
  for (const res of results) {
    for (const r of (res.data ?? []) as ActaRow[]) {
      const k = `${r.id_partido}|${r.partido_num}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(r);
    }
  }

  let pj = 0;
  let pg = 0;
  let setsFor = 0;
  let setsAgainst = 0;
  const matches: FcpPlayerMatch[] = [];
  const baseIds: string[] = [];
  for (const a of rows) {
    const localHas = a.local_j1 === actaName || a.local_j2 === actaName;
    const sl = a.sets_local ?? 0;
    const sv = a.sets_visit ?? 0;
    const mine = localHas ? sl : sv;
    const other = localHas ? sv : sl;
    pj += 1;
    setsFor += mine;
    setsAgainst += other;
    const won = mine > other;
    if (won) pg += 1;
    const myPlayers = localHas ? [a.local_j1, a.local_j2] : [a.visit_j1, a.visit_j2];
    const partner = (myPlayers.find((x) => x && x !== actaName) ?? null) as string | null;
    baseIds.push(a.id_partido.replace(/_(ida|vuelta)$/i, ""));
    matches.push({
      myPair: localHas ? fcpPair(a.local_j1, a.local_j2) : fcpPair(a.visit_j1, a.visit_j2),
      partner,
      rivalPair: localHas ? fcpPair(a.visit_j1, a.visit_j2) : fcpPair(a.local_j1, a.local_j2),
      parciales: a.parciales,
      sets: `${mine}-${other}`,
      won,
      jornada: null,
      fecha: null,
      esPlayoff: /^fcp_playoff_/.test(a.id_partido),
    });
  }

  const uniqIds = [...new Set(baseIds)];
  if (uniqIds.length) {
    const { data: parts } = await sb
      .from("fcp_partidos")
      .select("id_partido, jornada, fecha")
      .in("id_partido", uniqIds);
    const byPartido = new Map<string, { jornada: number | null; fecha: string | null }>(
      ((parts ?? []) as { id_partido: string; jornada: number | null; fecha: string | null }[]).map(
        (p) => [p.id_partido, { jornada: p.jornada, fecha: p.fecha }]
      )
    );
    matches.forEach((m, i) => {
      const info = byPartido.get(baseIds[i]);
      m.jornada = info?.jornada ?? null;
      m.fecha = info?.fecha ?? null;
    });
  }
  matches.sort((a, b) => {
    const ja = a.jornada ?? 9999;
    const jb = b.jornada ?? 9999;
    if (ja !== jb) return ja - jb;
    return (a.esPlayoff ? 1 : 0) - (b.esPlayoff ? 1 : 0);
  });

  return { matches, pj, pg, pp: pj - pg, setsFor, setsAgainst, hasData };
}

/** Variación de puntos por temporada (del histórico FCP). Vacío si aún no se ha
 *  scrapeado su histórico. Se usa para el delta "▲ +N esta temporada". */
export async function fetchFcpPlayerHistory(
  idJugador: string
): Promise<{ anio: number; variacion: number }[]> {
  const sb = supabaseBrowser();
  const { data: jRaw } = await sb
    .from("fcp_jugadores")
    .select("nombre_pila, apellido1, apellido2")
    .eq("id_jugador", idJugador)
    .maybeSingle();
  const j = jRaw as
    | { nombre_pila: string | null; apellido1: string | null; apellido2: string | null }
    | null;
  if (!j) return [];
  const full = [j.nombre_pila, j.apellido1, j.apellido2]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(" ");
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
    .select("anio, puntos_var")
    .eq("id_fcp", idFcp);
  const byYear = new Map<number, number>();
  for (const r of (rows ?? []) as { anio: number | null; puntos_var: number | null }[]) {
    if (r.anio == null) continue;
    byYear.set(r.anio, (byYear.get(r.anio) ?? 0) + (r.puntos_var ?? 0));
  }
  return [...byYear.entries()]
    .map(([anio, variacion]) => ({ anio, variacion }))
    .sort((a, b) => b.anio - a.anio);
}

/* ── Actas (parejas + parciales por partido) ────────────────────────── */
export interface FcpActaPartido {
  partidoNum: number;
  localJ1: string | null;
  localJ2: string | null;
  visitJ1: string | null;
  visitJ2: string | null;
  setsLocal: number | null;
  setsVisit: number | null;
  parciales: string | null;
  ganador: string | null;
}

function mapActa(r: {
  partido_num: number;
  local_j1: string | null;
  local_j2: string | null;
  visit_j1: string | null;
  visit_j2: string | null;
  sets_local: number | null;
  sets_visit: number | null;
  parciales: string | null;
  ganador: string | null;
}): FcpActaPartido {
  return {
    partidoNum: r.partido_num,
    localJ1: r.local_j1,
    localJ2: r.local_j2,
    visitJ1: r.visit_j1,
    visitJ2: r.visit_j2,
    setsLocal: r.sets_local,
    setsVisit: r.sets_visit,
    parciales: r.parciales,
    ganador: r.ganador,
  };
}

const ACTA_COLS =
  "partido_num, local_j1, local_j2, visit_j1, visit_j2, sets_local, sets_visit, parciales, ganador";

export async function fetchFcpActa(idPartido: string): Promise<FcpActaPartido[]> {
  const { data, error } = await supabaseBrowser()
    .from("fcp_actas")
    .select(ACTA_COLS)
    .eq("id_partido", idPartido)
    .order("partido_num", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapActa);
}

/** Todas las actas de un grupo, indexadas por id_partido — una sola consulta,
 *  para pintar los parciales inline en la vista de jornadas sin N+1. */
export async function fetchFcpGroupActas(
  idGrupo: string
): Promise<Record<string, FcpActaPartido[]>> {
  const { data, error } = await supabaseBrowser()
    .from("fcp_actas")
    .select(
      "id_partido, partido_num, local_j1, local_j2, visit_j1, visit_j2, sets_local, sets_visit, parciales, ganador"
    )
    .eq("id_grupo", idGrupo)
    .order("partido_num", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as ({ id_partido: string } & Parameters<
    typeof mapActa
  >[0])[];
  const out: Record<string, FcpActaPartido[]> = {};
  for (const r of rows) {
    (out[r.id_partido] ??= []).push(mapActa(r));
  }
  return out;
}

/* ── Quién juega cada punto del acta ─────────────────────────────────
   El acta guarda los nombres como TEXTO («JULIA ROJO»), no el id del
   jugador, así que para poner cara y puntos a cada pareja hay que cruzar
   ese texto con `fcp_jugadores`. Se cruza SÓLO contra los equipos del
   grupo: el mismo jugador tiene una ficha por equipo y temporada, y sin
   acotar saldrían los puntos de otro año. ────────────────────────────── */

export interface FcpActaPlayerInfo {
  idJugador: string;
  puntos: number;
  /** Foto de su cuenta TACTIUM, si ha reclamado su ficha federativa. */
  avatarUrl: string | null;
}

/** Clave de cruce: el acta escribe «NOMBRE APELLIDO1», sin tildes ni orden
 *  fijo de espacios. Se normaliza a mayúsculas sin acentos. */
export function fcpNameKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFcpGroupPlayerIndex(
  idGrupo: string
): Promise<Record<string, FcpActaPlayerInfo>> {
  const sb = supabaseBrowser();
  const { data: cls } = await sb
    .from("fcp_clasificacion")
    .select("id_equipo")
    .eq("id_grupo", idGrupo);
  const equipos = [...new Set(((cls ?? []) as { id_equipo: number }[]).map((c) => c.id_equipo))];
  if (equipos.length === 0) return {};

  const { data: jug } = await sb
    .from("fcp_jugadores")
    .select("id_jugador, nombre_pila, apellido1, puntos")
    .in("id_equipo", equipos);

  const rows = (jug ?? []) as {
    id_jugador: string;
    nombre_pila: string | null;
    apellido1: string | null;
    puntos: number | null;
  }[];

  const out: Record<string, FcpActaPlayerInfo> = {};
  for (const r of rows) {
    if (!r.nombre_pila || !r.apellido1) continue;
    const key = fcpNameKey(`${r.nombre_pila} ${r.apellido1}`);
    // Con dos fichas del mismo nombre en el grupo manda la de más puntos:
    // es la del equipo con el que está jugando esta temporada.
    const prev = out[key];
    if (prev && prev.puntos >= (r.puntos ?? 0)) continue;
    out[key] = { idJugador: r.id_jugador, puntos: r.puntos ?? 0, avatarUrl: null };
  }

  // Fotos, por RPC y no leyendo `profiles`: la RLS de esa tabla sólo deja
  // ver la propia y la de compañeros de equipo o club, así que en un grupo
  // ajeno salían todos con iniciales. `fcp_player_avatars` devuelve SÓLO el
  // par (ficha federativa → foto), y sólo de quien ha vinculado su ficha.
  // Tiene tope de 300 por llamada, de ahí el troceado.
  const ids = Object.values(out).map((v) => v.idJugador);
  if (ids.length > 0) {
    const byId = new Map<string, string | null>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data: fotos } = await sb.rpc("fcp_player_avatars", {
        p_ids: ids.slice(i, i + 300),
      });
      for (const f of (fotos ?? []) as {
        fcp_id_jugador: string;
        avatar_url: string | null;
      }[]) {
        byId.set(f.fcp_id_jugador, f.avatar_url);
      }
    }
    for (const v of Object.values(out)) {
      v.avatarUrl = byId.get(v.idJugador) ?? null;
    }
  }

  return out;
}

/* ── Cuadro de playoff (bracket) ────────────────────────────────────── */
export interface FcpBracketTie {
  idPartido: string;
  cuadro: string;
  avance: number;
  posicion: number;
  ronda: string | null;
  local: string | null;
  visit: string | null;
  marcador: string | null;
  ganador: string | null;
  estado: string | null;
  /** Fecha y sede de cada manga, tal como las publica la FCP (texto libre;
   *  a menudo vienen vacías). Opcionales para no romper a quien ya las usa. */
  fechaIda?: string | null;
  fechaVuelta?: string | null;
  lugarIda?: string | null;
  lugarVuelta?: string | null;
  /** Partidos ganados en cada manga, contados de las actas y orientados al
   *  cruce (l = equipo `local` del cruce, v = `visit`, también en la vuelta,
   *  donde juegan con los papeles cambiados). Null si esa manga no tiene acta. */
  idaScore?: { l: number; v: number } | null;
  vueltaScore?: { l: number; v: number } | null;
}
export interface FcpBracketRound {
  avance: number;
  label: string;
  ties: FcpBracketTie[];
}
export interface FcpBracketCuadro {
  key: string;
  label: string;
  rounds: FcpBracketRound[];
}
export interface FcpBracket {
  cuadros: FcpBracketCuadro[];
}

const PRINCIPAL_LABEL: Record<number, string> = { 1: "Final", 2: "Semifinal", 3: "Cuartos" };
function bracketRoundLabel(cuadro: string, avance: number, ties: FcpBracketTie[]): string {
  if (cuadro === "Final" && PRINCIPAL_LABEL[avance]) return PRINCIPAL_LABEL[avance];
  const r = ties.find((t) => t.ronda && t.ronda.trim())?.ronda;
  if (r) return r;
  return cuadro === "Consola" ? `Consolación R${avance}` : `Ronda ${avance}`;
}

export async function fetchFcpBracket(idGrupo: string): Promise<FcpBracket> {
  const sb = supabaseBrowser();
  const [{ data }, { data: actas }] = await Promise.all([
    sb
      .from("fcp_partidos")
      .select(
        "id_partido, cuadro, avance, posicion_bracket, ronda, equipo_local, equipo_visit, ganador, estado, fecha_ida, fecha_vuelta, lugar_ida, lugar_vuelta"
      )
      .eq("id_grupo", idGrupo)
      .like("id_partido", "fcp_playoff_%"),
    sb
      .from("fcp_actas")
      .select("id_partido, ganador")
      .eq("id_grupo", idGrupo)
      .like("id_partido", "fcp_playoff_%"),
  ]);

  // Marcador real (partidos ganados) por eliminatoria, desde las actas. En la
  // VUELTA los roles se invierten.
  const score = new Map<string, { l: number; v: number }>();
  // Lo mismo, manga a manga (para el «Recorrido de tu equipo»).
  const legScore = new Map<string, { l: number; v: number }>();
  for (const a of (actas ?? []) as { id_partido: string; ganador: string | null }[]) {
    const m = a.id_partido.match(/^(.*)_(ida|vuelta)$/);
    if (!m) continue;
    const tieId = m[1];
    const ida = m[2] === "ida";
    const s = score.get(tieId) ?? { l: 0, v: 0 };
    const legKey = `${tieId}|${m[2]}`;
    const leg = legScore.get(legKey) ?? { l: 0, v: 0 };
    if (a.ganador === "local") {
      ida ? s.l++ : s.v++;
      ida ? leg.l++ : leg.v++;
    } else if (a.ganador === "visitante") {
      ida ? s.v++ : s.l++;
      ida ? leg.v++ : leg.l++;
    }
    score.set(tieId, s);
    legScore.set(legKey, leg);
  }

  const ties: FcpBracketTie[] = ((data ?? []) as {
    id_partido: string;
    cuadro: string | null;
    avance: number | null;
    posicion_bracket: number | null;
    ronda: string | null;
    equipo_local: string | null;
    equipo_visit: string | null;
    ganador: string | null;
    estado: string | null;
    fecha_ida: string | null;
    fecha_vuelta: string | null;
    lugar_ida: string | null;
    lugar_vuelta: string | null;
  }[]).map((r) => {
    const s = score.get(r.id_partido);
    const txt = (v: string | null) => (v && v.trim() ? v.trim() : null);
    return {
      idPartido: r.id_partido,
      cuadro: r.cuadro || "Final",
      avance: r.avance ?? 0,
      posicion: r.posicion_bracket ?? 0,
      ronda: r.ronda ?? null,
      local: r.equipo_local ?? null,
      visit: r.equipo_visit ?? null,
      marcador: s && s.l + s.v > 0 ? `${s.l}-${s.v}` : null,
      ganador: r.ganador ?? null,
      estado: r.estado ?? null,
      fechaIda: txt(r.fecha_ida),
      fechaVuelta: txt(r.fecha_vuelta),
      lugarIda: txt(r.lugar_ida),
      lugarVuelta: txt(r.lugar_vuelta),
      idaScore: legScore.get(`${r.id_partido}|ida`) ?? null,
      vueltaScore: legScore.get(`${r.id_partido}|vuelta`) ?? null,
    };
  });

  const CUADRO_ORDER = ["Final", "Consola"];
  const byCuadro = new Map<string, FcpBracketTie[]>();
  for (const t of ties) {
    if (!byCuadro.has(t.cuadro)) byCuadro.set(t.cuadro, []);
    byCuadro.get(t.cuadro)!.push(t);
  }

  const cuadros: FcpBracketCuadro[] = [...byCuadro.keys()]
    .sort((a, b) => {
      const ia = CUADRO_ORDER.indexOf(a);
      const ib = CUADRO_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map((key) => {
      const arr = byCuadro.get(key)!;
      const byAv = new Map<number, FcpBracketTie[]>();
      for (const t of arr) {
        if (!byAv.has(t.avance)) byAv.set(t.avance, []);
        byAv.get(t.avance)!.push(t);
      }
      const rounds: FcpBracketRound[] = [...byAv.entries()]
        .sort((a, b) => b[0] - a[0]) // avance DESC → primera ronda izq, final der
        .map(([avance, ts]) => ({
          avance,
          label: bracketRoundLabel(key, avance, ts),
          ties: ts.sort((x, y) => x.posicion - y.posicion),
        }));
      return {
        key,
        label: key === "Consola" ? "Consolación" : "Cuadro principal",
        rounds,
      };
    });

  return { cuadros };
}

export interface FcpBracketTieActa {
  ida: FcpActaPartido[];
  vuelta: FcpActaPartido[];
}

/** Acta de un cruce de playoff: sus dos mangas (ida + vuelta). */
export async function fetchFcpBracketTieActa(
  tieId: string
): Promise<FcpBracketTieActa> {
  const [ida, vuelta] = await Promise.all([
    fetchFcpActa(`${tieId}_ida`),
    fetchFcpActa(`${tieId}_vuelta`),
  ]);
  return { ida, vuelta };
}

/** ¿Coinciden dos nombres de equipo? (normalizado). */
export function fcpSameTeam(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = fcpNorm(a);
  const nb = fcpNorm(b);
  return !!na && na === nb;
}

/* ── Cuenta ──────────────────────────────────────────────────────── */

/**
 * Buckets donde el usuario guarda ficheros SUYOS, con el prefijo de su carpeta.
 * `delete_my_account` borra las filas de la base de datos pero no toca Storage,
 * así que sin esto la foto de alguien que pidió borrarlo todo se queda en el
 * bucket. No se puede hacer desde la RPC: borrar de `storage.objects` por SQL
 * deja el fichero huérfano en el bucket (Supabase lo bloquea justo por eso), y
 * la API de Storage sólo se puede llamar desde el cliente, mientras la sesión
 * sigue viva.
 */
const OWN_FILE_BUCKETS: { bucket: string; dir: (userId: string) => string }[] = [
  { bucket: "avatars", dir: (u) => u },
  { bucket: "post-media", dir: (u) => u },
  { bucket: "venue-logos", dir: (u) => u },
  { bucket: "match-photos", dir: (u) => `casual/${u}` },
];

/**
 * Borra los ficheros del usuario antes de eliminar su cuenta.
 *
 * Es best-effort a propósito: si Storage falla, la cuenta se borra igual. Que
 * la eliminación pueda completarse SIEMPRE es requisito de Apple (5.1.1 v) y,
 * sobre todo, es lo que el usuario ha pedido.
 */
async function purgeMyFiles(userId: string): Promise<void> {
  const sb = supabaseBrowser();
  // En paralelo: en fila son cuatro idas y venidas a Storage y el usuario se
  // queda mirando «Eliminando…» unos diez segundos.
  await Promise.all(
    OWN_FILE_BUCKETS.map(async ({ bucket, dir }) => {
      try {
        const folder = dir(userId);
        const { data } = await sb.storage.from(bucket).list(folder);
        const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
        if (paths.length > 0) await sb.storage.from(bucket).remove(paths);
      } catch {
        /* nunca bloquea el borrado de la cuenta */
      }
    }),
  );
}

/**
 * Elimina la cuenta del usuario logueado (RPC SECURITY DEFINER
 * `delete_my_account`, la misma que usa la app).
 *
 * Borra SIEMPRE: si quedaba una suscripción de App Store o Google Play, esa
 * sigue viva y hay que cancelarla aparte — por eso el diálogo lo avisa antes.
 * El `DELETE FROM auth.users` arrastra en cascada perfil, clubes, equipos,
 * temporadas, jornadas y alineaciones.
 *
 * Después de llamar hay que hacer `signOut()`: el JWT del cliente sigue en
 * memoria apuntando a un usuario que ya no existe.
 */
export async function deleteMyAccount(): Promise<void> {
  const sb = supabaseBrowser();
  // Primero los ficheros, que después de borrar la cuenta ya no hay permiso
  // para tocarlos: la RLS de Storage exige `auth.uid()` = su carpeta.
  const { data: auth } = await sb.auth.getUser();
  if (auth.user?.id) await purgeMyFiles(auth.user.id);

  const { error } = await sb.rpc("delete_my_account");
  if (error) throw error;
}

/* ── Perfil propio ───────────────────────────────────────────────── */

/**
 * Nombre y nombre de usuario. Espejo de `setMyUsername` de la app: además de
 * `profiles` hay que tocar los metadatos de auth, porque de ahí sale el nombre
 * que se ve mientras la sesión no se recarga.
 */
export async function updateMyProfile(input: {
  fullName: string;
  username: string | null;
}): Promise<void> {
  const sb = supabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sin sesión activa");

  const username = input.username?.trim() || null;
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("El nombre no puede quedar vacío");

  const { error } = await sb
    .from("profiles")
    .update({ full_name: fullName, username })
    .eq("id", userId);
  if (error) {
    // 23505 = unique_violation → el nombre de usuario ya está cogido. Sin este
    // caso, el usuario vería el error crudo de Postgres.
    if ((error as { code?: string }).code === "23505") {
      throw new Error("Ese nombre de usuario ya está en uso. Prueba otro.");
    }
    throw error;
  }

  const { error: authErr } = await sb.auth.updateUser({
    data: { username, full_name: fullName },
  });
  if (authErr) throw authErr;
}

const AVATAR_BUCKET = "avatars";

/**
 * Sube el avatar al bucket público `avatars` y deja la URL en
 * `profiles.avatar_url`. Misma estructura de rutas que la app
 * (`{user_id}/avatar_{timestamp}.{ext}`): el timestamp va en el nombre para
 * que cambie la URL pública y el CDN no siga sirviendo la foto vieja.
 */
export async function uploadMyAvatar(file: File): Promise<string> {
  const sb = supabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sin sesión activa");

  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo tiene que ser una imagen");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen no puede pesar más de 5 MB");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `avatar_${Date.now()}.${ext}`;
  const path = `${userId}/${filename}`;

  const { error: upErr } = await sb.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) throw upErr;

  // Limpieza de los anteriores: si no, cada cambio deja basura en storage.
  // Que falle no invalida la subida, así que no se propaga.
  try {
    const { data: files } = await sb.storage.from(AVATAR_BUCKET).list(userId);
    const old = (files ?? [])
      .filter((f) => f.name !== filename)
      .map((f) => `${userId}/${f.name}`);
    if (old.length > 0) await sb.storage.from(AVATAR_BUCKET).remove(old);
  } catch {
    /* basura en storage, no es motivo para fallar */
  }

  const {
    data: { publicUrl },
  } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { error } = await sb
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);
  if (error) throw error;

  return publicUrl;
}

/** Quita el avatar: borra los ficheros del usuario y limpia la columna. */
export async function deleteMyAvatar(): Promise<void> {
  const sb = supabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sin sesión activa");

  const { data: files } = await sb.storage.from(AVATAR_BUCKET).list(userId);
  if (files && files.length > 0) {
    await sb.storage
      .from(AVATAR_BUCKET)
      .remove(files.map((f) => `${userId}/${f.name}`));
  }

  const { error } = await sb
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Volcado completo de datos personales (RGPD art. 20, portabilidad). Lo genera
 * el servidor con la RPC `export_my_data`, la misma que la app: exportar solo
 * lo que se ve en pantalla no cumple el derecho de portabilidad.
 */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseBrowser().rpc("export_my_data");
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

/* ── Acciones destructivas y de gestión (paridad con la app) ─────── */

/** Borra un equipo. La RPC `delete_team` pre-borra alineaciones y
 *  disponibilidad: el orden de las cascadas no es trivial y por eso no se
 *  hace con un DELETE a pelo. */
export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("delete_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
}

/** Borra un club entero. Bloquea si tiene una suscripción activa, y borra los
 *  equipos explícitamente antes (`teams.club_id` es SET NULL: sin eso los
 *  equipos quedarían huérfanos en vez de borrarse). */
export async function deleteClub(clubId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("delete_club", {
    p_club_id: clubId,
  });
  if (error) throw error;
}

/** Cubre un equipo con la suscripción del club (consume una plaza del plan). */
export async function coverTeam(teamId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("cover_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
}

/** El capitán desvincula a un jugador de la cuenta a la que estaba atado. */
export async function captainUnclaimPlayer(playerId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("captain_unclaim_player", {
    p_player_id: playerId,
  });
  if (error) throw error;
}

/** Renumera las jornadas de una temporada (1..N por fecha), tras borrar o
 *  reordenar alguna. */
export async function renumberSeasonMatchdays(seasonId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("renumber_season_matchdays", {
    target_season: seasonId,
  });
  if (error) throw error;
}

/** Marca qué variante de alineación es la oficial (la que ve la plantilla). */
export async function setActiveLineupVariant(variantId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc("set_active_lineup_variant", {
    p_variant_id: variantId,
  });
  if (error) throw error;
}

/** Copia las parejas de una variante a otra, para partir de algo en vez de
 *  montar la alternativa desde cero. */
export async function cloneLineupVariantPairs(
  sourceVariantId: string,
  targetVariantId: string,
): Promise<void> {
  const { error } = await supabaseBrowser().rpc("clone_lineup_variant_pairs", {
    p_source_variant_id: sourceVariantId,
    p_target_variant_id: targetVariantId,
  });
  if (error) throw error;
}

/** Borra una jornada. */
export async function deleteMatchday(matchdayId: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("matchdays")
    .delete()
    .eq("id", matchdayId);
  if (error) throw error;
}

/** Borra un torneo. */
export async function deleteTournament(tournamentId: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("tournaments")
    .delete()
    .eq("id", tournamentId);
  if (error) throw error;
}

/* ── Torneos · acciones de organización (paridad con la app) ─────── */

/** Mueve una inscripción a otra categoría o género sin perder nada. */
export async function moveRegistration(
  regId: string,
  gender: string,
  category: string,
): Promise<void> {
  const { error } = await supabaseBrowser().rpc("tournament_move_registration", {
    p_reg_id: regId,
    p_gender: gender,
    p_category: category,
  });
  if (error) throw error;
}

/** Vuelca una categoría entera sobre otra (agrupar cuando se quedan pocas
 *  parejas). `closeSource` deja la de origen cerrada a nuevas inscripciones. */
export async function mergeDivision(input: {
  tournamentId: string;
  fromGender: string;
  fromCategory: string;
  toGender: string;
  toCategory: string;
  closeSource: boolean;
}): Promise<void> {
  const { error } = await supabaseBrowser().rpc("tournament_merge_division", {
    p_tournament_id: input.tournamentId,
    p_from_gender: input.fromGender,
    p_from_category: input.fromCategory,
    p_to_gender: input.toGender,
    p_to_category: input.toCategory,
    p_close_source: input.closeSource,
  });
  if (error) throw error;
}

/** Texto estándar de condiciones de participación, para partir de algo. */
export async function defaultTournamentTerms(): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc(
    "tournament_default_terms",
  );
  if (error) throw error;
  return (data as string) ?? "";
}

/** Vacía el horario del torneo: deja todos los partidos sin hora ni pista. */
export async function clearTournamentSchedule(
  tournamentId: string,
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("tournament_matches")
    .update({ scheduled_at: null, court: null })
    .eq("tournament_id", tournamentId);
  if (error) throw error;
}

export interface DbPairStat {
  a: string;
  b: string;
  wins: number;
  played: number;
}

/**
 * Estadísticas por pareja de un equipo: con quién funciona cada jugador. La
 * RPC devuelve ids, así que el nombre lo pone el llamador con la plantilla.
 */
export async function fetchTeamPairStats(
  teamId: string,
): Promise<DbPairStat[]> {
  const { data, error } = await supabaseBrowser().rpc("team_pair_stats", {
    p_team_id: teamId,
  });
  if (error) throw error;
  return ((data ?? []) as {
    player_a: string;
    player_b: string;
    wins: number;
    played: number;
  }[]).map((r) => ({
    a: r.player_a,
    b: r.player_b,
    wins: r.wins ?? 0,
    played: r.played ?? 0,
  }));
}

/**
 * Coloca (o quita) un partido en el horario.
 *
 * `court` es TEXTO con el formato «Pista N», igual que escribe la app: si aquí
 * se guardara un número, los dos horarios dejarían de entenderse.
 */
export async function setMatchSlot(
  matchId: string,
  scheduledAt: string | null,
  court: string | null,
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("tournament_matches")
    .update({ scheduled_at: scheduledAt, court })
    .eq("id", matchId);
  if (error) throw error;
}

/**
 * Días asignados a cada fase, como mapa "bracket:round" → fechas ISO.
 *
 * Misma clave y misma tabla que la app (`tournament_phase_days`): una fase
 * puede repartirse en varios días —los grupos en tres, por ejemplo— y todos los
 * cuadros (oro/plata/consolación) comparten los días de su ronda.
 */
export async function fetchPhaseDays(
  tournamentId: string,
): Promise<Record<string, string[]>> {
  const { data, error } = await supabaseBrowser()
    .from("tournament_phase_days")
    .select("bracket, round, play_date")
    .eq("tournament_id", tournamentId)
    .order("play_date", { ascending: true });
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const r of (data ?? []) as {
    bracket: string;
    round: number;
    play_date: string;
  }[]) {
    const k = `${r.bracket}:${r.round}`;
    (map[k] ??= []).push(r.play_date);
  }
  return map;
}

/** Añade o quita un día de una fase. */
export async function togglePhaseDay(
  tournamentId: string,
  bracket: string,
  round: number,
  playDate: string,
  on: boolean,
): Promise<void> {
  const sb = supabaseBrowser();
  if (on) {
    const { error } = await sb.from("tournament_phase_days").upsert(
      {
        tournament_id: tournamentId,
        bracket,
        round,
        play_date: playDate,
      },
      { onConflict: "tournament_id,bracket,round,play_date" },
    );
    if (error) throw error;
    return;
  }
  const { error } = await sb
    .from("tournament_phase_days")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("bracket", bracket)
    .eq("round", round)
    .eq("play_date", playDate);
  if (error) throw error;
}

/* ── Variantes de alineación ─────────────────────────────────────── */

/**
 * Crea una variante nueva para la jornada. El trigger `lineup_variants_max_5`
 * corta en 5 por jornada con un mensaje legible, así que no se duplica aquí la
 * regla: se deja hablar a la base de datos.
 */
export async function createLineupVariant(
  matchdayId: string,
  label: string,
): Promise<{ id: string; label: string }> {
  const { data, error } = await supabaseBrowser()
    .from("lineup_variants")
    .insert({ matchday_id: matchdayId, label })
    .select("id, label")
    .single();
  if (error) throw error;
  return data as { id: string; label: string };
}

/** Renombra una variante. */
export async function renameLineupVariant(
  id: string,
  label: string,
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("lineup_variants")
    .update({ label })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Borra una variante. La oficial NO se borra: la jornada se quedaría sin
 * alineación que leer y el acta no sabría de dónde tirar. Esa regla la impone
 * el cliente —igual que en la app—, porque la base de datos sí lo permitiría.
 */
export async function deleteLineupVariant(id: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("lineup_variants")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
