// Piezas compartidas del bloque Liga (Competir › Liga, detalle de temporada y
// «lo tuyo» en Federación). Gramática del scoreboard de Federación: mono para
// cifras, verde solo para lo activo y lo positivo.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconChevron } from '@components/ui';
import { supabase } from '@core/supabase/client';
import type * as MatchdaysApi from '@core/services/matchdays';
import {
  getFcpIdEquipo,
  fetchFcpGroupStandings,
  type FcpStandingRow,
} from '@core/services/fcpSeason';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { groupZones, zoneIn, type Zone } from '@core/data/fcpZones';

type Matchday = MatchdaysApi.Matchday;

// ─── Clasificación de la Federación de un equipo TACTIUM ─────────────────────

export interface FcpStanding {
  idEquipo: number | null;
  idGrupo: string | null;
  grupo: string | null;
  zones: Zone[] | null;
  rows: FcpStandingRow[];
  me: FcpStandingRow | null;
  zone: Zone | null;
}

const EMPTY: FcpStanding = {
  idEquipo: null,
  idGrupo: null,
  grupo: null,
  zones: null,
  rows: [],
  me: null,
  zone: null,
};

// Caché en memoria: Liga, Federación y el detalle piden lo mismo al cambiar de
// segmento, y la tabla no cambia en minutos.
const standingCache = new Map<string, { at: number; v: FcpStanding }>();
const TTL = 5 * 60_000;

export async function loadFcpStanding(teamId: string): Promise<FcpStanding> {
  const hit = standingCache.get(teamId);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const idEquipo = await getFcpIdEquipo(teamId);
  if (idEquipo == null) {
    standingCache.set(teamId, { at: Date.now(), v: EMPTY });
    return EMPTY;
  }
  const { grupo, idGrupo, genero, rows } = await fetchFcpGroupStandings(idEquipo);
  const zones = groupZones({ fed: FCP_FEDERATION_CODE, idGrupo, nombre: grupo, genero });
  const me = rows.find((r) => r.isMe) ?? null;
  const v: FcpStanding = {
    idEquipo,
    idGrupo,
    grupo,
    zones,
    rows,
    me,
    zone: zoneIn(zones, me?.posicion),
  };
  standingCache.set(teamId, { at: Date.now(), v });
  return v;
}

/** Puesto, zona y grupo de un equipo vinculado a la Federación. Sin vínculo
 *  (o sin `teamId`) devuelve vacío y no pinta nada quien lo use. */
export function useFcpStanding(teamId: string | null | undefined, enabled = true) {
  const [state, setState] = useState<{ loading: boolean; data: FcpStanding }>({
    loading: !!teamId && enabled,
    data: EMPTY,
  });
  useEffect(() => {
    if (!teamId || !enabled) {
      setState({ loading: false, data: EMPTY });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    loadFcpStanding(teamId)
      .then((v) => alive && setState({ loading: false, data: v }))
      .catch(() => alive && setState({ loading: false, data: EMPTY }));
    return () => {
      alive = false;
    };
  }, [teamId, enabled]);
  return state;
}

// ─── Balance de varias temporadas (histórico) ─────────────────────────────────

export interface SeasonBalance {
  w: number;
  d: number;
  l: number;
  total: number;
}

/** V-E-D de cada temporada en UNA consulta (para el histórico de la Liga). */
export async function fetchSeasonsBalance(
  seasonIds: string[],
): Promise<Record<string, SeasonBalance>> {
  const out: Record<string, SeasonBalance> = {};
  if (seasonIds.length === 0) return out;
  const { data, error } = await supabase
    .from('matchdays')
    .select('season_id, outcome')
    .in('season_id', seasonIds);
  if (error) throw error;
  for (const r of (data ?? []) as { season_id: string; outcome: Matchday['outcome'] }[]) {
    const b = (out[r.season_id] ??= { w: 0, d: 0, l: 0, total: 0 });
    b.total += 1;
    if (r.outcome === 'win') b.w += 1;
    else if (r.outcome === 'draw') b.d += 1;
    else if (r.outcome === 'loss') b.l += 1;
  }
  return out;
}

// ─── Formato ─────────────────────────────────────────────────────────────────

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-10-10» → «Sáb 10 oct» (con día de la semana) o «10 oct». */
export function fmtDay(iso: string | null | undefined, withDow = true): string {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = `${Number(m[3])} ${MON[Number(m[2]) - 1]}`;
  return withDow ? `${DOW[d.getDay()]} ${base}` : base;
}

/** «Sáb 10 oct · 17:00 · En casa». */
export function fmtMatchLine(m: Pick<Matchday, 'match_date' | 'match_time' | 'is_home'>): string {
  return [
    fmtDay(m.match_date),
    m.match_time ? m.match_time.slice(0, 5) : '',
    m.is_home ? 'En casa' : 'Fuera',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** «3–2» si hay marcador; si no, la letra del resultado (o null). */
export function scoreLabel(m: Pick<Matchday, 'score_for' | 'score_against' | 'outcome'>): string | null {
  if (m.score_for != null && m.score_against != null) return `${m.score_for}–${m.score_against}`;
  if (m.outcome === 'win') return 'V';
  if (m.outcome === 'draw') return 'E';
  if (m.outcome === 'loss') return 'D';
  return null;
}

export function outcomeColor(c: Palette, outcome: Matchday['outcome']): string {
  if (outcome === 'win') return c.accent;
  if (outcome === 'loss') return c.error;
  if (outcome === 'draw') return c.warning;
  return c.textMuted;
}

export const phaseLabel = (phase: string | null | undefined): string =>
  phase === 'mixto' ? 'LIGA + PLAYOFF' : phase === 'playoff' ? 'PLAYOFF' : 'LIGA';

/** Jornadas jugadas, ordenadas por fecha (o número) de la más antigua a la más nueva. */
export function playedChrono(matchdays: Matchday[]): Matchday[] {
  return matchdays
    .filter((m) => m.outcome !== null)
    .slice()
    .sort((a, b) => {
      if (a.match_date && b.match_date && a.match_date !== b.match_date) {
        return a.match_date.localeCompare(b.match_date);
      }
      return a.jornada_number - b.jornada_number;
    });
}

// ─── Count-up (puesto de 0 a N en 400 ms) ─────────────────────────────────────

export const CountUp: React.FC<{
  value: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  duration?: number;
}> = ({ value, style, suffix = '', duration = 400 }) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const v = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    v.value = reduced
      ? value
      : withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, reduced, v, duration]);
  useAnimatedReaction(
    () => Math.round(v.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setShown)(cur);
    },
  );
  return (
    <Text style={style}>
      {shown}
      {suffix}
    </Text>
  );
};

// ─── Ficha de resultado «3–2» (racha) ─────────────────────────────────────────

export const ScoreChip: React.FC<{
  matchday: Matchday;
  index?: number;
  /** Paleta fija (la tarjeta activa es oscura también en modo claro). */
  palette?: Palette;
}> = ({ matchday: m, index = 0, palette }) => {
  const themed = useColors();
  const c = palette ?? themed;
  const reduced = useReducedMotion();
  const color = outcomeColor(c, m.outcome);
  const label = scoreLabel(m) ?? '—';
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInRight.delay(120 + index * 70).duration(260)}
      style={{
        minWidth: 38,
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: withAlpha(color, 0.14),
        borderWidth: 1,
        borderColor: withAlpha(color, 0.35),
      }}
      accessibilityLabel={`J${m.jornada_number}: ${label}`}
    >
      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, fontWeight: '800', color }}>{label}</Text>
    </Animated.View>
  );
};

// ─── Fila de acción (hojas «＋» y «···», empty state con tres caminos) ─────────

export const ActionRow: React.FC<{
  glyph: React.ReactNode;
  title: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  last?: boolean;
}> = ({ glyph, title, sub, onPress, disabled, danger, last }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        s.action,
        !last && s.actionDivider,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={[s.actionGlyph, danger && { backgroundColor: withAlpha(c.error, 0.12) }]}>
        {glyph}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.actionTitle, danger && { color: c.error }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={s.actionSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

/** Glifo de texto para las filas de acción (◎ ↓ ⇢ ■). */
export const Glyph: React.FC<{ ch: string; color?: string }> = ({ ch, color }) => {
  const c = useColors();
  return (
    <Text style={{ fontFamily: Fonts.mono, fontSize: 15, fontWeight: '800', color: color ?? c.accent }}>
      {ch}
    </Text>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      minHeight: 56,
    },
    actionDivider: { borderBottomWidth: 1, borderBottomColor: c.hair },
    actionGlyph: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: c.accent10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    actionSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  });


/** Próxima jornada: la primera por fecha entre las que aún no se han jugado
 *  (las de fecha pasada sin acta no cuentan como «próxima»). */
export function pickNextMatchday(
  matchdays: Matchday[],
  isUpcoming: (m: Matchday) => boolean,
): Matchday | undefined {
  const upcoming = matchdays.filter(isUpcoming);
  if (upcoming.length === 0) return undefined;
  return upcoming.slice().sort((a, b) => {
    if (!a.match_date && !b.match_date) return a.jornada_number - b.jornada_number;
    if (!a.match_date) return 1;
    if (!b.match_date) return -1;
    return a.match_date.localeCompare(b.match_date) || a.jornada_number - b.jornada_number;
  })[0];
}

/** «2ª Categoría Masculina - Grupo B» → «2ª Masc · Grupo B». */
export function shortGroupName(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const cat = nombre.match(/(\d+)\s*ª/);
  const gen = /FEM/i.test(nombre) ? 'Fem' : /MASC/i.test(nombre) ? 'Masc' : '';
  const grp = nombre.match(/GRUPO\s+([\wÁÉÍÓÚÑ]+)/i);
  const parts = [
    [cat ? `${cat[1]}ª` : '', gen].filter(Boolean).join(' '),
    grp ? `Grupo ${grp[1].toUpperCase()}` : /ÚNICO|UNICO/i.test(nombre) ? 'Grupo único' : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : nombre;
}
