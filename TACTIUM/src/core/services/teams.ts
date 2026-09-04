import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Team = Database['public']['Tables']['teams']['Row'];
export type TeamInsert = Database['public']['Tables']['teams']['Insert'];
export type TeamUpdate = Database['public']['Tables']['teams']['Update'];
export type TeamGender = Database['public']['Enums']['team_gender'];

/**
 * Marca un equipo de club como CUBIERTO por el plan (permanente). El RPC
 * `cover_team` valida que el caller es el gestor del club y que quedan plazas
 * según el tier; si no, lanza error. Idempotente.
 */
export async function coverTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc('cover_team', { p_team_id: teamId });
  if (error) throw error;
}

/**
 * Borra un equipo y su árbol en cascada (jugadores, temporadas, jornadas,
 * alineaciones, actas, miembros, invitaciones). Vía RPC `delete_team` que
 * valida propiedad. Irreversible.
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_team', { p_team_id: teamId });
  if (error) throw error;
}

/**
 * Devuelve todos los equipos visibles para el usuario.
 * RLS garantiza que solo aparecen los equipos donde es miembro directo
 * (team_members) o club_admin del club al que pertenece el equipo.
 */
export async function fetchMyTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const teams = (data ?? []) as Team[];

  // Los equipos INVITADOS no son "mis equipos". El club que les pone el horario
  // figura como dueño del registro solo porque `owner_id` no admite vacío, pero
  // NO gestiona ese equipo: ni plantilla, ni alineaciones, ni temporadas. Si
  // aparecieran aquí, saldrían en el selector de equipos y el gestor podría
  // entrar a hacer alineaciones de un equipo ajeno. Se ocultan mientras el
  // equipo siga técnicamente a su nombre; en cuanto entra su capitán de verdad
  // la propiedad se traspasa (trigger `guest_team_captain_takeover`) y el club
  // deja de verlo por completo — le queda solo el horario.
  // Atajo: sin ningún candidato, nos ahorramos las dos consultas de abajo.
  const anyCandidate = teams.some(
    (t) => teamVenueClubId(t) != null && t.club_id == null,
  );
  if (!anyCandidate) return teams;

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id ?? null;
  if (!uid) return teams;
  const mine = new Set(await myAdminClubIds(uid));
  if (mine.size === 0) return teams;

  return teams.filter((t) => {
    const venue = teamVenueClubId(t);
    // Ojo: un capitán normal cuyo equipo juega en un club también tiene
    // `venue_club_id`. Solo se oculta si quien mira es el CLUB SEDE y además
    // consta como dueño técnico del registro.
    const isGuestOfMyClub =
      venue != null && t.club_id == null && t.owner_id === uid && mine.has(venue);
    return !isGuestOfMyClub;
  });
}

/** Clubes que el usuario posee o administra (para saber si un equipo invitado
 *  es "de su sede" y por tanto NO es suyo). */
async function myAdminClubIds(uid: string): Promise<string[]> {
  const [owned, admin] = await Promise.all([
    supabase.from('clubs').select('id').eq('owner_id', uid),
    supabase.from('club_members').select('club_id').eq('user_id', uid).eq('role', 'admin'),
  ]);
  const ids = ((owned.data ?? []) as { id: string }[]).map((r) => r.id);
  for (const r of (admin.data ?? []) as { club_id: string }[]) ids.push(r.club_id);
  return ids;
}

/**
 * @deprecated usar fetchMyTeams() y elegir el equipo activo en el cliente.
 * Se mantiene por compatibilidad mientras la UI todavía no expone selector.
 */
export async function fetchMyPrimaryTeam(): Promise<Team | null> {
  const teams = await fetchMyTeams();
  return teams[0] ?? null;
}

export async function createTeam(input: {
  name: string;
  federation?: string;
  league?: string;
  category?: string;
  group?: string;
  gender?: TeamGender;
  clubId?: string;
}): Promise<Team> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    throw new Error(
      'No hay sesión activa. Cierra y vuelve a iniciar sesión.',
    );
  }

  const payload: TeamInsert = {
    owner_id: session.user.id,
    name: input.name,
    federation: input.federation || null,
    league: input.league || null,
    category: input.category || null,
    group_name: input.group || null,
    gender: input.gender ?? 'masculino',
    club_id: input.clubId ?? null,
  };

  const { data, error } = await supabase
    .from('teams')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Club en cuyas pistas juega de local (permiso SOLO de horario). La columna no
 *  está aún en los tipos generados → acceso sin tipar, como preferred_home_slots. */
export function teamVenueClubId(team: unknown): string | null {
  return (team as { venue_club_id?: string | null })?.venue_club_id ?? null;
}

/** Nombre del club sede. Si la RLS no deja leerlo, devuelve null y la UI usa
 *  una etiqueta genérica (no es información crítica). */
export async function fetchClubName(clubId: string): Promise<string | null> {
  const { data } = await supabase
    .from('clubs')
    .select('name')
    .eq('id', clubId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? null;
}

/** El capitán echa al club sede: deja de poder ponerle horarios. */
export async function clearTeamVenue(teamId: string): Promise<void> {
  const raw = supabase.from.bind(supabase) as unknown as (t: string) => any;
  const { error } = await raw('teams')
    .update({ venue_club_id: null })
    .eq('id', teamId);
  if (error) throw new Error(error.message);
}

export async function updateTeam(id: string, patch: TeamUpdate): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
