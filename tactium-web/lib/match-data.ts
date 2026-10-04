/**
 * Datos del bloque «Partido» (alineación, resultados, amistosos y detalle de
 * partido). Espejo de los servicios de la app
 * (TACTIUM/src/core/services/casualMatches.ts, social.ts, push) que la web no
 * tenía. Sin RPCs nuevas: todo existe ya en producción.
 *
 * Las escrituras pasan por `guardedWrite` en el llamador.
 */
import { supabaseBrowser } from "./supabase/client";

/* ── Jornada pública (vista de cualquiera) ───────────────────────── */
export interface PublicMatchdayCourt {
  court_number: number;
  forfeit?: boolean;
  forfeit_us?: boolean | null;
  pair?: string | null;
  sets: { us: number; them: number }[];
}

export interface PublicMatchday {
  id: string;
  jornada_number: number | null;
  match_date: string | null;
  opponent: string | null;
  is_home: boolean | null;
  score_for: number | null;
  score_against: number | null;
  outcome: string | null;
  photo_url: string | null;
  team_name: string | null;
  category: string | null;
  group_name: string | null;
  courts: PublicMatchdayCourt[];
  /** Migración 20261004_partido_kudos_detalle (sin aplicar): opcionales. */
  kudos_count?: number | null;
  i_gave_kudos?: boolean | null;
}

/** RPC `public_get_matchday` (SECURITY DEFINER, también para anon). */
export async function fetchPublicMatchday(id: string): Promise<PublicMatchday | null> {
  const { data, error } = await supabaseBrowser().rpc("public_get_matchday", { p_id: id });
  if (error) throw error;
  return ((data ?? []) as PublicMatchday[])[0] ?? null;
}

/* ── Kudos ───────────────────────────────────────────────────────── */
/**
 * Recuento de kudos leyendo `activity_kudos` (la RLS deja leer a cualquiera
 * con sesión). null si no se puede: el contador se oculta.
 */
export async function fetchKudosSummary(
  kind: "casual" | "league",
  targetId: string,
  userId: string | null,
): Promise<{ count: number; given: boolean } | null> {
  try {
    const { data, error } = await supabaseBrowser()
      .from("activity_kudos")
      .select("user_id")
      .eq("target_kind", kind)
      .eq("target_id", targetId);
    if (error) return null;
    const rows = (data ?? []) as { user_id: string }[];
    return { count: rows.length, given: !!userId && rows.some((r) => r.user_id === userId) };
  } catch {
    return null;
  }
}

/* ── Aviso de alineación publicada ───────────────────────────────── */
/** Push «Ya está la alineación» (edge `send-push`, como la app). Best-effort. */
export async function notifyLineupPublished(matchdayId: string): Promise<void> {
  try {
    await supabaseBrowser().functions.invoke("send-push", {
      body: { type: "lineup_published", matchdayId },
    });
  } catch {
    /* la alineación ya está guardada */
  }
}

/* ── Amistosos ───────────────────────────────────────────────────── */
export interface CasualParticipantInput {
  side: 0 | 1;
  slot: 0 | 1;
  name: string;
  user_id: string | null;
}

/** RPC `create_casual_match` (la misma que la app). Devuelve el id. */
export async function createCasualMatch(input: {
  type: "amistoso" | "entreno";
  sets: [number, number][];
  participants: CasualParticipantInput[];
}): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc("create_casual_match", {
    p_type: input.type,
    p_played_on: null,
    p_sets: input.sets,
    p_visibility: "public",
    p_participants: input.participants,
  });
  if (error) throw error;
  return data as string;
}

export interface FrequentPartner {
  name: string;
  user_id: string | null;
  times: number;
}

/** Gente de tus amistosos anteriores (como `fetchMyFrequentPartners`). */
export async function fetchFrequentPartners(userId: string): Promise<FrequentPartner[]> {
  const sb = supabaseBrowser();
  const { data: mine, error: e1 } = await sb
    .from("casual_match_participants")
    .select("match_id")
    .eq("user_id", userId);
  if (e1) throw e1;
  const ids = [...new Set(((mine ?? []) as { match_id: string }[]).map((r) => r.match_id))];
  if (ids.length === 0) return [];
  const { data: all, error: e2 } = await sb
    .from("casual_match_participants")
    .select("name, user_id")
    .in("match_id", ids);
  if (e2) throw e2;
  const map = new Map<string, FrequentPartner>();
  for (const r of (all ?? []) as { name: string | null; user_id: string | null }[]) {
    const name = (r.name ?? "").trim();
    if (!name || r.user_id === userId) continue;
    const key = name.toLowerCase();
    const cur = map.get(key);
    if (cur) {
      cur.times++;
      if (!cur.user_id && r.user_id) cur.user_id = r.user_id;
    } else map.set(key, { name, user_id: r.user_id, times: 1 });
  }
  return [...map.values()].sort((a, b) => b.times - a.times).slice(0, 12);
}

export interface CasualDetail {
  id: string;
  type: string;
  playedOn: string | null;
  photoUrl: string | null;
  createdBy: string | null;
  winnerSide: number | null;
  sets: [number, number][];
  claimCode: string | null;
  participants: { side: number; slot: number; name: string; user_id: string | null }[];
}

export async function fetchCasualDetail(id: string): Promise<CasualDetail | null> {
  const { data, error } = await supabaseBrowser()
    .from("casual_matches")
    .select(
      "id, type, played_on, photo_url, created_by, winner_side, sets, claim_code, casual_match_participants(side, slot, name, user_id)",
    )
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const m = ((data ?? []) as Record<string, unknown>[])[0];
  if (!m) return null;
  const parts = ((m.casual_match_participants ?? []) as CasualDetail["participants"])
    .slice()
    .sort((a, b) => a.side - b.side || a.slot - b.slot);
  return {
    id: m.id as string,
    type: (m.type as string) ?? "amistoso",
    playedOn: (m.played_on as string | null) ?? null,
    photoUrl: (m.photo_url as string | null) ?? null,
    createdBy: (m.created_by as string | null) ?? null,
    winnerSide: (m.winner_side as number | null) ?? null,
    sets: (Array.isArray(m.sets) ? m.sets : []) as [number, number][],
    claimCode: (m.claim_code as string | null) ?? null,
    participants: parts,
  };
}

/** Código de reclamo de un amistoso recién creado. */
export async function fetchClaimCode(matchId: string): Promise<string | null> {
  const { data } = await supabaseBrowser()
    .from("casual_matches")
    .select("claim_code")
    .eq("id", matchId)
    .limit(1);
  return ((data ?? []) as { claim_code: string | null }[])[0]?.claim_code ?? null;
}

/** Foto del amistoso: bucket `match-photos`, ruta `casual/{uid}/{id}.jpg`. */
export async function uploadCasualPhoto(userId: string, matchId: string, file: File): Promise<string> {
  const sb = supabaseBrowser();
  const path = `casual/${userId}/${matchId}.jpg`;
  const { error: upErr } = await sb.storage
    .from("match-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
  if (upErr) throw upErr;
  const {
    data: { publicUrl },
  } = sb.storage.from("match-photos").getPublicUrl(path);
  const url = `${publicUrl}?v=${Date.now()}`;
  const { error } = await sb.from("casual_matches").update({ photo_url: url }).eq("id", matchId);
  if (error) throw error;
  return url;
}

/* ── Cara a cara (espejo de fetchCasualH2H de la app) ────────────── */
export interface CasualH2H {
  pair: { wins: number; losses: number; total: number } | null;
  individuals: { name: string; user_id: string | null; wins: number; losses: number; total: number }[];
}

export async function fetchCasualH2H(userId: string, matchId: string): Promise<CasualH2H> {
  const sb = supabaseBrowser();
  const { data: mine, error: e1 } = await sb
    .from("casual_match_participants")
    .select("match_id")
    .eq("user_id", userId);
  if (e1) throw e1;
  const ids = [...new Set(((mine ?? []) as { match_id: string }[]).map((r) => r.match_id))];
  if (ids.length === 0) return { pair: null, individuals: [] };
  const [pRes, mRes] = await Promise.all([
    sb.from("casual_match_participants").select("match_id, side, slot, name, user_id").in("match_id", ids),
    sb.from("casual_matches").select("id, winner_side").in("id", ids),
  ]);
  if (pRes.error) throw pRes.error;
  if (mRes.error) throw mRes.error;
  type P = { match_id: string; side: number; slot: number; name: string | null; user_id: string | null };
  const winnerById = new Map(
    ((mRes.data ?? []) as { id: string; winner_side: number | null }[]).map((m) => [m.id, m.winner_side]),
  );
  const byMatch = new Map<string, P[]>();
  for (const r of (pRes.data ?? []) as P[]) {
    const l = byMatch.get(r.match_id) ?? [];
    l.push(r);
    byMatch.set(r.match_id, l);
  }
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  const keyOf = (p: P) => p.user_id ?? `n:${norm(p.name)}`;
  const pairKeyOf = (arr: P[]) => arr.map(keyOf).sort().join("|");

  const target = byMatch.get(matchId);
  if (!target) return { pair: null, individuals: [] };
  const mySide = target.find((p) => p.user_id === userId)?.side ?? 0;
  const ourKey = pairKeyOf(target.filter((p) => p.side === mySide));
  const rivals = target.filter((p) => p.side !== mySide);
  const rivalKey = pairKeyOf(rivals);

  let wins = 0;
  let losses = 0;
  let total = 0;
  const indiv = new Map<string, CasualH2H["individuals"][number]>();
  for (const rm of rivals) {
    if (!norm(rm.name) && !rm.user_id) continue;
    indiv.set(keyOf(rm), { name: rm.name ?? "", user_id: rm.user_id, wins: 0, losses: 0, total: 0 });
  }
  for (const mid of ids) {
    if (mid === matchId) continue;
    const parts = byMatch.get(mid);
    const w = winnerById.get(mid);
    if (!parts || w == null) continue;
    const side = parts.find((p) => p.user_id === userId)?.side ?? 0;
    const ourArr = parts.filter((p) => p.side === side);
    const oppArr = parts.filter((p) => p.side !== side);
    const iWon = w === side;
    if (pairKeyOf(ourArr) === ourKey && pairKeyOf(oppArr) === rivalKey) {
      total++;
      if (iWon) wins++;
      else losses++;
    }
    const oppKeys = new Set(oppArr.map(keyOf));
    for (const [k, v] of indiv) {
      if (!oppKeys.has(k)) continue;
      v.total++;
      if (iWon) v.wins++;
      else v.losses++;
    }
  }
  return {
    pair: total > 0 ? { wins, losses, total } : null,
    individuals: [...indiv.values()].filter((v) => v.total > 0).sort((a, b) => b.total - a.total),
  };
}
