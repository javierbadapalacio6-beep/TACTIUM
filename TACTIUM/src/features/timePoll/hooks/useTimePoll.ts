import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '@core/supabase/client';
import * as TimePollsApi from '@core/services/timePolls';
import { fetchAvailability, type AvailabilityMap } from '@core/services/availability';
import { useAuthStore } from '@store/authStore';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

export interface PollPlayer {
  id: string;
  name: string;
  photoUrl: string | null;
  hasApp: boolean;
}

export interface PollMatchday {
  id: string;
  status: string;
  match_date: string | null;
  match_time: string | null;
  is_home: boolean;
  jornada_number: number | null;
  opponent: string | null;
}

export interface PollTeam {
  id: string;
  club_id: string | null;
  venue_club_id: string | null;
  preferred_home_slots: string[];
}

export interface TimePollData {
  poll: TimePollsApi.TimePoll | null;
  matchday: PollMatchday | null;
  team: PollTeam | null;
  players: PollPlayer[];
  /** Mi ficha en ese equipo (para votar). */
  myPlayerId: string | null;
  /** Voy/Duda/No de la jornada: se cruza con la encuesta, no se mezcla. */
  availability: AvailabilityMap;
}

const EMPTY: TimePollData = {
  poll: null,
  matchday: null,
  team: null,
  players: [],
  myPlayerId: null,
  availability: {},
};

/**
 * Todo lo que necesita la encuesta de hora de una jornada. Carga el equipo
 * DE LA JORNADA (no el activo): el club abre jornadas de cualquiera de sus
 * equipos. Se recarga al volver a la pantalla.
 */
export function useTimePoll(matchdayId: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [data, setData] = useState<TimePollData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!matchdayId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const { data: md } = await rawFrom('matchdays')
        .select('id, status, match_date, match_time, is_home, jornada_number, opponent, seasons(team_id)')
        .eq('id', matchdayId)
        .maybeSingle();
      const s = md?.seasons;
      const teamId: string | null = (Array.isArray(s) ? s[0]?.team_id : s?.team_id) ?? null;
      if (!md || !teamId) {
        setData(EMPTY);
        return;
      }
      const [teamRes, playersRes, poll, availability] = await Promise.all([
        rawFrom('teams')
          .select('id, club_id, venue_club_id, preferred_home_slots')
          .eq('id', teamId)
          .maybeSingle(),
        rawFrom('players')
          .select('id, name, alias, photo_url, user_id, active')
          .eq('team_id', teamId),
        TimePollsApi.fetchTimePoll(matchdayId),
        fetchAvailability(matchdayId).catch(() => ({}) as AvailabilityMap),
      ]);
      const rows = ((playersRes.data ?? []) as {
        id: string;
        name: string;
        alias: string | null;
        photo_url: string | null;
        user_id: string | null;
        active: boolean;
      }[]).filter((p) => p.active);
      const t = teamRes.data as PollTeam | null;
      setData({
        poll,
        matchday: {
          id: md.id,
          status: md.status,
          match_date: md.match_date,
          match_time: md.match_time,
          is_home: md.is_home,
          jornada_number: md.jornada_number,
          opponent: md.opponent,
        },
        team: t ? { ...t, preferred_home_slots: t.preferred_home_slots ?? [] } : null,
        players: rows
          .map((p) => ({
            id: p.id,
            name: p.alias?.trim() || p.name,
            photoUrl: p.photo_url,
            hasApp: !!p.user_id,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        myPlayerId: rows.find((p) => !!userId && p.user_id === userId)?.id ?? null,
        availability,
      });
    } catch (e) {
      console.warn('useTimePoll', e);
    } finally {
      setLoading(false);
    }
  }, [matchdayId, userId]);

  // También al montar: useFocusEffect corre en el primer foco y cuando cambia
  // la jornada con la pantalla ya enfocada.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Voto optimista del propio jugador. */
  const setMyVote = useCallback((optionIds: string[]) => {
    setData((d) =>
      d.poll && d.myPlayerId
        ? { ...d, poll: { ...d.poll, votes: { ...d.poll.votes, [d.myPlayerId]: optionIds } } }
        : d,
    );
  }, []);

  return { ...data, loading, reload: load, setMyVote };
}
