import { supabase } from '@core/supabase/client';

// Capa social v1 ("seguir"). Habla con la tabla `follows` y con los RPCs
// SECURITY DEFINER (search_community / get_public_*_profile / list_*), que
// exponen SOLO campos seguros (nunca email). Ni la tabla ni los RPCs están
// en los tipos generados todavía → casts puntuales, como en casualMatches.ts.

export type FollowTargetType = 'user' | 'club';

export interface CommunityResult {
  type: FollowTargetType;
  id: string;
  name: string;
  subtitle: string | null;
  avatar_url: string | null;
  followers_count: number;
  is_following: boolean;
}

export interface PublicProfileTeam {
  name: string;
  role: 'captain' | 'admin' | 'player' | string;
}

export interface PublicProfilePhoto {
  // 'casual' = amistoso (jugador) → abre CasualMatchDetail; 'jornada' = partido
  // de liga (capitán) → abre LeagueMatchDetail (vista pública).
  kind?: 'casual' | 'jornada';
  match_id?: string; // solo casual
  matchday_id?: string; // solo jornada
  label?: string; // "J14 · Rival" (jornada)
  photo_url: string;
  played_on: string | null;
  positive: boolean | null;
}

export interface PublicUserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level_display: number | null;
  is_me: boolean;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  casual_played: number;
  casual_won: number;
  casual_win_rate: number | null;
  teams: PublicProfileTeam[];
  photos: PublicProfilePhoto[];
}

export interface PublicClubProfile {
  id: string;
  name: string;
  teams_count: number;
  members_count: number;
  followers_count: number;
  is_following: boolean;
}

export interface FollowerRow {
  id: string;
  name: string;
  avatar_url: string | null;
  is_following: boolean;
}

export interface FollowingRow extends FollowerRow {
  type: FollowTargetType;
  subtitle: string | null;
}

export interface FeedItem {
  kind: 'casual' | 'league';
  ref_id: string;
  occurred_on: string | null;
  actor_id: string | null;
  actor_name: string | null;
  avatar_url: string | null;
  title: string;
  subtitle: string | null;
  positive: boolean | null;
  // Kudos (aplausos) del ítem. Opcionales por si el RPC aún no los trae.
  kudos_count?: number;
  i_gave_kudos?: boolean;
}

export type KudosKind = 'casual' | 'league';
export interface KudosResult {
  given: boolean;
  count: number;
}

// ── Casts puntuales (tabla/RPCs fuera de los tipos generados) ──────────────
type RpcResult = { data: unknown; error: { message: string } | null };
const callRpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    f: string,
    a: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
};

type FollowsTable = {
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  delete: () => {
    match: (m: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};
const followsTable = (): FollowsTable =>
  supabase.from('follows' as never) as unknown as FollowsTable;

const requireUid = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('Sin sesión activa');
  return uid;
};

// ── API ────────────────────────────────────────────────────────────────────
export async function searchCommunity(q: string): Promise<CommunityResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  return (await callRpc<CommunityResult[]>('search_community', { q: term })) ?? [];
}

export function getPublicUserProfile(id: string): Promise<PublicUserProfile> {
  return callRpc<PublicUserProfile>('get_public_user_profile', { target: id });
}

export function getPublicClubProfile(id: string): Promise<PublicClubProfile> {
  return callRpc<PublicClubProfile>('get_public_club_profile', { target: id });
}

// ─── Partido de liga (jornada) público ────────────────────────────────────
// Vista read-only a la que llevan las fotos de jornada del perfil.
export interface PublicMatchdayCourt {
  court_number: number;
  forfeit?: boolean; // pista ganada/perdida por W.O. (sin marcador)
  forfeit_us?: boolean; // dirección del W.O. (true = no nos presentamos)
  pair?: string | null; // nuestra pareja en esa pista (alineación activa)
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
  outcome: string | null; // 'win' | 'loss' | 'draw' | null
  photo_url: string | null;
  team_name: string | null;
  category: string | null;
  group_name: string | null;
  courts: PublicMatchdayCourt[];
}

export async function fetchPublicMatchday(id: string): Promise<PublicMatchday | null> {
  const rows = await callRpc<PublicMatchday[]>('public_get_matchday', { p_id: id });
  return (rows ?? [])[0] ?? null;
}

export async function listFollowers(
  targetId: string,
  type: FollowTargetType = 'user',
): Promise<FollowerRow[]> {
  return (
    (await callRpc<FollowerRow[]>('list_followers', {
      p_target: targetId,
      p_type: type,
    })) ?? []
  );
}

export async function listFollowing(userId: string): Promise<FollowingRow[]> {
  return (await callRpc<FollowingRow[]>('list_following', { p_user: userId })) ?? [];
}

export async function fetchFeed(limit = 30): Promise<FeedItem[]> {
  return (await callRpc<FeedItem[]>('social_feed', { p_limit: limit })) ?? [];
}

/** Da o quita kudos a un amistoso ('casual', `targetId` = id del partido) o a
 *  una jornada ('league', `targetId` = id de la jornada). En amistosos se pasa
 *  `targetUserId` (el actor del ítem del feed, a quien se avisa); en liga, null.
 *  Devuelve el estado final: si lo tengo dado y el total. */
export async function toggleActivityKudos(
  kind: KudosKind,
  targetId: string,
  targetUserId: string | null = null,
): Promise<KudosResult> {
  const r = await callRpc<KudosResult | null>('toggle_activity_kudos', {
    p_kind: kind,
    p_target_id: targetId,
    p_target_user_id: kind === 'casual' ? targetUserId : null,
  });
  return { given: !!r?.given, count: Number(r?.count ?? 0) };
}

export async function followTarget(type: FollowTargetType, id: string): Promise<void> {
  const uid = await requireUid();
  const { error } = await followsTable().insert({
    follower_id: uid,
    target_type: type,
    target_id: id,
  });
  if (error) throw new Error(error.message);
}

export async function unfollowTarget(type: FollowTargetType, id: string): Promise<void> {
  const uid = await requireUid();
  const { error } = await followsTable()
    .delete()
    .match({ follower_id: uid, target_type: type, target_id: id });
  if (error) throw new Error(error.message);
}

/** ¿Sigo ya a este usuario/club? Va por los RPCs de perfil público (ya
 *  devuelven `is_following`), así no depende de la RLS de `follows`. */
export async function isFollowing(type: FollowTargetType, id: string): Promise<boolean> {
  const p = type === 'user' ? await getPublicUserProfile(id) : await getPublicClubProfile(id);
  return !!p?.is_following;
}

// ─── Gente que conoces (sugerencias para seguir) ──────────────────────────
export interface PersonSuggestion {
  id: string;
  name: string;
  avatar_url: string | null;
  /** «Tu equipo» / «Tu club»: de dónde lo conoces. */
  context: 'team' | 'club';
}

const SUGGESTION_MAX = 8;

/** Ids de las filas o [] si la consulta falla (p. ej. por RLS): las
 *  sugerencias son un extra y nunca deben romper la pantalla. */
const safeRows = async <T>(
  q: PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> => {
  try {
    const { data, error } = await q;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
};

/**
 * Jugadores de mis equipos y miembros de mis clubes que tienen cuenta, sin
 * mí ni la gente que ya sigo. Primero los compañeros de equipo, luego los del
 * club. Nombre del perfil público si lo hay; si no, el de la ficha. Máx. 8.
 */
export async function fetchPeopleYouKnow(): Promise<PersonSuggestion[]> {
  const uid = await requireUid();

  // 1) Mis equipos (membresía o ficha de jugador vinculada) y mis clubes.
  const [tmMine, plMine, cmMine] = await Promise.all([
    safeRows(supabase.from('team_members').select('team_id').eq('user_id', uid)),
    safeRows(supabase.from('players').select('team_id').eq('user_id', uid)),
    safeRows(supabase.from('club_members').select('club_id').eq('user_id', uid)),
  ]);
  const teamIds = Array.from(
    new Set([...tmMine.map((r) => r.team_id), ...plMine.map((r) => r.team_id)]),
  );
  const teamClubs = teamIds.length
    ? await safeRows(supabase.from('teams').select('club_id').in('id', teamIds))
    : [];
  const clubIds = Array.from(
    new Set(
      [...cmMine.map((r) => r.club_id), ...teamClubs.map((r) => r.club_id)].filter(
        (x): x is string => !!x,
      ),
    ),
  );

  // 2) Gente de esos equipos y clubes + a quién sigo ya.
  const [teamPlayers, teamMembers, clubMembers, following] = await Promise.all([
    teamIds.length
      ? safeRows(
          supabase
            .from('players')
            .select('user_id, name')
            .in('team_id', teamIds)
            .not('user_id', 'is', null),
        )
      : Promise.resolve([] as { user_id: string | null; name: string }[]),
    teamIds.length
      ? safeRows(supabase.from('team_members').select('user_id').in('team_id', teamIds))
      : Promise.resolve([] as { user_id: string }[]),
    clubIds.length
      ? safeRows(supabase.from('club_members').select('user_id').in('club_id', clubIds))
      : Promise.resolve([] as { user_id: string }[]),
    listFollowing(uid).catch(() => [] as FollowingRow[]),
  ]);

  const followed = new Set(following.filter((f) => f.type === 'user').map((f) => f.id));
  const fichaName = new Map<string, string>();
  const ordered: { id: string; context: 'team' | 'club' }[] = [];
  const seen = new Set<string>([uid]);
  const push = (id: string | null | undefined, context: 'team' | 'club') => {
    if (!id || seen.has(id) || followed.has(id)) return;
    seen.add(id);
    ordered.push({ id, context });
  };
  for (const p of teamPlayers) {
    if (p.user_id && p.name && !fichaName.has(p.user_id)) fichaName.set(p.user_id, p.name);
    push(p.user_id, 'team');
  }
  for (const m of teamMembers) push(m.user_id, 'team');
  for (const m of clubMembers) push(m.user_id, 'club');
  if (ordered.length === 0) return [];

  // 3) Perfil público de los primeros (algo de margen por si alguno falla o
  //    resulta que ya lo sigo).
  const candidates = ordered.slice(0, SUGGESTION_MAX + 4);
  const profiles = await Promise.all(
    candidates.map((c) => getPublicUserProfile(c.id).catch(() => null)),
  );
  const out: PersonSuggestion[] = [];
  candidates.forEach((c, i) => {
    const p = profiles[i];
    if (p?.is_following || p?.is_me) return;
    const name =
      p?.full_name?.trim() || p?.username?.trim() || fichaName.get(c.id)?.trim() || '';
    if (!name) return;
    out.push({ id: c.id, name, avatar_url: p?.avatar_url ?? null, context: c.context });
  });
  return out.slice(0, SUGGESTION_MAX);
}
