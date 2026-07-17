import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

// Player de plantilla + avatar del perfil del usuario vinculado (si lo hay).
// `profile_avatar_url` NO está en la tabla: se mezcla al cargar desde
// `profiles` para que la foto que el jugador subió a su cuenta aparezca en
// el equipo sin que el capitán tenga que subirla.
export type Player = Database['public']['Tables']['players']['Row'] & {
  profile_avatar_url?: string | null;
};
export type PlayerInsert = Database['public']['Tables']['players']['Insert'];
export type PlayerUpdate = Database['public']['Tables']['players']['Update'];
export type PlayerPosition = Database['public']['Enums']['player_position'];

export async function fetchPlayers(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('pts', { ascending: false });

  if (error) throw error;
  const players = data ?? [];

  // Mezcla el avatar del perfil de cada jugador vinculado (RLS
  // `profiles_teammate_select` deja al capitán/club leerlos).
  const userIds = Array.from(
    new Set(
      players
        .map((p) => p.user_id)
        .filter((u): u is string => u !== null),
    ),
  );
  if (userIds.length === 0) return players;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', userIds);
  const avatarById = new Map(
    (profiles ?? []).map((pr) => [pr.id, pr.avatar_url] as const),
  );
  return players.map((p) => ({
    ...p,
    profile_avatar_url: p.user_id ? avatarById.get(p.user_id) ?? null : null,
  }));
}

export async function createPlayer(
  teamId: string,
  input: {
    name: string;
    pts: number;
    position: PlayerPosition;
    available?: boolean;
    alias?: string | null;
  },
): Promise<Player> {
  const payload: PlayerInsert = {
    team_id: teamId,
    name: input.name,
    pts: input.pts,
    position: input.position,
    available: input.available ?? true,
    alias: input.alias?.trim() ? input.alias.trim() : null,
  };

  const { data, error } = await supabase
    .from('players')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePlayer(id: string, patch: PlayerUpdate): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

export async function setPlayerAvailability(
  id: string,
  available: boolean,
): Promise<Player> {
  return updatePlayer(id, { available });
}

// ─── Vinculación user ↔ player de plantilla ─────────────────────────────────

/**
 * Devuelve la fila de `players` del equipo indicado donde `user_id = auth.uid()`,
 * o `null` si el usuario aún no se ha reclamado un slot. Una sola query, RLS
 * filtra por team membership.
 */
export async function fetchMyPlayer(
  teamId: string,
  userId: string,
): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Equipos donde el usuario tiene una ficha de jugador vinculada (claim).
 * Permite ofrecer el modo "Jugador" a un capitán que ADEMÁS juega en su
 * propio equipo (misma persona), aunque su rol de membresía sea captain.
 */
export async function fetchMyPlayerTeamIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('players')
    .select('team_id')
    .eq('user_id', userId)
    .eq('active', true);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.team_id)));
}

/**
 * Lista los jugadores de la plantilla aún sin usuario asociado. Pensado para
 * la pantalla "¿Cuál eres tú?" del onboarding del player.
 */
export async function listUnclaimedPlayers(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase.rpc('list_unclaimed_players', {
    p_team_id: teamId,
  });
  if (error) throw error;
  return (data as Player[]) ?? [];
}

/**
 * Vincula al usuario autenticado con la fila `players` indicada. Idempotente
 * si ya estaba vinculado al mismo player. Lanza error con `code`:
 *   - '23505' → slot ya reclamado o el usuario ya tiene otro player en ese equipo
 *   - '42501' → no autenticado / no miembro del equipo
 *   - 'P0002' → player no existe
 */
export async function claimPlayer(playerId: string): Promise<Player> {
  const { data, error } = await supabase.rpc('claim_player', {
    p_player_id: playerId,
  });
  if (error) throw error;
  return data as Player;
}

/**
 * Desvincula al usuario autenticado de su player actual. Útil si se reclamó
 * el slot equivocado.
 */
export async function unclaimPlayer(playerId: string): Promise<Player> {
  const { data, error } = await supabase.rpc('unclaim_player', {
    p_player_id: playerId,
  });
  if (error) throw error;
  return data as Player;
}

/**
 * Variante para capitán/admin del equipo (o club_admin del club): libera el
 * slot reclamado por otro usuario. Idempotente si ya estaba libre. La
 * autorización la valida la RPC contra `private.is_team_admin`.
 */
export async function captainUnclaimPlayer(playerId: string): Promise<Player> {
  const { data, error } = await supabase.rpc('captain_unclaim_player', {
    p_player_id: playerId,
  });
  if (error) throw error;
  return data as Player;
}

/**
 * El propio player marca su disponibilidad. Solo afecta a su propio slot
 * (validado server-side por la RPC).
 */
export async function setSelfAvailability(
  playerId: string,
  available: boolean,
): Promise<Player> {
  const { data, error } = await supabase.rpc('set_player_self_availability', {
    p_player_id: playerId,
    p_available: available,
  });
  if (error) throw error;
  return data as Player;
}
