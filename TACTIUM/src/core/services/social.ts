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

export interface PublicUserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  level_display: number | null;
  is_me: boolean;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  casual_played: number;
  casual_won: number;
  casual_win_rate: number | null;
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
