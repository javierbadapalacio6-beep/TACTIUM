import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';
import { fetchSeasons } from '@core/services/seasons';
import {
  fetchLeagueStatsBundle,
  type LeagueStatsBundle,
} from '@core/services/playerStats';

/**
 * Lecturas de la pestaña Equipo (rediseño 2026-10). Todo sale de tablas y RPC
 * que ya existen: nada de esto necesita servidor nuevo.
 *
 *  - `fetchTeamLeagueBundle`: el mismo bundle de «Mis estadísticas», pero de
 *    TODAS las temporadas del equipo, para la ficha de jugador.
 *  - `fetchTeamPairRows`: la RPC `team_pair_stats` en filas (la de la
 *    alineación devuelve un mapa sin orden).
 *  - `fetchNextMatchdays`: próxima jornada de cada equipo, para el selector.
 *  - `uploadTeamLogo` / `removeTeamLogo`: el escudo, igual que la web
 *    (bucket `logos`, carpeta `teams/{id}`).
 */

type Matchday = Database['public']['Tables']['matchdays']['Row'];

export async function fetchTeamLeagueBundle(
  teamId: string,
): Promise<LeagueStatsBundle> {
  const seasons = await fetchSeasons(teamId);
  return fetchLeagueStatsBundle(seasons.map((s) => s.id));
}

export interface PairRow {
  a: string;
  b: string;
  wins: number;
  played: number;
}

/**
 * Parejas con partidos decididos, ordenadas por victorias (no por
 * porcentaje: un 1 de 1 no vale más que un 7 de 10). Misma regla que /stats
 * en la web.
 */
export async function fetchTeamPairRows(teamId: string): Promise<PairRow[]> {
  const { data, error } = await supabase.rpc('team_pair_stats', {
    p_team_id: teamId,
  });
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({
      a: r.player_a,
      b: r.player_b,
      wins: r.wins ?? 0,
      played: r.played ?? 0,
    }))
    .filter((r) => r.played > 0)
    .sort((x, y) => y.wins - x.wins || y.played - x.played);
}

/** Partidos de liga que dos jugadores han jugado JUNTOS, con su marcador. */
export interface SharedGame {
  matchdayId: string;
  jornada: number;
  opponent: string;
  court: number;
  won: boolean | null;
  sets: string;
}

export function sharedGames(
  bundle: LeagueStatsBundle,
  a: string,
  b: string,
): SharedGame[] {
  const md = new Map(bundle.matchdays.map((m) => [m.id, m]));
  const out: SharedGame[] = [];
  for (const p of bundle.pairs) {
    if (!p.matchday_id || p.court_number == null) continue;
    const ids = [p.player_a_id, p.player_b_id];
    if (!ids.includes(a) || !ids.includes(b)) continue;
    const m = md.get(p.matchday_id);
    if (!m) continue;
    const rows = bundle.results
      .filter((r) => r.matchday_id === p.matchday_id && r.court_number === p.court_number)
      .sort((x, y) => (x.set_number ?? 0) - (y.set_number ?? 0));
    const fo = rows.find((r) => r.forfeit);
    let won: boolean | null = null;
    let sets = '';
    if (fo) {
      won = !fo.forfeit_us;
      sets = 'W.O.';
    } else {
      let us = 0;
      let them = 0;
      const parts: string[] = [];
      for (const r of rows) {
        if (r.us == null || r.them == null) continue;
        parts.push(`${r.us}-${r.them}`);
        if (r.us > r.them) us++;
        else if (r.them > r.us) them++;
      }
      sets = parts.join(' ');
      if (us >= 2) won = true;
      else if (them >= 2) won = false;
    }
    out.push({
      matchdayId: m.id,
      jornada: m.jornada_number,
      opponent: m.opponent,
      court: p.court_number,
      won,
      sets,
    });
  }
  return out.sort((x, y) => x.jornada - y.jornada);
}

/** Próxima jornada (sin resultado, hoy o después) de cada equipo. */
export async function fetchNextMatchdays(
  teamIds: string[],
): Promise<Map<string, Matchday>> {
  const out = new Map<string, Matchday>();
  if (teamIds.length === 0) return out;
  const { data: seasons, error } = await supabase
    .from('seasons')
    .select('id, team_id')
    .in('team_id', teamIds)
    .eq('active', true);
  if (error || !seasons?.length) return out;
  const teamBySeason = new Map(seasons.map((s) => [s.id, s.team_id]));
  const today = new Date().toISOString().slice(0, 10);
  const { data: mds } = await supabase
    .from('matchdays')
    .select('*')
    .in('season_id', seasons.map((s) => s.id))
    .is('outcome', null)
    .gte('match_date', today)
    .order('match_date', { ascending: true });
  for (const m of mds ?? []) {
    const t = teamBySeason.get(m.season_id);
    if (t && !out.has(t)) out.set(t, m);
  }
  return out;
}

const LOGO_BUCKET = 'logos';

function detectExt(uri: string): { ext: string; contentType: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (lower.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

/**
 * Sube el escudo del equipo (URI local de expo-image-picker). Mismo sitio y
 * mismo nombre de fichero que la web (`uploadLogo`), para que una y otra se
 * pisen limpiamente: el timestamp evita que el CDN sirva el viejo.
 */
export async function uploadTeamLogo(teamId: string, uri: string): Promise<string> {
  const { ext, contentType } = detectExt(uri);
  const folder = `teams/${teamId}`;
  const filename = `logo_${Date.now()}.${ext}`;
  const path = `${folder}/${filename}`;
  const buf = await (await fetch(uri)).arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, buf, { contentType, upsert: true });
  if (upErr) throw upErr;
  try {
    const { data: files } = await supabase.storage.from(LOGO_BUCKET).list(folder);
    const old = (files ?? [])
      .filter((f) => f.name !== filename)
      .map((f) => `${folder}/${f.name}`);
    if (old.length) await supabase.storage.from(LOGO_BUCKET).remove(old);
  } catch {
    /* basura en storage: no es motivo para fallar */
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  // `logo_url` existe en prod pero no en los tipos generados.
  const { error } = await supabase
    .from('teams')
    .update({ logo_url: publicUrl } as never)
    .eq('id', teamId);
  if (error) throw error;
  return publicUrl;
}

export async function removeTeamLogo(teamId: string): Promise<void> {
  const folder = `teams/${teamId}`;
  try {
    const { data: files } = await supabase.storage.from(LOGO_BUCKET).list(folder);
    if (files?.length) {
      await supabase.storage
        .from(LOGO_BUCKET)
        .remove(files.map((f) => `${folder}/${f.name}`));
    }
  } catch {
    /* idem */
  }
  const { error } = await supabase
    .from('teams')
    .update({ logo_url: null } as never)
    .eq('id', teamId);
  if (error) throw error;
}

/** Escudo del equipo (columna fuera de los tipos generados). */
export const teamLogoOf = (t: unknown): string | null =>
  (t as { logo_url?: string | null } | null)?.logo_url ?? null;

/** Fecha corta legible: «sáb 10 oct». Acepta YYYY-MM-DD. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return 'Fecha por confirmar';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}
