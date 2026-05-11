import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

type Team = Database['public']['Tables']['teams']['Row'];
type Matchday = Database['public']['Tables']['matchdays']['Row'];
type Season = Database['public']['Tables']['seasons']['Row'];

export interface ClubTeamOverview {
  team: Team;
  activeSeason: Season | null;
  nextMatchday: Matchday | null;
  lastResult: Matchday | null;
  playersCount: number;
  totalMatchdays: number;
  playedCount: number;
}

/**
 * Carga, por cada equipo del club, los datos clave para el dashboard:
 *  - temporada activa (si existe)
 *  - próxima jornada (sin outcome, fecha futura / sin fecha)
 *  - último resultado registrado (con outcome, fecha más reciente)
 *  - número de jugadores activos
 *  - total de jornadas / jornadas jugadas
 */
export async function fetchClubOverview(
  teams: Team[],
): Promise<ClubTeamOverview[]> {
  const today = new Date().toISOString().slice(0, 10);

  return Promise.all(
    teams.map(async (team): Promise<ClubTeamOverview> => {
      // 1. Temporada activa
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .eq('team_id', team.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const activeSeason = seasonData ?? null;

      // 2. Jornadas (solo si hay temporada activa)
      let nextMatchday: Matchday | null = null;
      let lastResult: Matchday | null = null;
      let totalMatchdays = 0;
      let playedCount = 0;

      if (activeSeason) {
        const { data: nextRow } = await supabase
          .from('matchdays')
          .select('*')
          .eq('season_id', activeSeason.id)
          .is('outcome', null)
          .or(`match_date.is.null,match_date.gte.${today}`)
          .order('match_date', { ascending: true, nullsFirst: false })
          .order('jornada_number', { ascending: true })
          .limit(1)
          .maybeSingle();
        nextMatchday = nextRow ?? null;

        const { data: lastRow } = await supabase
          .from('matchdays')
          .select('*')
          .eq('season_id', activeSeason.id)
          .not('outcome', 'is', null)
          .order('match_date', { ascending: false, nullsFirst: false })
          .order('jornada_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        lastResult = lastRow ?? null;

        const { count: total } = await supabase
          .from('matchdays')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', activeSeason.id);
        totalMatchdays = total ?? 0;

        const { count: played } = await supabase
          .from('matchdays')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', activeSeason.id)
          .not('outcome', 'is', null);
        playedCount = played ?? 0;
      }

      // 3. Players activos del equipo
      const { count: playersCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .eq('active', true);

      return {
        team,
        activeSeason,
        nextMatchday,
        lastResult,
        playersCount: playersCount ?? 0,
        totalMatchdays,
        playedCount,
      };
    }),
  );
}
