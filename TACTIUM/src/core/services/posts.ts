import { supabase } from '@core/supabase/client';

// Servicio de posts del feed (texto/foto/vídeo). Habla con el RPC `create_post`
// (branch social-matches-rating; en prod tras el merge). Los partidos casuales
// crean su post automáticamente desde `create_casual_match`.

export type PostKind = 'text' | 'photo' | 'video';
export type PostVisibility = 'public' | 'followers' | 'private';

const rpc = supabase.rpc as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: string | null; error: { message: string } | null }>;

export async function createPost(input: {
  kind: PostKind;
  body?: string;
  mediaUrl?: string;
  visibility?: PostVisibility;
  // Si se pasa, el post se publica A NOMBRE de esa sede (autor = club).
  // El RPC verifica que el usuario es el dueño de la sede.
  venueId?: string;
}): Promise<string> {
  const { data, error } = await rpc('create_post', {
    p_kind: input.kind,
    p_body: input.body ?? null,
    p_media_url: input.mediaUrl ?? null,
    p_visibility: input.visibility ?? 'public',
    p_venue_id: input.venueId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ── Lectura del feed ────────────────────────────────────────────────
export type FeedAuthor = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  level: number | null;
  // true = el autor es una SEDE (id = venue id, avatar = logo). Permite
  // navegar a la ficha pública de la sede en vez del perfil de jugador.
  is_venue?: boolean;
};
export type FeedMatchParticipant = { side: number; slot: number; name: string };
export type FeedMatch = {
  type: string;
  sets: [number, number][];
  winner_side: number | null;
  participants: FeedMatchParticipant[];
};
export type FeedItem = {
  id: string;
  kind: 'text' | 'photo' | 'video' | 'match_result' | 'casual_match';
  body: string | null;
  media_url: string | null;
  created_at: string;
  kudos_count: number;
  comments_count: number;
  viewer_kudoed: boolean;
  author: FeedAuthor;
  match: FeedMatch | null;
};

export async function listFeed(limit = 30): Promise<FeedItem[]> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)('list_feed', {
    p_limit: limit,
    p_before: null,
  });
  if (error) throw new Error(error.message);
  return (data as FeedItem[]) ?? [];
}

/** Posts públicos de una sede (para su ficha pública). */
export async function listVenuePosts(venueId: string, limit = 30): Promise<FeedItem[]> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)('list_venue_posts', {
    p_venue_id: venueId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data as FeedItem[]) ?? [];
}
