import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBell, IconChevron, IconShare, IconTrophy, useLayout } from '@components/ui';
import { supabase } from '@core/supabase/client';
import { TACTIUM_WEB_BASE_URL } from '@core/entitlements/tournamentBilling';
import {
  bracketLabel,
  bracketRank,
  formatFee,
  groupName,
  isRoundBracket,
  koRoundNameFromEnd,
  type Tournament,
  type TournamentMatch,
  type TournamentRegistration,
} from '@core/services/tournaments';

/**
 * Piezas del lado del JUGADOR y del VISITANTE en torneos (rediseño 2026-10):
 * pestaña «Partidos» por día, tarjeta de partido estilo marcador, «Estás
 * dentro», «Tu próximo partido» con tu camino, resumen del torneo jugado,
 * campana de seguir y el brillo del trofeo.
 *
 * No hay marcador en directo: «En pista» se DEDUCE del horario (la hora ya
 * pasó y aún no hay resultado). Lo decimos tal cual en la interfaz.
 *
 * Este fichero no importa nada en tiempo de ejecución de
 * TournamentDetailScreen (solo tipos), para no crear un ciclo.
 */

// ── Fechas ────────────────────────────────────────────────────────────────

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseIsoDay = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** «Sáb 18». */
export const dayLabel = (iso: string): string => {
  const d = parseIsoDay(iso);
  return `${DOW[d.getDay()]} ${d.getDate()}`;
};

/** «18:30» (hora local). */
export const hhmm = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** «sáb 13 dic» para fechas de torneo (YYYY-MM-DD). */
export const longDay = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = parseIsoDay(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${DOW[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
};

/** Hora actual que se refresca cada `ms` (la cuenta atrás cambia por minuto). */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** «hace 20 s», «hace 3 min». */
export const agoLabel = (ts: number | null, now: number): string | null => {
  if (!ts) return null;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.round(s / 60)} min`;
};

/** Cuenta atrás hasta un partido: «en 45 min», «en 2 h 10 min», «mañana 10:00». */
export function countdown(
  iso: string,
  now: number,
): { text: string; urgent: boolean } {
  const t = new Date(iso).getTime();
  const diff = t - now;
  if (Number.isNaN(t)) return { text: '', urgent: false };
  if (diff <= 0) return { text: 'ya en pista', urgent: true };
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return { text: `en ${min} min`, urgent: min <= 15 };
  const d = new Date(t);
  const today = localIso(new Date(now));
  const tomorrow = localIso(new Date(now + 86_400_000));
  if (localIso(d) === today) {
    const h = Math.floor(min / 60);
    const r = min % 60;
    return { text: r ? `en ${h} h ${r} min` : `en ${h} h`, urgent: false };
  }
  if (localIso(d) === tomorrow) return { text: `mañana ${hhmm(iso)}`, urgent: false };
  return { text: `${dayLabel(localIso(d))} · ${hhmm(iso)}`, urgent: false };
}

// ── Etiquetas ─────────────────────────────────────────────────────────────

/** «2ª Masc.» para chips y cabeceras compactas. */
export const divShort = (gender: string | null, category: string | null): string => {
  const g =
    gender === 'masculino'
      ? 'Masc.'
      : gender === 'femenino'
        ? 'Fem.'
        : gender === 'mixto'
          ? 'Mixto'
          : null;
  return [category, g].filter(Boolean).join(' ') || 'General';
};

/** Nombre de la ronda de un partido: «Cuartos», «Consolación · Final», «Grupo A». */
export function roundNameOf(m: TournamentMatch, all: TournamentMatch[]): string {
  if (m.bracket === 'grp') return m.group_no != null ? `Grupo ${groupName(m.group_no)}` : 'Grupos';
  if (m.bracket === 'rr') return 'Liga';
  if (m.bracket === 'amer' || m.bracket === 'mex') return `Ronda ${m.round}`;
  const max = all.reduce(
    (mx, x) =>
      x.bracket === m.bracket && x.gender === m.gender && x.category === m.category
        ? Math.max(mx, x.round)
        : mx,
    0,
  );
  const name = koRoundNameFromEnd(max - m.round);
  return m.bracket === 'main' ? name : `${bracketLabel(m.bracket)} · ${name}`;
}

/** Nombre de la pareja: «Javier Bada / Íñigo Sainz». */
export const pairLabel = (r: TournamentRegistration | undefined | null): string =>
  r ? `${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}` : 'Por determinar';

/** Puntos con separador de miles: 1240 → «1.240». */
export const fmtPts = (n: number): string =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ── Estado de un partido según el horario ────────────────────────────────

export type LiveState = 'finished' | 'live' | 'soon' | 'late' | 'scheduled' | 'tbd' | 'bye';

/**
 * «En pista» sale del HORARIO: la hora ya pasó y no hay resultado. Para no
 * dejar un partido olvidado «en pista» todo el día, pasado su tiempo + 1 h se
 * marca «sin resultado».
 */
export function matchLiveState(
  m: TournamentMatch,
  now: number,
  slotMinutes = 90,
): LiveState {
  if (m.status === 'bye') return 'bye';
  if (m.status === 'finished') return 'finished';
  if (!m.scheduled_at) return 'tbd';
  const t = new Date(m.scheduled_at).getTime();
  if (Number.isNaN(t)) return 'tbd';
  const known = !!m.home_reg && !!m.away_reg;
  const diff = now - t;
  if (diff >= 0 && known) return diff <= (slotMinutes + 60) * 60_000 ? 'live' : 'late';
  if (diff < 0 && -diff <= 30 * 60_000) return 'soon';
  return 'scheduled';
}

const STATE_LABEL: Partial<Record<LiveState, string>> = {
  live: 'EN PISTA',
  soon: 'EN BREVE',
  finished: 'TERMINADO',
  late: 'SIN RESULTADO',
  tbd: 'SIN HORA',
};

// ── Datos que se leen aparte ──────────────────────────────────────────────

type AnyFrom = (table: string) => any;

/**
 * Estado de cobro de MIS inscripciones en un torneo. La RPC pública no lo
 * expone; cada jugador puede leer las suyas bajo RLS. Si no puede, devuelve
 * vacío y la tarjeta «Estás dentro» se pinta sin el estado del pago.
 */
export async function fetchMyRegPayments(
  tournamentId: string,
  uid: string,
): Promise<Record<string, { status: string | null; method: string | null }>> {
  try {
    const { data, error } = await (supabase.from.bind(supabase) as unknown as AnyFrom)(
      'tournament_registrations',
    )
      .select('id, payment_status, payment_method')
      .eq('tournament_id', tournamentId)
      .or(`p1_user_id.eq.${uid},p2_user_id.eq.${uid}`);
    if (error) return {};
    const out: Record<string, { status: string | null; method: string | null }> = {};
    for (const r of (data ?? []) as {
      id: string;
      payment_status: string | null;
      payment_method: string | null;
    }[]) {
      out[r.id] = { status: r.payment_status, method: r.payment_method };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * ¿Cobra este torneo la inscripción online? (club con Stripe Connect activo).
 * Es solo INFORMACIÓN para el texto de la cuota; la app no abre ningún pago.
 * `null` = no se sabe (sin red): el texto se queda en «por persona».
 */
export async function fetchSignupOnline(tournamentId: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `${TACTIUM_WEB_BASE_URL}/api/tournaments/${encodeURIComponent(tournamentId)}/signup-connect`,
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { online?: boolean };
    return !!d.online;
  } catch {
    return null;
  }
}

/** «25 € por persona · se paga al apuntarte». */
export function feeText(
  t: Pick<Tournament, 'entry_fee' | 'fee_currency'>,
  online: boolean | null,
): { amount: string; note: string } {
  if (!t.entry_fee || t.entry_fee <= 0) return { amount: 'Gratis', note: 'sin cuota' };
  return {
    amount: `${formatFee(t.entry_fee, t.fee_currency)} por persona`,
    note:
      online === true
        ? 'se paga al apuntarte'
        : online === false
          ? 'se paga en el club'
          : '',
  };
}

// ── Mi camino en el cuadro ────────────────────────────────────────────────

export interface PathStep {
  key: string;
  round: string;
  rival: string;
  score: string | null;
  when: string | null;
  state: 'won' | 'lost' | 'current' | 'next';
}

const isKoMatch = (m: TournamentMatch) => isRoundBracket(m.bracket) && m.bracket !== 'grp';

/** Marcador desde MI lado: «6-3 6-4». */
export const scoreFor = (m: TournamentMatch, mineHome: boolean): string | null => {
  if (m.status !== 'finished') return null;
  if (Array.isArray(m.sets) && m.sets.length) {
    return m.sets.map((s) => (mineHome ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`)).join(' ');
  }
  if (m.home_score == null || m.away_score == null) return null;
  return mineHome ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`;
};

const whenLabel = (m: TournamentMatch, now: number): string | null => {
  if (!m.scheduled_at) return null;
  const iso = localIso(new Date(m.scheduled_at));
  const day = iso === localIso(new Date(now)) ? 'Hoy' : dayLabel(iso);
  return [day, hhmm(m.scheduled_at), m.court].filter(Boolean).join(' · ');
};

/**
 * Tu camino en el cuadro: lo jugado, lo que toca y lo que viene «si ganas».
 * Sale del cuadro (ronda siguiente = slot/2 en la ronda +1) y de la regla de la
 * consolación (el perdedor de la 1ª ronda baja al hueco slot/2 de su 1ª ronda).
 */
export function buildPath(
  t: Pick<Tournament, 'format'>,
  matches: TournamentMatch[],
  myIds: Set<string>,
  regById: Map<string, TournamentRegistration>,
  now: number,
): { steps: PathStep[]; current: TournamentMatch | null; consolNote: string | null } | null {
  const mine = matches
    .filter(
      (m) =>
        isKoMatch(m) &&
        m.status !== 'bye' &&
        [m.home_reg, m.away_reg].some((x) => x && myIds.has(x)),
    )
    .sort((a, b) => bracketRank(a.bracket) - bracketRank(b.bracket) || a.round - b.round);
  if (!mine.length) return null;

  const steps: PathStep[] = [];
  let current: TournamentMatch | null = null;
  for (const m of mine) {
    const mineHome = !!m.home_reg && myIds.has(m.home_reg);
    const rivalId = mineHome ? m.away_reg : m.home_reg;
    const done = m.status === 'finished';
    const won = done && !!m.winner_reg && myIds.has(m.winner_reg);
    if (!done && !current) current = m;
    steps.push({
      key: m.id,
      round: roundNameOf(m, matches),
      rival: rivalId ? pairLabel(regById.get(rivalId)) : 'Por determinar',
      score: scoreFor(m, mineHome),
      when: whenLabel(m, now),
      state: done ? (won ? 'won' : 'lost') : 'current',
    });
  }

  let consolNote: string | null = null;
  if (current) {
    const cur = current;
    const sameDiv = (x: TournamentMatch) =>
      x.bracket === cur.bracket && x.gender === cur.gender && x.category === cur.category;
    const next = matches.find(
      (x) => sameDiv(x) && x.round === cur.round + 1 && x.slot === Math.floor(cur.slot / 2),
    );
    if (next) {
      const sib = matches.find(
        (x) => sameDiv(x) && x.round === cur.round && x.slot === (cur.slot ^ 1),
      );
      let rival = 'por decidir';
      if (sib) {
        if (sib.status === 'finished' && sib.winner_reg) {
          rival = pairLabel(regById.get(sib.winner_reg));
        } else if (sib.status === 'bye') {
          const w = sib.home_reg ?? sib.away_reg;
          if (w) rival = pairLabel(regById.get(w));
        } else if (sib.home_reg && sib.away_reg) {
          rival = `${pairLabel(regById.get(sib.home_reg))} o ${pairLabel(regById.get(sib.away_reg))}`;
        }
      }
      steps.push({
        key: `next-${next.id}`,
        round: `${roundNameOf(next, matches)} si ganas`,
        rival,
        score: null,
        when: whenLabel(next, now),
        state: 'next',
      });
    }
    if (t.format === 'ko_consolation' && cur.bracket === 'main' && cur.round === 1) {
      const cm = matches.find(
        (x) =>
          x.bracket === 'consol' &&
          x.round === 1 &&
          x.slot === Math.floor(cur.slot / 2) &&
          x.gender === cur.gender &&
          x.category === cur.category,
      );
      const w = cm ? whenLabel(cm, now) : null;
      consolNote = w
        ? `Si pierdes, juegas la consolación: ${w.toLowerCase()}.`
        : 'Si pierdes, pasas al cuadro de consolación.';
    }
  }
  return { steps, current, consolNote };
}

// ── Estilos ───────────────────────────────────────────────────────────────

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.6,
      color: c.textFaint,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    // Tarjeta de partido (marcador)
    mCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    mCardMine: { borderColor: c.accent40 },
    mHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: c.hair,
    },
    mHeadText: {
      flex: 1,
      minWidth: 0,
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.1,
      color: c.textFaint,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1,
      fontWeight: '700',
    },
    mBody: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
    side: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sideNames: { flex: 1, minWidth: 0 },
    pName: { color: c.text, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
    pNameWin: { fontWeight: '800' },
    pNameLose: { color: c.textMuted },
    pNameTbd: { color: c.textFaint, fontStyle: 'italic' },
    seed: { color: c.textFaint, fontSize: 10, fontWeight: '700' },
    youTag: {
      paddingHorizontal: 6,
      height: 18,
      borderRadius: 5,
      backgroundColor: c.accent15,
      justifyContent: 'center',
    },
    youTagText: { color: c.accent, fontFamily: Fonts.mono, fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
    sets: { flexDirection: 'row', gap: 10 },
    set: {
      width: 16,
      textAlign: 'center',
      color: c.textMuted,
      fontFamily: Fonts.mono,
      fontSize: 15,
      fontWeight: '600',
    },
    setWin: { color: c.text, fontWeight: '800' },
    // Tablet: columnas por pista
    courtHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingBottom: 8,
      marginBottom: 10,
      borderBottomWidth: 2,
      borderBottomColor: c.hairStrong,
    },
    courtHeadText: {
      flex: 1,
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: c.text,
    },
    courtTime: {
      fontFamily: Fonts.mono,
      fontSize: 11.5,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 5,
    },
    timeLabel: {
      fontFamily: Fonts.mono,
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginTop: 16,
      marginBottom: 8,
    },
    // Tiras de día y filtros
    strip: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
    dayPill: {
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayPillOn: { backgroundColor: c.text, borderColor: c.text },
    dayPillText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    dayPillTextOn: { color: c.background },
    filterChip: {
      paddingHorizontal: 11,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipOn: { backgroundColor: c.accent10, borderColor: c.accent40 },
    filterChipText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    filterChipTextOn: { color: c.accent },
    metaLine: { color: c.textFaint, fontSize: 11.5, marginTop: 10 },
    empty: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: 14 },
    // Bloques del jugador
    block: {
      marginHorizontal: 22,
      marginTop: 14,
      padding: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    blockAccent: { borderColor: c.accent40 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    bigTitle: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
    sub: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
    codeBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
    code: {
      flex: 1,
      color: c.text,
      fontFamily: Fonts.mono,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 4,
    },
    smallBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.accent,
    },
    smallBtnText: { color: c.textInverse, fontSize: 13, fontWeight: '800' },
    ghostBtn: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: { color: c.text, fontSize: 13, fontWeight: '700' },
    bigTime: {
      color: c.text,
      fontFamily: Fonts.mono,
      fontSize: 38,
      fontWeight: '800',
      letterSpacing: -1,
    },
    bigCourt: { color: c.textMuted, fontSize: 17, fontWeight: '700' },
    stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 9 },
    stepDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    stepLine: { position: 'absolute', left: 4.5, top: 18, bottom: -9, width: 1, backgroundColor: c.hairStrong },
    stepTitle: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    stepMeta: { color: c.textFaint, fontSize: 11.5, marginTop: 2 },
    stepScore: { color: c.text, fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
    stat: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 6 },
    link: { color: c.accent, fontSize: 13, fontWeight: '800', marginTop: 12 },
  });

export type PartStyles = ReturnType<typeof makeStyles>;
export const usePartStyles = () => {
  const c = useColors();
  return useMemo(() => makeStyles(c), [c]);
};

// ── Piezas animadas pequeñas ──────────────────────────────────────────────

/** Punto rojo de «En juego» que late despacio (quieto con movimiento reducido). */
export const LiveDot: React.FC<{ size?: number; color?: string }> = ({ size = 8, color }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      o.value = 1;
      return;
    }
    o.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
    );
  }, [reduced, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? c.error },
        st,
      ]}
    />
  );
};

/** Chip de estado del partido («EN PISTA», «TERMINADO»…). */
export const StateChip: React.FC<{ state: LiveState }> = ({ state }) => {
  const c = useColors();
  const s = usePartStyles();
  const label = STATE_LABEL[state];
  if (!label) return null;
  const tone =
    state === 'live'
      ? { bg: c.accent15, bd: c.accent40, fg: c.accent }
      : state === 'soon'
        ? { bg: 'transparent', bd: c.accent40, fg: c.accent }
        : state === 'late'
          ? { bg: 'transparent', bd: c.hairStrong, fg: c.warning }
          : { bg: 'transparent', bd: c.hairStrong, fg: c.textFaint };
  return (
    <View style={[s.chip, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
      {state === 'live' ? <LiveDot size={6} color={c.accent} /> : null}
      <Text style={[s.chipText, { color: tone.fg }]}>{label}</Text>
    </View>
  );
};

/** Ilumina en verde 2 s cuando llega un resultado nuevo. */
const FlashView: React.FC<{ flash: boolean; children: React.ReactNode }> = ({ flash, children }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!flash) return;
    p.value = reduced
      ? withSequence(withTiming(1, { duration: 0 }), withDelay(1600, withTiming(0, { duration: 0 })))
      : withSequence(withTiming(1, { duration: 180 }), withDelay(1400, withTiming(0, { duration: 420 })));
  }, [flash, reduced, p]);
  const from = 'rgba(0,0,0,0)';
  const to = c.accent15;
  const st = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [from, to]),
  }));
  return <Animated.View style={[{ borderRadius: Radius.lg }, st]}>{children}</Animated.View>;
};

/** Campana de seguir: se rellena con un pequeño rebote. */
export const FollowBell: React.FC<{
  on: boolean;
  onPress: () => void;
  color?: string;
  style?: any;
}> = ({ on, onPress, color, style }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const sc = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on && !reduced) {
      sc.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 260 }));
    }
  }, [on, reduced, sc]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable
      onPress={() => {
        try {
          Haptics.selectionAsync().catch(() => {});
        } catch {
          /* sin háptica */
        }
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Dejar de seguir el torneo' : 'Seguir el torneo'}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
    >
      <Animated.View style={st}>
        <IconBell size={18} color={on ? c.accent : color ?? c.text} />
      </Animated.View>
    </Pressable>
  );
};

/** Trofeo que entra con un brillo una sola vez. */
export const TrophyShine: React.FC<{ size?: number }> = ({ size = 18 }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const sc = useSharedValue(reduced ? 1 : 0.6);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    sc.value = withSpring(1, { damping: 9, stiffness: 180 });
    glow.value = withSequence(
      withDelay(150, withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) })),
      withTiming(0, { duration: 700 }),
    );
  }, [reduced, sc, glow]);
  const iconSt = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const glowSt = useAnimatedStyle(() => ({ opacity: glow.value * 0.9, transform: [{ scale: 0.8 + glow.value * 0.8 }] }));
  return (
    <View style={{ width: size + 8, height: size + 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            backgroundColor: c.accent25,
          },
          glowSt,
        ]}
      />
      <Animated.View style={iconSt}>
        <IconTrophy size={size} color={c.accent} />
      </Animated.View>
    </View>
  );
};

// ── Tarjeta de partido (estilo marcador) ──────────────────────────────────

type SideInfo = { lines: string[]; seed: number | null; tbd: boolean; mine: boolean };

const sideOf = (
  m: TournamentMatch,
  home: boolean,
  regById: Map<string, TournamentRegistration>,
  myIds: Set<string>,
  social: boolean,
): SideInfo => {
  const a = home ? m.home_reg : m.away_reg;
  const b = home ? m.home_reg2 : m.away_reg2;
  if (!a) return { lines: [m.round === 1 && m.bracket === 'main' ? 'BYE' : 'Por determinar'], seed: null, tbd: true, mine: false };
  const ra = regById.get(a);
  if (social) {
    const rb = b ? regById.get(b) : undefined;
    return {
      lines: [ra?.p1_name ?? '—', ...(rb ? [rb.p1_name] : [])],
      seed: null,
      tbd: false,
      mine: myIds.has(a) || (!!b && myIds.has(b)),
    };
  }
  return {
    lines: [ra?.p1_name ?? '—', ...(ra?.p2_name ? [ra.p2_name] : [])],
    seed: ra?.seed ?? null,
    tbd: false,
    mine: myIds.has(a),
  };
};

export const MatchDayCard: React.FC<{
  m: TournamentMatch;
  all: TournamentMatch[];
  regById: Map<string, TournamentRegistration>;
  myIds: Set<string>;
  state: LiveState;
  social: boolean;
  showDiv: boolean;
  flash?: boolean;
  tag?: string | null;
  onPress?: (m: TournamentMatch) => void;
}> = ({ m, all, regById, myIds, state, social, showDiv, flash, tag, onPress }) => {
  const c = useColors();
  const s = usePartStyles();
  const home = sideOf(m, true, regById, myIds, social);
  const away = sideOf(m, false, regById, myIds, social);
  const finished = m.status === 'finished';
  const homeWin = finished && !!m.winner_reg && m.winner_reg === m.home_reg;
  const awayWin = finished && !!m.winner_reg && m.winner_reg === m.away_reg;
  const sets = !social && Array.isArray(m.sets) && m.sets.length ? m.sets : null;
  const head = [
    m.court ?? (m.scheduled_at ? null : 'Sin hora'),
    showDiv ? divShort(m.gender, m.category) : null,
    roundNameOf(m, all),
  ]
    .filter(Boolean)
    .join(' · ');

  const scoreCol = (sideIdx: 0 | 1, win: boolean) => {
    if (!finished) return null;
    if (sets)
      return (
        <View style={s.sets}>
          {sets.map((st, i) => {
            const mineV = st[sideIdx];
            const other = st[1 - sideIdx];
            return (
              <Text key={i} style={[s.set, mineV > other && s.setWin]}>
                {mineV}
              </Text>
            );
          })}
        </View>
      );
    const v = sideIdx === 0 ? m.home_score : m.away_score;
    return <Text style={[s.set, { width: 24 }, win && s.setWin]}>{v ?? ''}</Text>;
  };

  const sideView = (x: SideInfo, win: boolean, idx: 0 | 1) => (
    <View style={s.side}>
      <View style={s.sideNames}>
        {x.lines.map((ln, i) => (
          <Text
            key={i}
            numberOfLines={1}
            style={[
              s.pName,
              x.tbd && s.pNameTbd,
              finished && win && s.pNameWin,
              finished && !win && s.pNameLose,
            ]}
          >
            {ln}
            {i === 0 && x.seed ? <Text style={s.seed}> ({x.seed})</Text> : null}
          </Text>
        ))}
      </View>
      {x.mine ? (
        <View style={s.youTag}>
          <Text style={s.youTagText}>TÚ</Text>
        </View>
      ) : null}
      {scoreCol(idx, win)}
    </View>
  );

  const mine = home.mine || away.mine;
  const body = (
    <View style={[s.mCard, mine && s.mCardMine]}>
      <View style={s.mHead}>
        <Text style={s.mHeadText} numberOfLines={1}>
          {head}
        </Text>
        <StateChip state={state} />
        {onPress ? <IconChevron size={13} color={c.textFaint} /> : null}
      </View>
      {tag ? (
        <Text style={{ color: c.warning, fontSize: 11.5, fontWeight: '700', paddingHorizontal: 12, paddingTop: 8 }}>
          {tag}
        </Text>
      ) : null}
      <View style={s.mBody}>
        {sideView(home, homeWin, 0)}
        <View style={{ height: 1, backgroundColor: c.hair }} />
        {sideView(away, awayWin, 1)}
      </View>
    </View>
  );
  return (
    <FlashView flash={!!flash}>
      {onPress ? (
        <Pressable onPress={() => onPress(m)} style={({ pressed }) => pressed && { opacity: 0.85 }}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </FlashView>
  );
};

// ── Pestaña «Partidos»: por día y hora ────────────────────────────────────

export const MatchesByDay: React.FC<{
  tournament: Pick<Tournament, 'format' | 'slot_minutes'>;
  matches: TournamentMatch[];
  regs: TournamentRegistration[];
  myRegIds?: string[];
  /** Organizador: tocar un partido abre el resultado. */
  onEdit?: (m: TournamentMatch) => void;
  /** Aviso de conflicto por partido (solo organizador). */
  conflictOf?: (m: TournamentMatch) => string | null;
  /** Ids de partidos con resultado recién llegado (se iluminan 2 s). */
  fresh?: Set<string>;
  /** Última recarga (para «Act. hace 20 s»). */
  updatedAt?: number | null;
  emptyText?: string;
  /** Sin margen lateral propio (va dentro de otra vista con margen). */
  bare?: boolean;
}> = ({ tournament, matches, regs, myRegIds, onEdit, conflictOf, fresh, updatedAt, emptyText, bare }) => {
  const pad = bare ? 0 : 22;
  const c = useColors();
  const s = usePartStyles();
  // TABLET: el día se ve pista por pista (una columna por pista, con
  // desplazamiento horizontal si no caben). En móvil, por hora como siempre.
  const { isTablet } = useLayout();
  const [boxW, setBoxW] = useState(0);
  const now = useNow(updatedAt ? 10_000 : 60_000);
  const social = tournament.format === 'americano' || tournament.format === 'mexicano';
  const regById = useMemo(() => new Map(regs.map((r) => [r.id, r])), [regs]);
  const myIds = useMemo(() => new Set(myRegIds ?? []), [myRegIds]);
  const playable = useMemo(() => matches.filter((m) => m.status !== 'bye'), [matches]);

  const divisions = useMemo(() => {
    const seen = new Map<string, { gender: string | null; category: string | null }>();
    for (const m of playable) {
      const k = `${m.gender ?? ''}|${m.category ?? ''}`;
      if (!seen.has(k)) seen.set(k, { gender: m.gender, category: m.category });
    }
    return [...seen.entries()].map(([k, d]) => ({ key: k, label: divShort(d.gender, d.category) }));
  }, [playable]);
  const multiDiv = divisions.length > 1;

  const [onlyMine, setOnlyMine] = useState(false);
  const [div, setDiv] = useState<string | null>(null);

  const filtered = playable.filter((m) => {
    if (div && `${m.gender ?? ''}|${m.category ?? ''}` !== div) return false;
    if (onlyMine) {
      const ids = [m.home_reg, m.away_reg, m.home_reg2, m.away_reg2];
      if (!ids.some((x) => x && myIds.has(x))) return false;
    }
    return true;
  });

  // Días con partidos (+ «Sin hora» para los que tienen parejas y aún no hora).
  const days = useMemo(() => {
    const set = new Set<string>();
    for (const m of playable) if (m.scheduled_at) set.add(localIso(new Date(m.scheduled_at)));
    return [...set].sort();
  }, [playable]);
  const hasUnscheduled = filtered.some((m) => !m.scheduled_at && !!m.home_reg && !!m.away_reg);
  const today = localIso(new Date(now));
  const defaultDay = days.includes(today)
    ? today
    : days.find((d) => d > today) ?? days[days.length - 1] ?? (hasUnscheduled ? 'none' : null);
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day && (days.includes(day) || day === 'none') ? day : defaultDay;

  const list = filtered
    .filter((m) =>
      activeDay === 'none'
        ? !m.scheduled_at && !!m.home_reg && !!m.away_reg
        : !!m.scheduled_at && localIso(new Date(m.scheduled_at)) === activeDay,
    )
    .sort(
      (a, b) =>
        (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '') ||
        (a.court ?? '').localeCompare(b.court ?? '', 'es', { numeric: true }),
    );
  const groups: { time: string; items: TournamentMatch[] }[] = [];
  for (const m of list) {
    const tm = hhmm(m.scheduled_at) ?? 'Sin hora';
    const g = groups.find((x) => x.time === tm);
    if (g) g.items.push(m);
    else groups.push({ time: tm, items: [m] });
  }

  const ago = agoLabel(updatedAt ?? null, now);

  const byCourt = isTablet && activeDay !== 'none' && list.length > 0;
  const courtCols: [string, TournamentMatch[]][] = (() => {
    if (!byCourt) return [];
    const map = new Map<string, TournamentMatch[]>();
    for (const m of list) {
      const k = m.court?.trim() || 'Sin pista';
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === 'Sin pista'
        ? 1
        : b[0] === 'Sin pista'
          ? -1
          : a[0].localeCompare(b[0], 'es', { numeric: true }),
    );
  })();
  const COURT_GAP = 10;
  const courtW = Math.max(
    250,
    boxW > 0 && courtCols.length
      ? Math.floor((boxW - COURT_GAP * (courtCols.length - 1)) / courtCols.length)
      : 250,
  );

  if (playable.length === 0) {
    return (
      <View style={{ paddingHorizontal: pad }}>
        <Text style={s.empty}>
          {emptyText ??
            'Los partidos salen cuando el club publique el cuadro. Aquí verás cada día quién juega, a qué hora y en qué pista.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: pad }}>
      {days.length + (hasUnscheduled ? 1 : 0) > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
          {days.map((d) => {
            const on = d === activeDay;
            return (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[s.dayPill, on && s.dayPillOn]}
              >
                <Text style={[s.dayPillText, on && s.dayPillTextOn]}>
                  {d === today ? `Hoy · ${dayLabel(d)}` : dayLabel(d)}
                </Text>
              </Pressable>
            );
          })}
          {hasUnscheduled ? (
            <Pressable
              onPress={() => setDay('none')}
              style={[s.dayPill, activeDay === 'none' && s.dayPillOn]}
            >
              <Text style={[s.dayPillText, activeDay === 'none' && s.dayPillTextOn]}>Sin hora</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      {myIds.size > 0 || multiDiv ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.strip, { marginTop: 10 }]}
        >
          <Pressable
            onPress={() => {
              setOnlyMine(false);
              setDiv(null);
            }}
            style={[s.filterChip, !onlyMine && !div && s.filterChipOn]}
          >
            <Text style={[s.filterChipText, !onlyMine && !div && s.filterChipTextOn]}>Todos</Text>
          </Pressable>
          {myIds.size > 0 ? (
            <Pressable
              onPress={() => setOnlyMine((v) => !v)}
              style={[s.filterChip, onlyMine && s.filterChipOn]}
            >
              <Text style={[s.filterChipText, onlyMine && s.filterChipTextOn]}>Los míos</Text>
            </Pressable>
          ) : null}
          {multiDiv
            ? divisions.map((d) => {
                const on = div === d.key;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => setDiv(on ? null : d.key)}
                    style={[s.filterChip, on && s.filterChipOn]}
                  >
                    <Text style={[s.filterChipText, on && s.filterChipTextOn]}>{d.label}</Text>
                  </Pressable>
                );
              })
            : null}
        </ScrollView>
      ) : null}

      {ago ? (
        <Text style={s.metaLine}>
          Act. {ago} · «En pista» sale del horario: el resultado llega cuando el club lo mete.
        </Text>
      ) : null}

      {groups.length === 0 ? (
        <Text style={s.empty}>
          {onlyMine ? 'Este día no juegas.' : 'No hay partidos con este filtro.'}
        </Text>
      ) : byCourt ? (
        <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} style={{ marginTop: 14 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: COURT_GAP }}
          >
            {courtCols.map(([court, items]) => {
              const live = items.some(
                (m) => matchLiveState(m, now, tournament.slot_minutes || 90) === 'live',
              );
              return (
                <View key={court} style={{ width: courtW }}>
                  <View style={[s.courtHead, live && { borderBottomColor: c.accent }]}>
                    <Text style={s.courtHeadText} numberOfLines={1}>
                      {court.toUpperCase()}
                    </Text>
                    {live ? <LiveDot size={7} /> : null}
                  </View>
                  <View style={{ gap: 10 }}>
                    {items.map((m) => (
                      <View key={m.id}>
                        <Text style={s.courtTime}>{hhmm(m.scheduled_at) ?? 'Sin hora'}</Text>
                        <MatchDayCard
                          m={m}
                          all={matches}
                          regById={regById}
                          myIds={myIds}
                          state={matchLiveState(m, now, tournament.slot_minutes || 90)}
                          social={social}
                          showDiv={multiDiv}
                          flash={fresh?.has(m.id)}
                          tag={conflictOf ? conflictOf(m) : null}
                          onPress={onEdit && m.home_reg && m.away_reg ? onEdit : undefined}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.time}>
            <Text style={s.timeLabel}>{g.time}</Text>
            <View style={{ gap: 8 }}>
              {g.items.map((m) => (
                <MatchDayCard
                  key={m.id}
                  m={m}
                  all={matches}
                  regById={regById}
                  myIds={myIds}
                  state={matchLiveState(m, now, tournament.slot_minutes || 90)}
                  social={social}
                  showDiv={multiDiv}
                  flash={fresh?.has(m.id)}
                  tag={conflictOf ? conflictOf(m) : null}
                  onPress={onEdit && m.home_reg && m.away_reg ? onEdit : undefined}
                />
              ))}
            </View>
          </View>
        ))
      )}
      <View style={{ height: 6 }} />
    </View>
  );
};

// ── «Estás dentro» ────────────────────────────────────────────────────────

export const YouAreInCard: React.FC<{
  t: Tournament;
  reg: TournamentRegistration;
  payment: { status: string | null; method: string | null } | null;
  partnerCode: string | null;
  hasBracket: boolean;
  onSendCode: (code: string) => void;
}> = ({ t, reg, payment, partnerCode, hasBracket, onSendCode }) => {
  const c = useColors();
  const s = usePartStyles();
  const fee = t.entry_fee && t.entry_fee > 0 ? formatFee(t.entry_fee, t.fee_currency) : null;
  const st = payment?.status ?? null;
  const chip =
    st === 'paid'
      ? { text: payment?.method === 'stripe' ? 'Pagado online' : 'Pagado', fg: c.accent, bd: c.accent40 }
      : st === 'pending_club'
        ? { text: 'Pago pendiente', fg: c.warning, bd: c.hairStrong }
        : !fee
          ? { text: 'Gratis', fg: c.textMuted, bd: c.hairStrong }
          : null;
  const payLine = !fee
    ? null
    : st === 'pending_club'
      ? `Cuota: ${fee} por persona. Pagas en el club el día del torneo.`
      : st === 'paid'
        ? payment?.method === 'stripe'
          ? `Cuota: ${fee} por persona, pagada online al apuntarte.`
          : `Cuota: ${fee} por persona, pagada en el club.`
        : `Cuota: ${fee} por persona.`;
  const partnerName = reg.p2_name ? reg.p2_name.split(/\s+/)[0] : 'tu pareja';
  return (
    <View style={[s.block, s.blockAccent]}>
      <View style={s.rowBetween}>
        <Text style={[s.eyebrow, { color: c.accent }]} numberOfLines={1}>
          Estás dentro · {divShort(reg.gender, reg.category)}
        </Text>
        {chip ? (
          <View style={[s.chip, { borderColor: chip.bd }]}>
            <Text style={[s.chipText, { color: chip.fg }]}>{chip.text.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.bigTitle} numberOfLines={2}>
        {pairLabel(reg)}
      </Text>
      <Text style={s.sub}>
        {[
          reg.seed_points != null ? `${fmtPts(reg.seed_points)} pts` : null,
          reg.seed ? `cabeza de serie ${reg.seed}` : null,
          hasBracket ? null : 'el cuadro sale cuando cierre la inscripción',
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {payLine ? <Text style={[s.sub, { marginTop: 8 }]}>{payLine}</Text> : null}
      {partnerCode && !reg.p2_user_id ? (
        <View style={s.codeBox}>
          <Text style={s.eyebrow}>Tu pareja aún no tiene cuenta</Text>
          <View style={s.codeRow}>
            <Text style={s.code} selectable>
              {partnerCode}
            </Text>
            <Pressable
              onPress={() => onSendCode(partnerCode)}
              style={({ pressed }) => [s.smallBtn, pressed && { opacity: 0.85 }]}
            >
              <IconShare size={14} color={c.textInverse} />
              <Text style={s.smallBtnText}>Enviárselo</Text>
            </Pressable>
          </View>
          <Text style={s.sub}>
            Con este código {partnerName} ve el torneo y sus partidos en su móvil.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// ── «Tu próximo partido» + tu camino ──────────────────────────────────────

export const NextMatchCard: React.FC<{
  t: Tournament;
  match: TournamentMatch;
  matches: TournamentMatch[];
  regById: Map<string, TournamentRegistration>;
  myIds: Set<string>;
  path: PathStep[];
  consolNote: string | null;
  onSeeBracket: () => void;
  onSeeMatches: () => void;
}> = ({ t, match, matches, regById, myIds, path, consolNote, onSeeBracket, onSeeMatches }) => {
  const c = useColors();
  const s = usePartStyles();
  const now = useNow(60_000);
  const mineHome = !!match.home_reg && myIds.has(match.home_reg);
  const rivalId = mineHome ? match.away_reg : match.home_reg;
  const rival = rivalId ? regById.get(rivalId) : undefined;
  const state = matchLiveState(match, now, t.slot_minutes || 90);
  const cd = match.scheduled_at ? countdown(match.scheduled_at, now) : null;
  const live = state === 'live';
  // Cómo llegó el rival: su último partido ganado en el cuadro.
  const rivalPrev = rivalId
    ? matches
        .filter(
          (m) =>
            m.status === 'finished' &&
            m.winner_reg === rivalId &&
            m.bracket === match.bracket &&
            m.round < match.round,
        )
        .sort((a, b) => b.round - a.round)[0]
    : undefined;
  const rivalPrevText = rivalPrev
    ? `ganaron ${scoreFor(rivalPrev, rivalPrev.home_reg === rivalId) ?? ''} en ${roundNameOf(rivalPrev, matches).toLowerCase()}`
    : null;
  const urgentColor = live || cd?.urgent ? c.accent : c.textMuted;
  return (
    <View style={[s.block, s.blockAccent]}>
      <View style={s.rowBetween}>
        <Text style={[s.eyebrow, { color: c.accent }]} numberOfLines={1}>
          Tu próximo partido · {roundNameOf(match, matches)}
        </Text>
        {live ? (
          <StateChip state="live" />
        ) : cd ? (
          <Text style={{ color: urgentColor, fontFamily: Fonts.mono, fontSize: 12, fontWeight: '800' }}>
            {cd.text}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 8 }}>
        <Text style={s.bigTime}>{hhmm(match.scheduled_at) ?? '--:--'}</Text>
        <Text style={s.bigCourt}>{match.court ?? 'Pista por confirmar'}</Text>
      </View>
      {match.scheduled_at &&
      localIso(new Date(match.scheduled_at)) !== localIso(new Date(now)) ? (
        <Text style={s.sub}>{longDay(localIso(new Date(match.scheduled_at)))}</Text>
      ) : null}
      <Text style={[s.stepTitle, { marginTop: 10 }]} numberOfLines={2}>
        vs {rival ? pairLabel(rival) : 'por determinar'}
        {rival?.seed ? ` · cabeza de serie ${rival.seed}` : ''}
      </Text>
      {rival && (rival.seed_points != null || rivalPrevText) ? (
        <Text style={s.sub}>
          {[rival.seed_points != null ? `${fmtPts(rival.seed_points)} pts` : null, rivalPrevText]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}

      {path.length > 1 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={s.eyebrow}>Tu camino · {divShort(match.gender, match.category)}</Text>
          <View style={{ marginTop: 6 }}>
            {path.map((p, i) => {
              const dot =
                p.state === 'won'
                  ? c.accent
                  : p.state === 'lost'
                    ? c.error
                    : p.state === 'current'
                      ? c.text
                      : c.hairStrong;
              return (
                <View key={p.key} style={s.stepRow}>
                  <View>
                    <View style={[s.stepDot, { backgroundColor: dot }]} />
                    {i < path.length - 1 ? <View style={s.stepLine} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[s.stepTitle, p.state === 'next' && { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {p.round} · vs {p.rival}
                    </Text>
                    {p.when ? <Text style={s.stepMeta}>{p.when}</Text> : null}
                  </View>
                  {p.score ? <Text style={s.stepScore}>{p.score}</Text> : null}
                </View>
              );
            })}
          </View>
          {consolNote ? <Text style={s.sub}>{consolNote}</Text> : null}
        </View>
      ) : consolNote ? (
        <Text style={[s.sub, { marginTop: 10 }]}>{consolNote}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Pressable onPress={onSeeBracket} style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.8 }]}>
          <Text style={s.ghostBtnText}>Ver cuadro</Text>
        </Pressable>
        <Pressable onPress={onSeeMatches} style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.8 }]}>
          <Text style={s.ghostBtnText}>Ver todos los partidos</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ── «Tu torneo» (resumen al terminar) ─────────────────────────────────────

export function summarizeMyTournament(
  matches: TournamentMatch[],
  myIds: Set<string>,
): { reached: string; wins: number; losses: number; games: number } | null {
  const mine = matches.filter(
    (m) =>
      m.status === 'finished' &&
      [m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && myIds.has(x)),
  );
  if (!mine.length) return null;
  let wins = 0;
  let losses = 0;
  let games = 0;
  for (const m of mine) {
    const home = [m.home_reg, m.home_reg2].some((x) => x && myIds.has(x));
    const won = !!m.winner_reg && myIds.has(m.winner_reg);
    if (won) wins++;
    else losses++;
    if (Array.isArray(m.sets) && m.sets.length) {
      for (const st of m.sets) games += home ? st[0] ?? 0 : st[1] ?? 0;
    } else {
      games += (home ? m.home_score : m.away_score) ?? 0;
    }
  }
  // Hasta dónde llegaste: tu partido más avanzado del cuadro principal.
  const mainKo = mine
    .filter((m) => m.bracket === 'main' || m.bracket === 'gold')
    .sort((a, b) => b.round - a.round)[0];
  let reached = 'Fase de grupos';
  if (mainKo) {
    const name = roundNameOf(mainKo, matches);
    const won = !!mainKo.winner_reg && myIds.has(mainKo.winner_reg);
    reached = name === 'Final' ? (won ? 'Campeones' : 'Final · subcampeones') : name === 'Cuartos' ? 'Cuartos de final' : name;
  } else if (mine.some((m) => m.bracket === 'consol')) {
    reached = 'Consolación';
  } else if (mine.some((m) => m.bracket === 'amer' || m.bracket === 'mex' || m.bracket === 'rr')) {
    reached = 'Torneo completado';
  }
  return { reached, wins, losses, games };
}

export const MySummaryCard: React.FC<{
  summary: { reached: string; wins: number; losses: number; games: number };
  onShare: () => void;
}> = ({ summary, onShare }) => {
  const s = usePartStyles();
  const vic = summary.wins === 1 ? 'victoria' : 'victorias';
  const der = summary.losses === 1 ? 'derrota' : 'derrotas';
  return (
    <View style={s.block}>
      <Text style={s.eyebrow}>Tu torneo</Text>
      <Text style={s.stat}>{summary.reached}</Text>
      <Text style={s.sub}>
        {summary.wins} {vic}, {summary.losses} {der} · {summary.games} juegos ganados
      </Text>
      <Pressable onPress={onShare} hitSlop={8}>
        <Text style={s.link}>Compartir mi torneo →</Text>
      </Pressable>
    </View>
  );
};
