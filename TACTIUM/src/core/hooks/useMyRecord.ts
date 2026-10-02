import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '@core/supabase/client';
import {
  fetchLeagueStatsBundle,
  computePlayerLeagueStats,
  type LeagueStatsBundle,
} from '@core/services/playerStats';
import {
  fetchMyCasualStats,
  fetchMyCasualMatches,
} from '@core/services/casualMatches';

// Récord del usuario para la cabecera del perfil: liga (TODOS sus equipos,
// todas las temporadas — el ámbito «Todas» de MyStats, pero sumando cada
// equipo en el que tiene ficha) + amistosos vinculados. El cálculo de liga
// es el mismo `computePlayerLeagueStats` que usa MyStatsScreen.

export interface RecordBestPartner {
  name: string;
  played: number;
  won: number;
  /** 0-100 */
  rate: number;
  /** Pista habitual juntos (solo liga). */
  usualCourt: number | null;
}

export interface MyRecord {
  played: number;
  won: number;
  lost: number;
  /** 0-100, null si no hay partidos decididos. */
  winRate: number | null;
  /** Positiva = victorias seguidas; negativa = derrotas seguidas. */
  currentStreak: number;
  /** Últimos 5 (cronológicos), liga + amistosos mezclados por fecha. */
  lastFive: ('W' | 'L')[];
  bestPartner: RecordBestPartner | null;
}

// Alias con el que se sustituyen los ids de jugador del usuario en cada
// equipo: así una sola pasada de computePlayerLeagueStats los agrega todos.
const ME = '__me__';

async function loadLeague(userId: string) {
  const { data: mine, error } = await supabase
    .from('players')
    .select('id, team_id')
    .eq('user_id', userId);
  if (error) throw error;
  const playerIds = new Set((mine ?? []).map((p) => p.id));
  const teamIds = [...new Set((mine ?? []).map((p) => p.team_id))];
  if (teamIds.length === 0) return null;

  const { data: seasons, error: e2 } = await supabase
    .from('seasons')
    .select('id')
    .in('team_id', teamIds);
  if (e2) throw e2;
  const bundle = await fetchLeagueStatsBundle((seasons ?? []).map((s) => s.id));

  const merged: LeagueStatsBundle = {
    ...bundle,
    pairs: bundle.pairs.map((p) => ({
      ...p,
      player_a_id:
        p.player_a_id && playerIds.has(p.player_a_id) ? ME : p.player_a_id,
      player_b_id:
        p.player_b_id && playerIds.has(p.player_b_id) ? ME : p.player_b_id,
    })),
  };
  return computePlayerLeagueStats(ME, merged);
}

async function computeRecord(userId: string): Promise<MyRecord> {
  const [league, casual, casualMatches] = await Promise.all([
    loadLeague(userId).catch((e) => {
      console.warn('useMyRecord league', e);
      return null;
    }),
    fetchMyCasualStats(userId).catch(() => null),
    fetchMyCasualMatches(userId).catch(() => []),
  ]);

  const won = (league?.won ?? 0) + (casual?.won ?? 0);
  const lost = (league?.lost ?? 0) + (casual?.lost ?? 0);
  const played = won + lost;

  // Racha y últimos 5: liga + amistosos en orden de fecha.
  const seq = [
    ...(league?.sequence ?? []).map((g) => ({ date: g.date, won: g.won })),
    ...casualMatches.map((m) => ({ date: m.playedOn, won: m.won })),
  ].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  let cur = 0;
  for (const g of seq) {
    if (g.won) cur = cur >= 0 ? cur + 1 : 1;
    else cur = cur <= 0 ? cur - 1 : -1;
  }
  const lastFive = seq.slice(-5).map((g) => (g.won ? 'W' : 'L') as 'W' | 'L');

  // Mejor pareja: la de liga (con pista habitual) o, de amistosos, la que
  // más victorias juntos sume. Mismo umbral que MyStats: ≥2 juntos y ≥50 %.
  const candidates: RecordBestPartner[] = [];
  const lp = league?.bestPartner;
  if (lp) {
    candidates.push({
      name: lp.name,
      played: lp.played,
      won: lp.won,
      rate: Math.round((lp.won / lp.played) * 100),
      usualCourt: lp.usualCourt ?? null,
    });
  }
  const byName = new Map<string, { played: number; won: number }>();
  for (const m of casualMatches) {
    const n = m.partner?.trim();
    if (!n) continue;
    const s = byName.get(n) ?? { played: 0, won: 0 };
    s.played++;
    if (m.won) s.won++;
    byName.set(n, s);
  }
  const cp = [...byName.entries()]
    .filter(([, s]) => s.played >= 2 && s.won / s.played >= 0.5)
    .sort((a, b) => b[1].won - a[1].won || b[1].played - a[1].played)[0];
  if (cp) {
    candidates.push({
      name: cp[0],
      played: cp[1].played,
      won: cp[1].won,
      rate: Math.round((cp[1].won / cp[1].played) * 100),
      usualCourt: null,
    });
  }
  const bestPartner =
    candidates.sort((a, b) => b.won - a.won || b.played - a.played)[0] ?? null;

  return {
    played,
    won,
    lost,
    winRate: played > 0 ? Math.round((won / played) * 100) : null,
    currentStreak: cur,
    lastFive,
    bestPartner,
  };
}

/** Récord del usuario (liga + amistosos). Se refresca al volver a la
 *  pantalla; `loading` solo es true en la primera carga (esqueleto). */
export function useMyRecord(userId: string | null) {
  const [record, setRecord] = useState<MyRecord | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!userId) {
      setRecord(null);
      setLoading(false);
      return;
    }
    try {
      const r = await computeRecord(userId);
      if (alive.current) setRecord(r);
    } catch (e) {
      console.warn('useMyRecord', e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { record, loading, reload };
}
