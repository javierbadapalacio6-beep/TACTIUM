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
