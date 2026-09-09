import { supabase } from '@core/supabase/client';

// Horarios de local del club (feedback Smash 2026-07-21). El RPC
// `get_club_home_schedule` y la columna `teams.preferred_home_slots` aún no
// están en los tipos generados → casts puntuales (como social.ts).

export interface ClubHomeMatch {
  matchday_id: string;
  team_id: string;
  team_name: string;
  jornada_number: number | null;
  match_date: string | null; // 'YYYY-MM-DD'
  match_time: string | null; // 'HH:MM:SS'
  location: string | null; // pista/lugar
  opponent: string | null;
  status: string;
  preferred_home_slots: string[]; // franjas favoritas del equipo ('HH:MM')
  // Equipo INVITADO: juega en las pistas del club pero no es suyo. El club solo
  // le pone día/hora/pista; ni plantilla ni alineaciones. Ver `venue_club_id`.
  is_guest?: boolean;
  // Playoff: la sede es una PROPUESTA (la Federación no la publica de forma
  // fiable). Se confirma al asignarle hueco.
  home_unconfirmed?: boolean;
}

/** Marca de "sede sin confirmar" de un puñado de jornadas. Va aparte porque
 *  `get_club_home_schedule` vive en producción y no en este repositorio: antes
 *  que reescribirla a ciegas, se consulta la columna directamente. */
export async function fetchUnconfirmedVenues(
  matchdayIds: string[],
): Promise<Set<string>> {
  if (matchdayIds.length === 0) return new Set();
  const raw = supabase.from.bind(supabase) as unknown as (t: string) => any;
  const { data } = await raw('matchdays')
    .select('id, home_unconfirmed')
    .in('id', matchdayIds);
  const out = new Set<string>();
  for (const r of (data ?? []) as { id: string; home_unconfirmed: boolean | null }[])
    if (r.home_unconfirmed) out.add(r.id);
  return out;
}

type RpcResult = { data: unknown; error: { message: string } | null };

export interface VenueTeam {
  team_id: string;
  team_name: string;
  gender: string | null;
  category: string | null;
  preferred_home_slots: string[];
  claimed: boolean;
}

/** Equipos INVITADOS del club, tengan o no partidos pendientes. La pantalla los
 *  deducía de los partidos, así que un invitado recién dado de alta (o con la
 *  temporada terminada) no aparecía. Va por RPC porque, en cuanto su capitán
 *  reclama el equipo, la RLS se lo oculta al club. */
export async function getVenueTeams(clubId: string): Promise<VenueTeam[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('get_venue_teams', { target_club: clubId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as VenueTeam[]).map((t) => ({
    ...t,
    preferred_home_slots: t.preferred_home_slots ?? [],
  }));
}

/** Partidos de local de los equipos INVITADOS (los que juegan aquí sin ser del
 *  club). Va en un RPC aparte para no tocar `get_club_home_schedule`, que está
 *  en producción y no en este repositorio. */
export async function getVenueHomeSchedule(
  clubId: string,
): Promise<ClubHomeMatch[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('get_venue_home_schedule', {
    target_club: clubId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClubHomeMatch[]).map((m) => ({
    ...m,
    preferred_home_slots: m.preferred_home_slots ?? [],
    is_guest: true,
  }));
}

/** Día/hora/pista de un partido de un equipo INVITADO. El club no es admin de
 *  ese equipo, así que va por un RPC de puerta estrecha que además avisa a su
 *  capitán por la campana. */
export async function setVenueMatchdaySlot(input: {
  matchdayId: string;
  matchDate: string | null; // 'YYYY-MM-DD'
  matchTime: string | null; // 'HH:MM:SS'
  location: string | null;
}): Promise<void> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { error } = await rpc('set_venue_matchday_slot', {
    p_matchday_id: input.matchdayId,
    p_match_date: input.matchDate,
    p_match_time: input.matchTime,
    p_location: input.location,
  });
  if (error) throw new Error(error.message);
}

/** Partidos de LOCAL (no cerrados) de todos los equipos del club. */
export async function getClubHomeSchedule(
  clubId: string,
): Promise<ClubHomeMatch[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('get_club_home_schedule', {
    target_club: clubId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClubHomeMatch[]).map((m) => ({
    ...m,
    preferred_home_slots: m.preferred_home_slots ?? [],
  }));
}

// Suma `n` días a una fecha 'YYYY-MM-DD'.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Partidos de la "jornada en juego": la ventana de ~1 semana desde el partido
 * de local más próximo. Evita mostrar todas las jornadas de la temporada
 * cuando el club tiene muchos equipos — solo el turno actual. Los partidos sin
 * fecha se incluyen siempre (aún por calendarizar). Comparación lexicográfica
 * de fechas ISO (válida para 'YYYY-MM-DD').
 */
export function currentRoundMatches(matches: ClubHomeMatch[]): ClubHomeMatch[] {
  const dated = matches
    .filter((m) => m.match_date)
    .sort((a, b) => (a.match_date! < b.match_date! ? -1 : 1));
  if (dated.length === 0) return matches;
  // Anclamos al primer partido de HOY en adelante (la jornada realmente en
  // juego). Si todos son pasados, al más reciente — así un partido viejo sin
  // cerrar no ancla la ventana al pasado y oculta los próximos.
  const today = new Date().toISOString().slice(0, 10);
  const anchor = dated.find((m) => m.match_date! >= today) ?? dated[dated.length - 1];
  const d0 = anchor.match_date!;
  const end = addDays(d0, 6);
  return matches.filter(
    (m) => !m.match_date || (m.match_date >= d0 && m.match_date <= end),
  );
}

/** Franjas favoritas de un equipo INVITADO, que el club sede sí puede editar.
 *  Va por RPC de puerta estrecha: el club no es admin de ese equipo, así que la
 *  RLS de `teams` no le deja el update directo. Avisa a su capitán. */
export async function setVenueTeamSlots(
  teamId: string,
  slots: string[],
): Promise<void> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { error } = await rpc('set_venue_team_slots', {
    p_team_id: teamId,
    p_slots: slots,
  });
  if (error) throw new Error(error.message);
}

/** Guarda las franjas favoritas de local de un equipo (array de 'HH:MM'). */
export async function setTeamPreferredSlots(
  teamId: string,
  slots: string[],
): Promise<void> {
  const from = supabase.from.bind(supabase) as unknown as (
    table: string,
  ) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await from('teams')
    .update({ preferred_home_slots: slots })
    .eq('id', teamId);
  if (error) throw new Error(error.message);
}

// ─── Grupo de la Federación de cada equipo ───────────────────────────────────
// En Horarios el nombre no basta para saber a quién le estás poniendo la pista:
// «MEDIO CUDEYO A» puede ser el masculino de 2ª o el femenino de 3ª, y dentro de
// una categoría hay varios grupos con calendarios distintos. El grupo sale de la
// FCP (`fcp_team_links` → `fcp_clasificacion` → `fcp_grupos`), no de `teams`.
// Las tres tablas son de lectura pública para `authenticated`, así que esto es
// una consulta normal del cliente, sin RPC.

/** «3ª CATEGORIA MASCULINA - GRUPO D» → «Grupo D». null si no lo trae. */
const grupoCorto = (nombre: string | null | undefined): string | null => {
  const m = (nombre ?? '').match(/GRUPO\s+([A-Z0-9]+)/i);
  return m ? `Grupo ${m[1].toUpperCase()}` : null;
};

/** Grupo de liga por equipo (propios e invitados). Nunca lanza: si la
 *  Federación no tiene el dato, ese equipo simplemente no sale en el mapa. */
export async function getTeamGroups(
  teamIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(teamIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const raw = supabase.from.bind(supabase) as unknown as (t: string) => any;
  try {
    const { data: links } = await raw('fcp_team_links')
      .select('team_id, fcp_id_equipo')
      .in('team_id', ids);
    const linkRows = (links ?? []) as { team_id: string; fcp_id_equipo: number }[];
    if (linkRows.length === 0) return {};

    const equipos = [...new Set(linkRows.map((l) => l.fcp_id_equipo))];
    const { data: cls } = await raw('fcp_clasificacion')
      .select('id_equipo, id_grupo')
      .in('id_equipo', equipos);
    // Las fases de playoff son grupos aparte («fase...»); el que identifica al
    // equipo es el de la liga regular.
    const grupoByEquipo = new Map<number, string>();
    for (const r of (cls ?? []) as { id_equipo: number; id_grupo: string }[]) {
      if (/^fase/i.test(r.id_grupo)) continue;
      if (!grupoByEquipo.has(r.id_equipo)) grupoByEquipo.set(r.id_equipo, r.id_grupo);
    }
    const grupos = [...new Set([...grupoByEquipo.values()])];
    if (grupos.length === 0) return {};

    const { data: gr } = await raw('fcp_grupos')
      .select('id_grupo, nombre')
      .in('id_grupo', grupos);
    const nombreByGrupo = new Map<string, string | null>();
    for (const g of (gr ?? []) as { id_grupo: string; nombre: string | null }[]) {
      nombreByGrupo.set(g.id_grupo, g.nombre);
    }

    const out: Record<string, string> = {};
    for (const l of linkRows) {
      const idGrupo = grupoByEquipo.get(l.fcp_id_equipo);
      const corto = idGrupo ? grupoCorto(nombreByGrupo.get(idGrupo)) : null;
      if (corto) out[l.team_id] = corto;
    }
    return out;
  } catch (e) {
    console.warn('getTeamGroups failed', e);
    return {};
  }
}
