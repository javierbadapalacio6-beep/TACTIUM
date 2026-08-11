import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import * as ImagePicker from 'expo-image-picker';
import { IconBack, IconShare, IconTrophy, IconTrash, IconPencil, IconCamera, BottomSheet } from '@components/ui';
import {
  TimeField,
  DateField,
  isoTimeToDate,
  dateToIsoTime,
  isoDateToDate,
  dateToIsoDate,
} from '@components/ui/DateTimeField';
import { toast } from '@store/toastStore';
import { notifyTournamentPush } from '@core/push';
import {
  getTournament,
  updateTournament,
  deleteTournament,
  uploadTournamentCover,
  listRegistrations,
  listMatches,
  addRegistration,
  deleteRegistration,
  generateKoBracket,
  generateRoundRobin,
  generateGroups,
  generateKnockoutFromGroups,
  generatePrincipalConsolationFromGroups,
  generateAmericano,
  generateMexicanoRound,
  computeStandings,
  computeIndividualStandings,
  setSocialResult,
  autoScheduleTournament,
  updateTournamentSchedule,
  clearSchedule,
  clearMatchSlot,
  matchScheduleConflict,
  matchAvailableAtDate,
  setMatchSlot,
  getPhaseDays,
  togglePhaseDay,
  isSocialFormat,
  posBracket,
  bracketLabel,
  bracketRank,
  isRoundBracket,
  matchPhaseKey,
  koRoundNameFromEnd,
  tournamentStatusLabel,
  formatFee,
  prizeItemLabel,
  type PrizeEntry,
  type InfoRow,
  groupName,
  setMatchResult,
  formatConfig,
  resolveMatchFormat,
  type Tournament,
  type TournamentRegistration,
  type TournamentMatch,
  type StandingRow,
  type PlayerStanding,
  type SeedingMode,
  type MatchFormat,
} from '@core/services/tournaments';
import { startTournamentCheckout } from '@core/services/tournamentCheckout';
import { PrizeInfoEditor } from '../components/PrizeInfoEditor';

import type { TournamentsStackScreenProps } from '@navigation/types';

const roundLabel = (round: number, total: number): string => {
  const fromEnd = total - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinales';
  if (fromEnd === 2) return 'Cuartos';
  if (fromEnd === 3) return 'Octavos';
  return `Ronda ${round}`;
};
const shortRoundLabel = (round: number, total: number): string => {
  const fromEnd = total - round;
  if (fromEnd === 0) return 'F';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  if (fromEnd === 3) return '8';
  return `R${round}`;
};

// Geometría del cuadro (para alinear rondas y dibujar los conectores en L).
const BRACKET_H = 60; // alto de cada partido
const BRACKET_G = 16; // hueco base entre partidos de la 1ª ronda
const COL_W = 198; // ancho de columna de ronda
const CONN_W = 26; // ancho de la columna de conectores
const HEADER_H = 46; // alto reservado para la cabecera de ronda
const PITCH1 = BRACKET_H + BRACKET_G;
const roundMetrics = (r: number) => ({
  pitch: PITCH1 * Math.pow(2, r - 1),
  topOffset: (PITCH1 * (Math.pow(2, r - 1) - 1)) / 2,
});

// Líneas conectoras en L entre la ronda `round` y la siguiente.
const RoundConnectors: React.FC<{
  round: number;
  targets: number;
  totalH: number;
  line: string;
  hidden: boolean;
}> = ({ round, targets, totalH, line, hidden }) => {
  if (hidden) return <View style={{ width: CONN_W }} />;
  const mR = roundMetrics(round);
  const mN = roundMetrics(round + 1);
  return (
    <View style={{ width: CONN_W }}>
      <View style={{ height: HEADER_H }} />
      <View style={{ height: totalH }}>
        {Array.from({ length: targets }, (_, k) => {
          const yA = mR.topOffset + 2 * k * mR.pitch + BRACKET_H / 2;
          const yB = mR.topOffset + (2 * k + 1) * mR.pitch + BRACKET_H / 2;
          const yT = mN.topOffset + k * mN.pitch + BRACKET_H / 2;
          const top = Math.min(yA, yB);
          const h = Math.abs(yB - yA);
          return (
            <React.Fragment key={k}>
              <View style={{ position: 'absolute', left: 0, top: yA, width: CONN_W / 2, height: 1.5, backgroundColor: line }} />
              <View style={{ position: 'absolute', left: 0, top: yB, width: CONN_W / 2, height: 1.5, backgroundColor: line }} />
              <View style={{ position: 'absolute', left: CONN_W / 2 - 0.75, top, width: 1.5, height: h, backgroundColor: line }} />
              <View style={{ position: 'absolute', left: CONN_W / 2, top: yT, width: CONN_W / 2, height: 1.5, backgroundColor: line }} />
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

// Una "división" = un cuadro: combinación de género y categoría.
export interface Division {
  gender: string | null;
  category: string | null;
}
export const sameDiv = (a: Division, b: Division) =>
  a.gender === b.gender && a.category === b.category;
export const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};
export const divLabel = (d: Division): string =>
  [d.gender ? GENDER_LABEL[d.gender] ?? d.gender : null, d.category]
    .filter(Boolean)
    .join(' · ') || 'General';

export const STATUS_LABEL: Record<string, string> = {
  draft: 'BORRADOR',
  open: 'ABIERTO',
  in_progress: 'EN JUEGO',
  finished: 'COMPLETADO',
  canceled: 'CANCELADO',
};

export const FORMAT_LABEL: Record<string, string> = {
  ko: 'Eliminación directa',
  ko_consolation: 'Eliminación + consolación',
  round_robin: 'Liga · todos contra todos',
  groups_ko: 'Grupos + eliminatorias',
  americano: 'Americano',
  mexicano: 'Mexicano',
};

// Formatos de partido y cuadros con formato propio (espejo del asistente de
// crear en ClubTournamentsScreen; las claves casan con `phaseFormatGroup`).
const MATCH_FORMATS: { id: MatchFormat; label: string; sub: string }[] = [
  { id: 'bo3_stb', label: 'Mejor de 3 · super tie-break', sub: '2 sets; si 1-1, super TB a 11 (dif. 2)' },
  { id: 'bo3_full', label: 'Mejor de 3 sets', sub: '2 sets; 3º set completo si 1-1' },
  { id: 'bo1', label: '1 set', sub: 'Un solo set decide' },
];
const MATCH_FORMAT_CUADROS: Record<string, { key: string; label: string }[]> = {
  ko: [{ key: 'main', label: '' }],
  ko_consolation: [
    { key: 'main', label: 'Cuadro principal' },
    { key: 'consol', label: 'Cuadro de consolación' },
  ],
  groups_ko: [
    { key: 'groups', label: 'Fase de grupos' },
    { key: 'main', label: 'Cuadro principal' },
    { key: 'consol', label: 'Cuadro de consolación' },
  ],
  round_robin: [{ key: 'groups', label: '' }],
};
const cuadrosForFormat = (f: string) => MATCH_FORMAT_CUADROS[f] ?? [{ key: 'main', label: '' }];

export const formatStartsOn = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
};

export type TabKey = 'main' | 'schedule' | 'players' | 'info';

// Hora "HH:MM" a partir de un scheduled_at ISO (hora local del dispositivo).
export const fmtTime = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const DOW_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// "Sáb 15 · 10:00" a partir de un scheduled_at ISO.
export const fmtDayTime = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DOW_ABBR[d.getDay()]} ${d.getDate()} · ${time}`;
};
// Días del torneo (inicio → fin) como [{iso, label}].
const buildTournamentDays = (
  startsOn: string | null,
  endsOn: string | null,
): { iso: string; label: string }[] => {
  if (!startsOn) return [];
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(startsOn);
  const end = endsOn ? parse(endsOn) : start;
  const out: { iso: string; label: string }[] = [];
  const d = new Date(start);
  let g = 0;
  while (d.getTime() <= end.getTime() && g < 40) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ iso, label: `${DOW_ABBR[d.getDay()]} ${d.getDate()}` });
    d.setDate(d.getDate() + 1);
    g++;
  }
  return out;
};

// Fases GENÉRICAS para asignar días (compartidas por todos los cuadros).
const buildPlannerPhases = (
  format: string,
  matches: TournamentMatch[],
): { bracket: string; round: number; label: string }[] => {
  const out: { bracket: string; round: number; label: string }[] = [];
  if (format === 'groups_ko' || matches.some((m) => m.bracket === 'grp'))
    out.push({ bracket: 'grp', round: 0, label: 'Fase de grupos' });
  if (format === 'round_robin') out.push({ bracket: 'rr', round: 0, label: 'Liga' });
  if (format === 'americano') out.push({ bracket: 'amer', round: 0, label: 'Americano' });
  if (format === 'mexicano') out.push({ bracket: 'mex', round: 0, label: 'Mexicano' });
  if (format === 'ko' || format === 'ko_consolation' || format === 'groups_ko') {
    const ko = matches.filter((m) => isRoundBracket(m.bracket));
    let fromEnds: number[];
    if (ko.length) {
      const maxByB: Record<string, number> = {};
      for (const m of ko) maxByB[m.bracket] = Math.max(maxByB[m.bracket] ?? 0, m.round);
      fromEnds = Array.from(new Set(ko.map((m) => maxByB[m.bracket] - m.round)));
    } else {
      fromEnds = [3, 2, 1, 0];
    }
    fromEnds.sort((a, b) => b - a);
    for (const fe of fromEnds) out.push({ bracket: 'ko', round: fe, label: koRoundNameFromEnd(fe) });
  }
  return out;
};

// Datos de una inscripción para pintar la tarjeta de partido pro.
export type RegInfo = {
  name: string;
  partner: string | null;
  seed: number | null;
  avatar: string | null;
  partnerAvatar: string | null;
};

// Pareja de avatares solapados (o uno solo). Muestra la foto de ambos si la tienen.
const AvatarPair: React.FC<{
  info: RegInfo;
  size?: number;
  styles: Styles;
  c: Palette;
}> = ({ info, size = 26, styles, c }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <TAvatar name={info.name} url={info.avatar} size={size} styles={styles} c={c} />
    {info.partner ? (
      <View style={{ marginLeft: -size * 0.42 }}>
        <TAvatar name={info.partner} url={info.partnerAvatar} size={size} styles={styles} c={c} />
      </View>
    ) : null}
  </View>
);

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

// Avatar redondo pequeño: foto del jugador si la tiene, si no iniciales.
const TAvatar: React.FC<{
  name: string;
  url: string | null;
  size?: number;
  styles: Styles;
  c: Palette;
}> = ({ name, url, size = 26, styles, c }) => {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: c.hairStrong }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.4 }]}>{initialsOf(name)}</Text>
    </View>
  );
};

// Lado de un partido (una pareja): avatar(es) + nombre + siembra en superíndice.
const MatchTeam: React.FC<{
  info: RegInfo;
  win: boolean;
  bye?: boolean;
  styles: Styles;
  c: Palette;
  tbd?: boolean;
}> = ({ info, win, bye, tbd, styles, c }) => {
  if (bye || tbd) {
    return (
      <View style={styles.teamRow}>
        <View style={[styles.avatarFallback, { width: 26, height: 26, borderRadius: 13, opacity: 0.5 }]} />
        <Text style={styles.byeText}>{tbd ? 'Por determinar' : 'BYE'}</Text>
      </View>
    );
  }
  return (
    <View style={styles.teamRow}>
      <AvatarPair info={info} styles={styles} c={c} />
      <Text style={[styles.teamName, win && styles.teamNameWin]} numberOfLines={1}>
        {info.name}
        {info.partner ? ` / ${info.partner}` : ''}
        {info.seed ? <Text style={styles.seedSup}> ({info.seed})</Text> : null}
      </Text>
    </View>
  );
};

// Tarjeta de partido estilo pro: dos parejas, badge W del ganador, sets en
// columnas (o juegos en formatos sociales) y chevron para meter resultado.
export const MatchCard: React.FC<{
  m: TournamentMatch;
  info: (id: string | null) => RegInfo;
  onEdit: (m: TournamentMatch) => void;
  social?: boolean;
  readOnly?: boolean;
  styles: Styles;
  c: Palette;
}> = ({ m, info, onEdit, social, readOnly, styles, c }) => {
  const finished = m.status === 'finished';
  const homeWin = finished && m.winner_reg === m.home_reg;
  const awayWin = finished && !!m.winner_reg && m.winner_reg === m.away_reg;
  const sets = !social && Array.isArray(m.sets) ? m.sets : null;
  // Un hueco sin pareja: en la 1ª ronda del cuadro PRINCIPAL es un BYE real; en
  // rondas posteriores —o en el cuadro de CONSOLACIÓN, que se llena con los
  // perdedores de la R1— la pareja aún no se conoce → "Por determinar".
  const homeMissing = !social && !m.home_reg;
  const awayMissing = !social && !m.away_reg;
  const tbd = (m.round > 1 || m.bracket === 'consol') && !finished;
  const homeBye = homeMissing && !tbd;
  const awayBye = awayMissing && !tbd;
  const homeTbd = homeMissing && tbd;
  const awayTbd = awayMissing && tbd;
  const homeInfo = social
    ? {
        ...info(m.home_reg),
        partner: info(m.home_reg2 ?? null).name,
        partnerAvatar: info(m.home_reg2 ?? null).avatar,
      }
    : info(m.home_reg);
  const awayInfo = social
    ? {
        ...info(m.away_reg),
        partner: info(m.away_reg2 ?? null).name,
        partnerAvatar: info(m.away_reg2 ?? null).avatar,
      }
    : info(m.away_reg);

  return (
    <Pressable
      onPress={() => (readOnly ? undefined : onEdit(m))}
      disabled={readOnly}
      style={({ pressed }) => [styles.matchRowCard, pressed && !readOnly && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        {m.scheduled_at ? (
          <Text style={styles.matchWhen}>
            🕐 {fmtDayTime(m.scheduled_at)}
            {m.court ? ` · ${m.court}` : ''}
          </Text>
        ) : null}
        <MatchTeam info={homeInfo} win={homeWin} bye={homeBye} tbd={homeTbd} styles={styles} c={c} />
        <MatchTeam info={awayInfo} win={awayWin} bye={awayBye} tbd={awayTbd} styles={styles} c={c} />
      </View>

      {finished ? (
        <View style={styles.scoreArea}>
          <View style={styles.wCol}>
            <View style={[styles.wBadge, homeWin ? styles.wBadgeOn : styles.wBadgeOff]}>
              {homeWin ? <Text style={styles.wBadgeText}>W</Text> : null}
            </View>
            <View style={[styles.wBadge, awayWin ? styles.wBadgeOn : styles.wBadgeOff]}>
              {awayWin ? <Text style={styles.wBadgeText}>W</Text> : null}
            </View>
          </View>
          {sets ? (
            sets.map((s, i) => (
              <View key={i} style={styles.setCol}>
                <Text style={[styles.setScore, homeWin && styles.setScoreWin]}>{s[0]}</Text>
                <Text style={[styles.setScore, awayWin && styles.setScoreWin]}>{s[1]}</Text>
              </View>
            ))
          ) : (
            <View style={styles.setCol}>
              <Text style={[styles.setScore, homeWin && styles.setScoreWin]}>{m.home_score}</Text>
              <Text style={[styles.setScore, awayWin && styles.setScoreWin]}>{m.away_score}</Text>
            </View>
          )}
        </View>
      ) : homeMissing || awayMissing || readOnly ? null : (
        <View style={styles.playChip}>
          <Text style={styles.playChipText}>›</Text>
        </View>
      )}
    </Pressable>
  );
};

// Hero de campeón (torneo finalizado): tarjeta glass con la pareja ganadora.
export const ChampionHero: React.FC<{ info: RegInfo; styles: Styles; c: Palette }> = ({
  info,
  styles,
  c,
}) => (
  <LinearGradient
    colors={[c.accent15, c.bgCard]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.heroCard}
  >
    <View style={styles.heroTop}>
      <IconTrophy size={18} color={c.accent} />
      <Text style={styles.heroEyebrow}>CAMPEONES</Text>
    </View>
    <View style={styles.heroBody}>
      <View style={styles.heroAvatars}>
        <TAvatar name={info.name} url={info.avatar} size={48} styles={styles} c={c} />
        {info.partner ? (
          <View style={{ marginLeft: -14 }}>
            <TAvatar name={info.partner} url={info.partnerAvatar} size={48} styles={styles} c={c} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.heroName} numberOfLines={1}>
          {info.name}
        </Text>
        {info.partner ? (
          <Text style={styles.heroName} numberOfLines={1}>
            {info.partner}
          </Text>
        ) : null}
      </View>
    </View>
  </LinearGradient>
);

// Barra de pestañas de contenido: Cuadro/Clasificación · Jugadores · Info.
export const ContentTabs: React.FC<{
  tab: TabKey;
  setTab: (t: TabKey) => void;
  mainLabel: string;
  showSchedule: boolean;
  styles: Styles;
  c: Palette;
}> = ({ tab, setTab, mainLabel, showSchedule, styles, c }) => {
  const items: { key: TabKey; label: string }[] = [
    { key: 'main', label: mainLabel },
    ...(showSchedule ? [{ key: 'schedule' as TabKey, label: 'Horario' }] : []),
    { key: 'players', label: 'Jugadores' },
    { key: 'info', label: 'Info' },
  ];
  return (
    <View style={styles.contentTabs}>
      {items.map((it) => {
        const sel = tab === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => setTab(it.key)}
            style={[styles.contentTab, sel && { backgroundColor: c.text }]}
          >
            <Text style={[styles.contentTabText, { color: sel ? c.background : c.textMuted }]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// Pestaña JUGADORES: todos los inscritos con ambos avatares, siembra y datos.
export const PlayersView: React.FC<{
  regs: TournamentRegistration[];
  info: (id: string | null) => RegInfo;
  social: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (r: TournamentRegistration) => void;
  onSelect?: (r: TournamentRegistration) => void;
  divName: string | null;
  maxPairs: number | null;
  styles: Styles;
  c: Palette;
}> = ({ regs, social, canEdit, onAdd, onRemove, onSelect, divName, maxPairs, styles, c }) => {
  const ordered = [...regs].sort((a, b) => {
    if (a.seed != null && b.seed != null) return a.seed - b.seed;
    if (a.seed != null) return -1;
    if (b.seed != null) return 1;
    return a.created_at < b.created_at ? -1 : 1;
  });
  return (
    <View style={{ paddingHorizontal: 22 }}>
      <View style={styles.regHeader}>
        <Text style={styles.sectionLabel}>
          {social ? 'JUGADORES' : 'PAREJAS'}
          {divName ? ` · ${divName}` : ''} · {regs.length}
          {maxPairs ? `/${maxPairs}` : ''}
        </Text>
        {canEdit ? (
          <Pressable onPress={onAdd} hitSlop={8}>
            <Text style={styles.addLink}>+ Añadir</Text>
          </Pressable>
        ) : null}
      </View>

      {ordered.length === 0 ? (
        <Text style={styles.emptyText}>
          Aún no hay {social ? 'jugadores' : 'parejas'}
          {divName ? ` en ${divName}` : ''}. Añádelos a mano o comparte el código.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {ordered.map((r) => {
            const ri: RegInfo = {
              name: r.p1_name,
              partner: social ? null : r.p2_name,
              seed: r.seed,
              avatar: r.p1_avatar ?? null,
              partnerAvatar: r.p2_avatar ?? null,
            };
            const meta = [
              r.seed_points != null ? `${r.seed_points} pts` : null,
              r.availability?.length ? 'horario limitado' : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={r.id}
                onPress={onSelect ? () => onSelect(r) : undefined}
                disabled={!onSelect}
                style={({ pressed }) => [styles.playerRow, pressed && onSelect && { opacity: 0.85 }]}
              >
                {r.seed ? (
                  <View style={styles.seedBadge}>
                    <Text style={styles.seedBadgeText}>{r.seed}</Text>
                  </View>
                ) : (
                  <View style={styles.seedBadgeEmpty} />
                )}
                <AvatarPair info={ri} size={30} styles={styles} c={c} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {r.p1_name}
                    {!social && r.p2_name ? ` / ${r.p2_name}` : ''}
                  </Text>
                  {meta ? (
                    <Text style={styles.playerMeta} numberOfLines={1}>
                      {meta}
                    </Text>
                  ) : null}
                </View>
                {canEdit ? (
                  <Pressable onPress={() => onRemove(r)} hitSlop={8}>
                    <IconTrash size={15} color={c.textFaint} />
                  </Pressable>
                ) : onSelect ? (
                  <Text style={styles.playChipText}>›</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

// Pestaña INFO: datos del torneo (formato, categorías, plazas, código…).
export const InfoView: React.FC<{
  t: Tournament | null;
  onShareCode: () => void;
  styles: Styles;
  c: Palette;
}> = ({ t, onShareCode, styles, c }) => {
  if (!t) return null;
  // Valor de "Partidos": si el club fijó formato por cuadro y difieren, se
  // listan (Principal / Consolación / Grupos); si no, un único formato.
  const matchFmtCuadros: [string, string][] =
    t.format === 'ko_consolation'
      ? [['main', 'Principal'], ['consol', 'Consolación']]
      : t.format === 'groups_ko'
        ? [['groups', 'Grupos'], ['main', 'Principal'], ['consol', 'Consolación']]
        : [['main', '']];
  const fmtOfGroup = (k: string) => (t.phase_formats?.[k] ?? t.match_format) as string;
  const distinctFmts = new Set(matchFmtCuadros.map(([k]) => fmtOfGroup(k)));
  const matchFmtValue =
    distinctFmts.size <= 1
      ? formatConfig(t.match_format).label
      : matchFmtCuadros.map(([k, l]) => `${l}: ${formatConfig(fmtOfGroup(k)).label}`).join(' · ');
  const rows: { label: string; value: string }[] = [
    { label: 'Formato', value: FORMAT_LABEL[t.format] ?? t.format },
    ...(!isSocialFormat(t.format)
      ? [{ label: 'Partidos', value: matchFmtValue }]
      : []),
    {
      label: 'Género',
      value: t.genders?.length
        ? t.genders.map((g) => GENDER_LABEL[g] ?? g).join(' · ')
        : '—',
    },
    {
      label: 'Categorías',
      value: t.categories?.length ? t.categories.join(' · ') : '—',
    },
    {
      label: isSocialFormat(t.format) ? 'Plazas (jugadores)' : 'Plazas (parejas)',
      value: t.max_pairs ? String(t.max_pairs) : 'Sin límite',
    },
    ...(t.format === 'ko' || t.format === 'ko_consolation' || t.format === 'groups_ko'
      ? [
          {
            label: 'Siembra',
            value:
              t.seeding_mode === 'federative'
                ? `Federativa (sorteo)${t.draw_seed ? ` · #${t.draw_seed}` : ''}`
                : 'Por puntos',
          },
        ]
      : []),
    {
      label: 'Cuota',
      value: t.entry_fee
        ? `${formatFee(t.entry_fee, t.fee_currency)} · se paga en el club`
        : 'Gratis',
    },
    { label: 'Estado', value: tournamentStatusLabel(t.status, t.starts_on) },
    {
      label: 'Fechas',
      value:
        t.ends_on && t.ends_on !== t.starts_on
          ? `${formatStartsOn(t.starts_on) ?? '—'} – ${formatStartsOn(t.ends_on)}`
          : formatStartsOn(t.starts_on) ?? '—',
    },
    ...(t.location ? [{ label: 'Lugar', value: t.location }] : []),
  ];
  return (
    <View style={{ paddingHorizontal: 22 }}>
      <Text style={[styles.sectionLabel, { marginTop: 4, marginBottom: 10 }]}>
        INFORMACIÓN DEL TORNEO
      </Text>
      <View style={styles.infoCard}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>{r.label}</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>

      {t.prizes_json && t.prizes_json.length ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 10 }]}>
            🏆 PREMIOS
          </Text>
          <View style={styles.infoCard}>
            {t.prizes_json.map((e, i) => (
              <View key={`${e.place}-${i}`} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>{e.place}</Text>
                <Text style={styles.infoValue} numberOfLines={3}>
                  {e.items.map(prizeItemLabel).join(' · ')}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : t.prizes ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 10 }]}>
            🏆 PREMIOS
          </Text>
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockText}>{t.prizes}</Text>
          </View>
        </>
      ) : null}

      {(t.info_rows && t.info_rows.length) || t.extra_info || t.observations ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 10 }]}>
            ℹ️ INFORMACIÓN ADICIONAL
          </Text>
          {t.info_rows && t.info_rows.length ? (
            <View style={styles.infoCard}>
              {t.info_rows.map((r, i) => (
                <View key={`${r.label}-${i}`} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
                  <Text style={styles.infoLabel}>{r.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={3}>
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : t.extra_info ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoBlockText}>{t.extra_info}</Text>
            </View>
          ) : null}
          {t.observations ? (
            <View style={[styles.infoBlock, { marginTop: 10 }]}>
              <Text style={styles.infoBlockText}>{t.observations}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {t.signup_code ? (
        <View style={[styles.codeCard, { marginTop: 14 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.codeLabel}>CÓDIGO DE INSCRIPCIÓN</Text>
            <Text style={styles.code}>{t.signup_code}</Text>
            <Text style={styles.codeHint}>Compártelo para que se apunten desde la app.</Text>
          </View>
          <Pressable
            onPress={onShareCode}
            hitSlop={8}
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
          >
            <IconShare size={16} color={c.accent} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

// Pestaña HORARIO: partidos agrupados por hora, con pista y avisos de conflicto.
export const ScheduleView: React.FC<{
  tournament: Tournament;
  matches: TournamentMatch[];
  // Todos los partidos del torneo (todas las divisiones) — para la rejilla, que
  // debe ver el conjunto para no solapar pistas. `matches` es solo la división
  // activa (lo que se muestra en la lista del horario).
  allMatches?: TournamentMatch[];
  defaultGender?: string | null;
  defaultCategory?: string | null;
  regs: TournamentRegistration[];
  info: (id: string | null) => RegInfo;
  onEdit: (m: TournamentMatch) => void;
  onConfigure: () => void;
  onGenerate: () => void;
  onClear: () => void;
  generating: boolean;
  readOnly?: boolean;
  onReload?: () => void;
  styles: Styles;
  c: Palette;
}> = ({
  tournament,
  matches,
  allMatches,
  defaultGender,
  defaultCategory,
  regs,
  info,
  onEdit,
  onConfigure,
  onGenerate,
  onClear,
  generating,
  readOnly,
  onReload,
  styles,
  c,
}) => {
  const days = useMemo(
    () => buildTournamentDays(tournament.starts_on, tournament.ends_on),
    [tournament.starts_on, tournament.ends_on],
  );
  const multiDay = days.length > 1;
  // ¿El torneo tiene más de una DIVISIÓN (género × categoría)? El horario junta
  // todos los cuadros, así que si hay varias categorías/géneros hay que
  // diferenciarlas o "Cuartos" mezclaría Masculino 1ª con Masculino 2ª.
  const multiDiv = useMemo(
    () => new Set(matches.map((m) => `${m.gender ?? ''}|${m.category ?? ''}`)).size > 1,
    [matches],
  );

  const SINGLE_LABEL: Record<string, string> = {
    grp: 'Fase de grupos',
    rr: 'Liga',
    amer: 'Americano',
    mex: 'Mexicano',
  };

  const dayLabelOf = (iso: string | null) => days.find((x) => x.iso === iso)?.label ?? null;
  // Máx. ronda de un cuadro DENTRO de su división (categorías con distinto nº de
  // parejas tienen distinto nº de rondas → "Final" vs "Semis" bien etiquetado).
  const maxRoundOf = (b: string, gender: string | null, category: string | null) =>
    matches.reduce(
      (mx, m) =>
        m.bracket === b && m.gender === gender && m.category === category
          ? Math.max(mx, m.round)
          : mx,
      0,
    );
  const phaseLabelOf = (m: TournamentMatch): string => {
    const divPrefix = multiDiv ? `${divLabel({ gender: m.gender, category: m.category })} · ` : '';
    if (!isRoundBracket(m.bracket)) return divPrefix + (SINGLE_LABEL[m.bracket] ?? 'Partidos');
    const prefix = m.bracket === 'main' ? '' : `${bracketLabel(m.bracket)} · `;
    return `${divPrefix}${prefix}${roundLabel(m.round, maxRoundOf(m.bracket, m.gender, m.category))}`;
  };
  const [collapsedPh, setCollapsedPh] = useState<Set<string>>(new Set());
  const togglePh = (k: string) =>
    setCollapsedPh((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const scheduled = useMemo(
    () =>
      matches
        .filter((m) => m.scheduled_at && m.status !== 'bye')
        .sort((a, b) =>
          (a.scheduled_at as string) < (b.scheduled_at as string)
            ? -1
            : (a.scheduled_at as string) > (b.scheduled_at as string)
              ? 1
              : (a.court ?? '').localeCompare(b.court ?? ''),
        ),
    [matches],
  );
  // Agrupa el horario por FASE (colapsable) → DÍA (navegable) → hora.
  type TimeGroup = { time: string; items: TournamentMatch[] };
  type DayGroup = { iso: string; label: string; timeGroups: TimeGroup[] };
  type PhaseGroup = { key: string; label: string; earliest: string; count: number; dayGroups: DayGroup[] };
  const phaseGroups: PhaseGroup[] = [];
  const isoLabel = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number);
    return `${DOW_ABBR[new Date(y, mo - 1, d).getDay()]} ${d}`;
  };
  for (const m of scheduled) {
    // Con varias divisiones, la clave incluye género+categoría para que cada
    // categoría tenga su propia sección de fase (no se mezclan los "Cuartos").
    const key =
      (multiDiv ? `${m.gender ?? ''}~${m.category ?? ''}~` : '') + matchPhaseKey(m);
    let pg = phaseGroups.find((x) => x.key === key);
    if (!pg) {
      pg = { key, label: phaseLabelOf(m) || 'Partidos', earliest: m.scheduled_at as string, count: 0, dayGroups: [] };
      phaseGroups.push(pg);
    }
    pg.count++;
    if ((m.scheduled_at as string) < pg.earliest) pg.earliest = m.scheduled_at as string;
    const iso = (m.scheduled_at as string).slice(0, 10);
    let dg = pg.dayGroups.find((x) => x.iso === iso);
    if (!dg) {
      dg = { iso, label: dayLabelOf(iso) ?? isoLabel(iso), timeGroups: [] };
      pg.dayGroups.push(dg);
    }
    const time = fmtTime(m.scheduled_at) ?? '—';
    const tg = dg.timeGroups.find((x) => x.time === time);
    if (tg) tg.items.push(m);
    else dg.timeGroups.push({ time, items: [m] });
  }
  phaseGroups.sort((a, b) => (a.earliest < b.earliest ? -1 : 1));
  for (const pg of phaseGroups) pg.dayGroups.sort((a, b) => (a.iso < b.iso ? -1 : 1));
  // Día seleccionado dentro de cada fase.
  const [selDayByPhase, setSelDayByPhase] = useState<Record<string, string>>({});
  // Partidos con jugadores conocidos que quedaron SIN hora (no cabían en un
  // hueco donde todos pudieran).
  const unplacedList = matches.filter(
    (m) =>
      m.status !== 'bye' &&
      m.status !== 'finished' &&
      !!m.home_reg &&
      !!m.away_reg &&
      !m.scheduled_at,
  );
  const unplaced = unplacedList.length;
  const [manualMatch, setManualMatch] = useState<TournamentMatch | null>(null);
  const [gridOpen, setGridOpen] = useState(false);

  return (
    <View style={{ paddingHorizontal: 22 }}>
      {readOnly ? null : (
        <>
          <View style={styles.schedConfigCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.schedConfigLabel}>CONFIGURACIÓN</Text>
              <Text style={styles.schedConfigValue}>
                {tournament.courts} {tournament.courts === 1 ? 'pista' : 'pistas'} · desde{' '}
                {tournament.start_time} · {tournament.slot_minutes} min ·{' '}
                {(tournament.rest_minutes ?? 0) === 0 ? 'seguido' : `+${tournament.rest_minutes} descanso`}
                {!tournament.starts_on ? ' · sin fecha' : ''}
              </Text>
            </View>
            <Pressable onPress={onConfigure} hitSlop={8}>
              <Text style={styles.addLink}>Configurar</Text>
            </Pressable>
          </View>

          {multiDay ? (
            <Text style={[styles.genHint, { textAlign: 'left', marginTop: 8 }]}>
              Los días de cada fase se editan con el lápiz (arriba). Aquí solo
              generas y ajustas a mano los partidos sin hueco.
            </Text>
          ) : null}

          <Pressable
            onPress={onGenerate}
            disabled={generating}
            style={({ pressed }) => [
              styles.generateBtn,
              { marginTop: 14 },
              generating && { opacity: 0.5 },
              pressed && { opacity: 0.9 },
            ]}
          >
            {generating ? (
              <ActivityIndicator size="small" color={c.textInverse} />
            ) : (
              <Text style={styles.generateLabel}>
                {scheduled.length ? 'Regenerar horario' : 'Generar horario'}
              </Text>
            )}
          </Pressable>

          {!tournament.starts_on ? (
            <Text style={styles.genHint}>
              Pon una fecha al torneo (pestaña Info · el club la edita al crear) para
              poder generar el horario.
            </Text>
          ) : null}

          {tournament.starts_on ? (
            <Pressable
              onPress={() => setGridOpen(true)}
              style={({ pressed }) => [styles.gridBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.gridBtnText}>▦ Editar rejilla (todos los huecos)</Text>
            </Pressable>
          ) : null}
        </>
      )}

      {!readOnly && unplaced > 0 ? (
        <>
          <View style={styles.conflictBanner}>
            <Text style={styles.conflictBannerText}>
              ⚠️ {unplaced} {unplaced === 1 ? 'partido' : 'partidos'} sin hueco donde todos
              puedan. Añade pistas, baja el descanso o mueve la fase a otro día y regenera
              — o pon la hora a mano abajo.
            </Text>
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            {unplacedList.map((m) => {
              const h = info(m.home_reg);
              const a = info(m.away_reg);
              const nm = (x: RegInfo) => `${x.name}${x.partner ? ` / ${x.partner}` : ''}`;
              return (
                <View key={m.id} style={styles.unplacedRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.unplacedTeams} numberOfLines={2}>
                      {nm(h)} vs {nm(a)}
                    </Text>
                    <Text style={styles.playerMeta}>{phaseLabelOf(m)}</Text>
                  </View>
                  <Pressable
                    onPress={() => setManualMatch(m)}
                    style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.manualBtnText}>Poner hora</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {scheduled.length === 0 ? (
        <Text style={[styles.emptyText, { marginTop: 14 }]}>
          {readOnly
            ? 'El horario aún no está publicado. Cuando el club lo genere verás aquí tu hora y pista.'
            : 'Aún no hay horario. Genera el cuadro/los grupos y pulsa “Generar horario”: repartiremos los partidos por pista y hora respetando la disponibilidad de cada jugador.'}
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {phaseGroups.map((pg) => {
            const isCol = collapsedPh.has(pg.key);
            const multipleDays = pg.dayGroups.length > 1;
            const selIso = selDayByPhase[pg.key] ?? pg.dayGroups[0]?.iso;
            const activeDay =
              pg.dayGroups.find((d) => d.iso === selIso) ?? pg.dayGroups[0];
            return (
              <View key={pg.key} style={{ marginTop: 14 }}>
                <Pressable
                  onPress={() => togglePh(pg.key)}
                  style={({ pressed }) => [styles.schedPhaseHead, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.schedPhaseTitle} numberOfLines={1}>
                    {pg.label}
                    <Text style={styles.schedPhaseCount}> · {pg.count}</Text>
                  </Text>
                  <Text style={styles.roundPillChevron}>{isCol ? '›' : '⌄'}</Text>
                </Pressable>
                {isCol ? null : (
                  <>
                    {multipleDays ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingTop: 10 }}
                      >
                        {pg.dayGroups.map((dg) => {
                          const on = dg.iso === activeDay?.iso;
                          return (
                            <Pressable
                              key={dg.iso}
                              onPress={() =>
                                setSelDayByPhase((prev) => ({ ...prev, [pg.key]: dg.iso }))
                              }
                              style={[styles.dayTab, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                            >
                              <Text style={[styles.dayTabText, { color: on ? c.textInverse : c.textMuted }]}>
                                {dg.label} · {dg.timeGroups.reduce((n, t) => n + t.items.length, 0)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}
                    {(activeDay?.timeGroups ?? []).map((g) => (
                      <View key={g.time} style={{ marginTop: 10 }}>
                        <Text style={styles.schedTime}>
                          {multipleDays ? `${activeDay?.label} · ${g.time}` : g.time}
                        </Text>
                        <View style={{ gap: 8 }}>
                          {g.items.map((m) => {
                            const conf = !readOnly && matchScheduleConflict(m, regs, tournament);
                            return (
                              <View key={m.id}>
                                {conf ? (
                                  <Text style={styles.conflictTag}>⚠️ Conflicto de horario</Text>
                                ) : null}
                                <MatchCard
                                  m={m}
                                  info={info}
                                  onEdit={onEdit}
                                  social={isSocialFormat(tournament.format)}
                                  readOnly={readOnly}
                                  styles={styles}
                                  c={c}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            );
          })}

          {readOnly ? null : (
            <Pressable onPress={onClear} hitSlop={8} style={{ marginTop: 22 }}>
              <Text style={[styles.addLink, { color: c.error, textAlign: 'center' }]}>
                Borrar horario
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <ManualSlotSheet
        match={manualMatch}
        tournament={tournament}
        regs={regs}
        info={info}
        days={days}
        onClose={() => setManualMatch(null)}
        onSaved={() => {
          setManualMatch(null);
          onReload?.();
        }}
        styles={styles}
        c={c}
      />

      <SlotGridSheet
        open={gridOpen}
        tournament={tournament}
        matches={allMatches ?? matches}
        regs={regs}
        info={info}
        days={days}
        defaultGender={defaultGender ?? null}
        defaultCategory={defaultCategory ?? null}
        onClose={() => setGridOpen(false)}
        onChanged={() => onReload?.()}
        styles={styles}
        c={c}
      />
    </View>
  );
};

// Sheet para colocar A MANO un partido sin hueco: día, hora y pista, marcando
// qué horas le vienen bien a las dos parejas.
const ManualSlotSheet: React.FC<{
  match: TournamentMatch | null;
  tournament: Tournament;
  regs: TournamentRegistration[];
  info: (id: string | null) => RegInfo;
  days: { iso: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
  styles: Styles;
  c: Palette;
}> = ({ match, tournament, regs, info, days, onClose, onSaved, styles, c }) => {
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [minute, setMinute] = useState<number | null>(null);
  const [court, setCourt] = useState(1);
  const [saving, setSaving] = useState(false);

  const [sh, sm] = (tournament.start_time ?? '09:00').split(':').map(Number);
  const startMin = (sh || 9) * 60 + (sm || 0);
  // Tope = end_time del torneo (igual que el motor de horario) para que la
  // rejilla/manual cubran cualquier hora que el motor pueda colocar.
  const [eh, em] = (tournament.end_time ?? '23:00').split(':').map(Number);
  const endMin = Math.max(startMin, (eh || 23) * 60 + (em || 0));
  const step = Math.max(15, tournament.slot_minutes);
  const times: number[] = [];
  for (let t = startMin; t <= endMin; t += step) times.push(t);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (match) {
      const iso = match.scheduled_at ? (match.scheduled_at as string).slice(0, 10) : days[0]?.iso ?? tournament.starts_on;
      setDayIso(iso ?? null);
      setMinute(null);
      setCourt(parseInt((match.court ?? '').replace(/\D/g, ''), 10) || 1);
    }
  }, [match]);

  const save = async () => {
    if (!match || !dayIso || minute == null) {
      toast.error('Elige día y hora');
      return;
    }
    setSaving(true);
    try {
      const [y, mo, d] = dayIso.split('-').map(Number);
      const dt = new Date(y, mo - 1, d);
      dt.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      await setMatchSlot(match.id, dt.toISOString(), `Pista ${court}`);
      onSaved();
    } catch (e: any) {
      toast.error('No se pudo poner la hora', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  const h = match ? info(match.home_reg) : null;
  const a = match ? info(match.away_reg) : null;
  const nm = (x: RegInfo | null) => (x ? `${x.name}${x.partner ? ` / ${x.partner}` : ''}` : '');

  // Disponibilidad de cada pareja para el día elegido (para colocarlo a mano).
  const dayLabel = days.find((x) => x.iso === dayIso)?.label ?? null;
  const partIds = match
    ? [match.home_reg, match.home_reg2, match.away_reg, match.away_reg2].filter(
        (x): x is string => !!x,
      )
    : [];
  // Franjas del día que el jugador NO puede (availability = horas no disponibles).
  const noPuedeOf = (id: string): string => {
    const r = regs.find((x) => x.id === id);
    const av = r?.availability ?? [];
    if (!dayLabel) return '—';
    const fr = av
      .filter((s) => s.startsWith(dayLabel + ' '))
      .map((s) => s.slice(dayLabel.length + 1));
    return fr.length ? fr.join(' · ') : 'Puede a cualquier hora';
  };

  return (
    <BottomSheet
      open={!!match}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || minute == null}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || minute == null) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Poner en el horario</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>PONER A MANO</Text>
      <Text style={styles.sheetTitle} numberOfLines={2}>{nm(h)} vs {nm(a)}</Text>
      <Text style={[styles.playerMeta, { marginTop: 4 }]}>
        Las horas donde ✓ pueden los dos van marcadas. Puedes elegir otra, pero
        avísales.
      </Text>

      {days.length > 1 ? (
        <>
          <Text style={styles.label}>DÍA</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {days.map((day) => {
              const on = dayIso === day.iso;
              return (
                <Pressable
                  key={day.iso}
                  onPress={() => setDayIso(day.iso)}
                  style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                >
                  <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>
        NO PUEDE{dayLabel ? ` · ${dayLabel}` : ''}
      </Text>
      <View style={{ gap: 6 }}>
        {partIds.map((id) => {
          const r = regs.find((x) => x.id === id);
          const noPuede = noPuedeOf(id);
          const restricted = noPuede !== 'Puede a cualquier hora';
          return (
            <View key={id} style={styles.availLine}>
              <Text style={styles.availName} numberOfLines={1}>{r?.p1_name ?? '—'}</Text>
              <Text style={[styles.availFranjas, restricted && { color: c.error }]} numberOfLines={2}>
                {noPuede}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.label}>HORA</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {times.map((t) => {
          const on = minute === t;
          const ok = match && dayIso ? matchAvailableAtDate(match, regs, dayIso, t) : false;
          return (
            <Pressable
              key={t}
              onPress={() => setMinute(t)}
              style={[
                styles.timeChip,
                ok && { borderColor: c.accent40 },
                on && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Text style={[styles.timeChipText, { color: on ? c.textInverse : ok ? c.accent : c.textMuted }]}>
                {ok ? '✓ ' : ''}{hhmm(t)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>PISTA</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {Array.from({ length: Math.max(1, tournament.courts) }, (_, i) => i + 1).map((ct) => {
          const on = court === ct;
          return (
            <Pressable
              key={ct}
              onPress={() => setCourt(ct)}
              style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
            >
              <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                Pista {ct}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

// Rejilla de TODOS los huecos (día × hora × pista) para colocar/mover a mano:
// toca un partido (en la rejilla o en "sin hora") para cogerlo y luego un hueco
// libre para soltarlo. Sin arrastrar (fiable en móvil).
const SlotGridSheet: React.FC<{
  open: boolean;
  tournament: Tournament;
  matches: TournamentMatch[];
  regs: TournamentRegistration[];
  info: (id: string | null) => RegInfo;
  days: { iso: string; label: string }[];
  defaultGender?: string | null;
  defaultCategory?: string | null;
  onClose: () => void;
  onChanged: () => void;
  styles: Styles;
  c: Palette;
}> = ({
  open,
  tournament,
  matches,
  regs,
  info,
  days,
  defaultGender,
  defaultCategory,
  onClose,
  onChanged,
  styles,
  c,
}) => {
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [carried, setCarried] = useState<TournamentMatch | null>(null);
  const [busy, setBusy] = useState(false);
  // Filtros de foco: categoría (género+cat) y fase (bracket:round). No ocultan
  // los partidos de otras categorías (para no colocar encima), solo los atenúan.
  const [catFilter, setCatFilter] = useState<string>('all'); // "gender|category"
  const [phaseFilter, setPhaseFilter] = useState<string>('all'); // "bracket:round"
  // Filtro para ver SOLO los partidos con conflicto de horario (jugadores que
  // no pueden a la hora reservada — típico de rondas futuras ya rellenadas).
  const [conflictOnly, setConflictOnly] = useState(false);

  useEffect(() => {
    if (open) {
      setDayIso(days[0]?.iso ?? tournament.starts_on ?? null);
      setCarried(null);
      // Al abrir desde una división concreta, pre-filtramos por ella.
      setCatFilter(
        defaultCategory != null || defaultGender != null
          ? `${defaultGender ?? ''}|${defaultCategory ?? ''}`
          : 'all',
      );
      setPhaseFilter('all');
      setConflictOnly(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sh, sm] = (tournament.start_time ?? '09:00').split(':').map(Number);
  const startMin = (sh || 9) * 60 + (sm || 0);
  // Tope = end_time del torneo (unificado con el motor y el manual), para que
  // la rejilla tenga celda para cualquier hora colocada.
  const [eh, em] = (tournament.end_time ?? '23:00').split(':').map(Number);
  const endMin = Math.max(startMin, (eh || 23) * 60 + (em || 0));
  const step = Math.max(15, tournament.slot_minutes);
  const times: number[] = [];
  for (let t = startMin; t <= endMin; t += step) times.push(t);
  const courts = Array.from({ length: Math.max(1, tournament.courts) }, (_, i) => i + 1);
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // Nombre COMPLETO de cada pareja (p1 / p2), no solo el primer nombre.
  const fullPair = (id: string | null) => {
    const ri = info(id);
    return ri.partner ? `${ri.name} / ${ri.partner}` : ri.name;
  };
  const cardLabel = (m: TournamentMatch) => `${fullPair(m.home_reg)}  vs  ${fullPair(m.away_reg)}`;
  // ¿Varias divisiones? Para etiquetar la categoría de cada partido en la rejilla.
  const multiDiv =
    new Set(matches.map((m) => `${m.gender ?? ''}|${m.category ?? ''}`)).size > 1;
  // ¿El partido que llevo en la mano puede jugarse a este minuto? (disponibilidad
  // de sus jugadores). Sirve para teñir los huecos libres al colocar.
  const carriedOkAt = (min: number) =>
    carried && dayIso ? matchAvailableAtDate(carried, regs, dayIso, min) : true;

  // ── Fase (cuartos/semis/…) y filtros de foco (categoría + fase) ──────────
  const maxRoundByBracket = useMemo(() => {
    const mx: Record<string, number> = {};
    for (const m of matches)
      if (isRoundBracket(m.bracket)) mx[m.bracket] = Math.max(mx[m.bracket] ?? 0, m.round);
    return mx;
  }, [matches]);
  const GRID_SINGLE: Record<string, string> = {
    grp: 'Grupos', rr: 'Liga', amer: 'Americano', mex: 'Mexicano',
  };
  const phaseNameOf = (m: TournamentMatch): string => {
    if (!isRoundBracket(m.bracket)) return GRID_SINGLE[m.bracket] ?? 'Fase';
    const base = roundLabel(m.round, maxRoundByBracket[m.bracket] ?? m.round);
    if (m.bracket === 'consol') return `Consol · ${base}`;
    if (m.bracket !== 'main') return `${bracketLabel(m.bracket)} · ${base}`;
    return base;
  };
  const phaseKeyOf = (m: TournamentMatch) => `${m.bracket}:${m.round}`;
  const catKeyOf = (m: TournamentMatch) => `${m.gender ?? ''}|${m.category ?? ''}`;
  // Etiqueta de la celda: categoría (si hay varias) + fase.
  const cellTag = (m: TournamentMatch) => {
    const cat = multiDiv
      ? `${m.gender === 'femenino' ? 'F' : m.gender === 'masculino' ? 'M' : 'Mx'}·${m.category ?? ''} · `
      : '';
    return `${cat}${phaseNameOf(m)}`;
  };
  const catOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches)
      if (!map.has(catKeyOf(m)))
        map.set(catKeyOf(m), divLabel({ gender: m.gender, category: m.category }));
    // Orden: género (masc, fem, mixto) y luego nº de categoría (1ª, 2ª, 3ª…).
    const rank = (key: string) => {
      const [g, cat] = key.split('|');
      const gOrder = g === 'masculino' ? 0 : g === 'femenino' ? 1 : g === 'mixto' ? 2 : 3;
      return gOrder * 100 + (parseInt(cat, 10) || 99);
    };
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => rank(a.key) - rank(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);
  const phaseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) if (!map.has(phaseKeyOf(m))) map.set(phaseKeyOf(m), phaseNameOf(m));
    const rank = (k: string) => {
      const [b, r] = k.split(':');
      return (isRoundBracket(b) ? 100 : 0) + (b === 'consol' ? 50 : 0) + Number(r);
    };
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => rank(a.key) - rank(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, maxRoundByBracket]);
  // ¿Este partido colocado tiene conflicto? (alguna pareja no puede a su hora).
  const hasConflict = (m: TournamentMatch) =>
    !!m.scheduled_at && matchScheduleConflict(m, regs, tournament);
  const conflictCount = useMemo(
    () => matches.filter(hasConflict).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, regs],
  );
  const matchInFilter = (m: TournamentMatch) =>
    (catFilter === 'all' || catKeyOf(m) === catFilter) &&
    (phaseFilter === 'all' || phaseKeyOf(m) === phaseFilter) &&
    (!conflictOnly || hasConflict(m));

  const placeable = matches.filter(
    (m) => m.status !== 'bye' && !!m.home_reg && !!m.away_reg,
  );
  const occ: Record<string, TournamentMatch> = {};
  for (const m of placeable) {
    if (!m.scheduled_at) continue;
    if ((m.scheduled_at as string).slice(0, 10) !== dayIso) continue;
    const dt = new Date(m.scheduled_at as string);
    const min = dt.getHours() * 60 + dt.getMinutes();
    const ct = parseInt((m.court ?? '').replace(/\D/g, ''), 10) || 1;
    occ[`${min}:${ct}`] = m;
  }
  const unscheduled = placeable.filter((m) => !m.scheduled_at && matchInFilter(m));

  const doPlace = async (min: number, court: number) => {
    if (!carried || !dayIso) return;
    setBusy(true);
    try {
      const [y, mo, d] = dayIso.split('-').map(Number);
      const dt = new Date(y, mo - 1, d);
      dt.setHours(Math.floor(min / 60), min % 60, 0, 0);
      await setMatchSlot(carried.id, dt.toISOString(), `Pista ${court}`);
      setCarried(null);
      onChanged();
    } catch (e: any) {
      toast.error('No se pudo mover', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };
  const place = (min: number, court: number) => {
    if (!carried || !dayIso) return;
    if (occ[`${min}:${court}`]) {
      toast.error('Ese hueco está ocupado', 'Libéralo primero o elige otro.');
      return;
    }
    // Hueco "no del todo bloqueado": si a la pareja no le vale esa hora por su
    // disponibilidad, se puede colocar igual, pero pidiendo confirmación.
    if (!carriedOkAt(min)) {
      Alert.alert(
        'La pareja no puede a esa hora',
        `${cardLabel(carried)} marcó que NO puede jugar a las ${hhmm(min)}. ¿Colocarlo igualmente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Colocar igualmente',
            style: 'destructive',
            onPress: () => {
              void doPlace(min, court);
            },
          },
        ],
      );
      return;
    }
    void doPlace(min, court);
  };
  const removeCarried = async () => {
    if (!carried) return;
    setBusy(true);
    try {
      await clearMatchSlot(carried.id);
      setCarried(null);
      onChanged();
    } catch (e: any) {
      toast.error('No se pudo quitar', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>REJILLA DE HORARIO</Text>
      <Text style={styles.sheetTitle}>Todos los huecos</Text>
      <Text style={[styles.playerMeta, { marginTop: 4 }]}>
        Toca un partido para cogerlo y luego un hueco libre para soltarlo. Al moverlo,
        los huecos en verde = sus jugadores pueden a esa hora; en rojo = no.
      </Text>

      {/* Filtros de foco: conflictos, categoría y fase (atenúan lo que no cuadra) */}
      {catOptions.length > 1 || phaseOptions.length > 1 || conflictCount > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {conflictCount > 0 ? (
            <Pressable
              onPress={() => {
                const next = !conflictOnly;
                setConflictOnly(next);
                if (next) {
                  // Ver TODOS los conflictos (quita filtros de cat/fase) y saltar
                  // al día donde haya uno si el día actual no tiene ninguno.
                  setCatFilter('all');
                  setPhaseFilter('all');
                  const curHas = matches.some(
                    (m) => hasConflict(m) && (m.scheduled_at as string).slice(0, 10) === dayIso,
                  );
                  if (!curHas) {
                    const firstConf = matches.find(hasConflict);
                    if (firstConf?.scheduled_at)
                      setDayIso((firstConf.scheduled_at as string).slice(0, 10));
                  }
                }
              }}
              style={[
                styles.phaseDayChip,
                { alignSelf: 'flex-start', borderColor: c.error + '99' },
                conflictOnly && { backgroundColor: c.error, borderColor: c.error },
              ]}
            >
              <Text style={[styles.phaseDayChipText, { color: conflictOnly ? c.textInverse : c.error }]}>
                ⚠️ Conflictos de horario ({conflictCount})
              </Text>
            </Pressable>
          ) : null}
          {catOptions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              <Pressable
                onPress={() => setCatFilter('all')}
                style={[styles.phaseDayChip, catFilter === 'all' && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.phaseDayChipText, { color: catFilter === 'all' ? c.textInverse : c.textMuted }]}>
                  Todas
                </Text>
              </Pressable>
              {catOptions.map((o) => {
                const on = catFilter === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setCatFilter(on ? 'all' : o.key)}
                    style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                  >
                    <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {phaseOptions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              <Pressable
                onPress={() => setPhaseFilter('all')}
                style={[styles.phaseDayChip, phaseFilter === 'all' && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.phaseDayChipText, { color: phaseFilter === 'all' ? c.textInverse : c.textMuted }]}>
                  Todas las fases
                </Text>
              </Pressable>
              {phaseOptions.map((o) => {
                const on = phaseFilter === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setPhaseFilter(on ? 'all' : o.key)}
                    style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                  >
                    <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {days.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 10 }}
        >
          {days.map((day) => {
            const on = dayIso === day.iso;
            return (
              <Pressable
                key={day.iso}
                onPress={() => setDayIso(day.iso)}
                style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {carried ? (
        <View style={styles.carriedBanner}>
          <Text style={styles.carriedText} numberOfLines={1}>
            Moviendo: {cardLabel(carried)}
          </Text>
          <Pressable onPress={removeCarried} hitSlop={6}>
            <Text style={styles.carriedRemove}>Quitar</Text>
          </Pressable>
          <Pressable onPress={() => setCarried(null)} hitSlop={6}>
            <Text style={styles.carriedCancel}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
        <View>
          <View style={{ flexDirection: 'row' }}>
            <View style={styles.gridCorner} />
            {courts.map((ct) => (
              <View key={ct} style={styles.gridHeadCell}>
                <Text style={styles.gridHeadText}>P{ct}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {times.map((min) => (
              <View key={min} style={{ flexDirection: 'row' }}>
                <View style={styles.gridTimeCell}>
                  <Text style={styles.gridTimeText}>{hhmm(min)}</Text>
                </View>
                {courts.map((ct) => {
                  const m = occ[`${min}:${ct}`];
                  const isCarried = !!m && !!carried && m.id === carried.id;
                  // Hueco libre + partido en mano: ¿pueden sus jugadores a esta hora?
                  const okHere = !m && !!carried ? carriedOkAt(min) : true;
                  const conflict = !!m && hasConflict(m);
                  return (
                    <Pressable
                      key={ct}
                      onPress={() => (m ? setCarried(isCarried ? null : m) : place(min, ct))}
                      disabled={busy}
                      style={[
                        styles.gridCell,
                        m ? styles.gridCellFull : styles.gridCellFree,
                        conflict && !isCarried && { borderColor: c.error, backgroundColor: c.error + '12' },
                        isCarried && { borderColor: c.accent, borderWidth: 2 },
                        !!carried && !m && okHere && { borderColor: c.accent, backgroundColor: c.accent10 },
                        !!carried && !m && !okHere && { borderColor: c.error + '55', backgroundColor: c.error + '10' },
                        m && !matchInFilter(m) && { opacity: 0.28 },
                      ]}
                    >
                      {m ? (
                        <>
                          <Text
                            style={[styles.gridCellCat, conflict && { color: c.error }]}
                            numberOfLines={1}
                          >
                            {conflict ? '⚠️ ' : ''}
                            {cellTag(m)}
                          </Text>
                          <Text style={styles.gridCellText} numberOfLines={1}>
                            {fullPair(m.home_reg)}
                          </Text>
                          <Text style={styles.gridCellTextAway} numberOfLines={1}>
                            {fullPair(m.away_reg)}
                          </Text>
                        </>
                      ) : (
                        <Text
                          style={[
                            styles.gridCellFreeText,
                            !!carried && !okHere && { color: c.error },
                          ]}
                        >
                          {carried ? (okHere ? '＋' : '✕') : ''}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {unscheduled.length ? (
        <>
          <Text style={styles.label}>SIN HORA ({unscheduled.length})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {unscheduled.map((m) => {
              const on = carried?.id === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setCarried(on ? null : m)}
                  style={[styles.unschedChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                >
                  <Text
                    style={[styles.unschedChipText, { color: on ? c.textInverse : c.text }]}
                    numberOfLines={1}
                  >
                    {cardLabel(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
};

// Sheet de configuración del horario: pistas, hora de inicio y duración.
const ScheduleConfigSheet: React.FC<{
  open: boolean;
  tournament: Tournament | null;
  onClose: () => void;
  onSaved: (generate: boolean) => void;
  styles: Styles;
  c: Palette;
}> = ({ open, tournament, onClose, onSaved, styles, c }) => {
  const [courts, setCourts] = useState('3');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [minutes, setMinutes] = useState('60');
  const [rest, setRest] = useState('60');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && tournament) {
      setCourts(String(tournament.courts ?? 3));
      setMinutes(String(tournament.slot_minutes ?? 60));
      setRest(String(tournament.rest_minutes ?? 0));
      setStartAt(isoTimeToDate(`${tournament.start_time ?? '09:00'}:00`));
    }
  }, [open, tournament]);

  const save = async (generate: boolean) => {
    if (!tournament) return;
    setSaving(true);
    try {
      await updateTournamentSchedule(tournament.id, {
        courts: parseInt(courts, 10) || 1,
        startTime: startAt ? dateToIsoTime(startAt).slice(0, 5) : '09:00',
        slotMinutes: parseInt(minutes, 10) || 60,
        restMinutes: parseInt(rest, 10) || 0,
      });
      onSaved(generate);
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => save(true)}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              saving && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={c.textInverse} />
            ) : (
              <Text style={styles.saveLabel}>Guardar y generar horario</Text>
            )}
          </Pressable>
          <Pressable onPress={() => save(false)} disabled={saving} hitSlop={8}>
            <Text style={[styles.addLink, { textAlign: 'center' }]}>
              Solo guardar
            </Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.sheetEyebrow}>HORARIO</Text>
      <Text style={styles.sheetTitle}>Configurar horario</Text>

      <Text style={styles.label}>PISTAS DISPONIBLES</Text>
      <View style={styles.input}>
        <TextInput
          value={courts}
          onChangeText={(v) => setCourts(v.replace(/[^0-9]/g, ''))}
          placeholder="3"
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>

      <Text style={styles.label}>HORA DE INICIO</Text>
      <TimeField value={startAt} onChange={setStartAt} placeholder="09:00" />

      <Text style={styles.label}>DURACIÓN POR PARTIDO (MIN)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['45', '60', '90'].map((v) => {
          const sel = minutes === v;
          return (
            <Pressable
              key={v}
              onPress={() => setMinutes(v)}
              style={[styles.durChip, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
            >
              <Text style={[styles.durChipText, { color: sel ? c.textInverse : c.text }]}>
                {v} min
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>DESCANSO EXTRA ENTRE PARTIDOS DE UNA PAREJA</Text>
      <Text style={[styles.playerMeta, { marginTop: -4, marginBottom: 8 }]}>
        Hueco ADEMÁS de la hora del partido. "Seguido" = puede jugar a la hora
        siguiente (la duración ya incluye el calentamiento).
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { v: '0', label: 'Seguido' },
          { v: '30', label: '+30 min' },
          { v: '60', label: '+60 min' },
        ].map((o) => {
          const sel = rest === o.v;
          return (
            <Pressable
              key={o.v}
              onPress={() => setRest(o.v)}
              style={[styles.durChip, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
            >
              <Text style={[styles.durChipText, { color: sel ? c.textInverse : c.text }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

// Sheet con la ficha de una pareja: contacto + disponibilidad (club).
const PlayerInfoSheet: React.FC<{
  reg: TournamentRegistration | null;
  social: boolean;
  onClose: () => void;
  styles: Styles;
  c: Palette;
}> = ({ reg, social, onClose, styles, c }) => {
  const Person: React.FC<{ name: string | null; email: string | null; phone: string | null; avatar: string | null }> = ({ name, email, phone, avatar }) => {
    if (!name) return null;
    return (
      <View style={styles.playerRow}>
        <TAvatar name={name} url={avatar} size={38} styles={styles} c={c} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
          <Text style={styles.playerMeta}>
            {[phone || 'Sin teléfono', email || null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
    );
  };
  return (
    <BottomSheet open={!!reg} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>{social ? 'JUGADOR' : 'PAREJA'}</Text>
      <Text style={styles.sheetTitle}>Ficha de inscripción</Text>
      {reg ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Person name={reg.p1_name} email={reg.p1_email} phone={reg.p1_phone} avatar={reg.p1_avatar ?? null} />
          {!social ? (
            <Person name={reg.p2_name} email={reg.p2_email} phone={reg.p2_phone} avatar={reg.p2_avatar ?? null} />
          ) : null}

          <Text style={[styles.label, { marginTop: 10 }]}>PUNTOS DE SIEMBRA</Text>
          <Text style={styles.infoBlockText}>
            {reg.seed_points != null ? `${reg.seed_points} pts` : 'Sin puntos'}
            {reg.seed ? ` · cabeza de serie nº ${reg.seed}` : ''}
          </Text>

          <Text style={[styles.label, { marginTop: 14 }]}>HORAS QUE NO PUEDE</Text>
          {reg.availability?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {reg.availability.map((a, i) => (
                <View key={i} style={styles.availChip}>
                  <Text style={styles.availChipText}>{a}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoBlockText}>Puede a cualquier hora.</Text>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
};

// Sheet de EDICIÓN del torneo (club): datos del evento + borrar. No toca
// formato/categorías/géneros (rompería las divisiones ya sembradas).
const EditTournamentSheet: React.FC<{
  open: boolean;
  tournament: Tournament | null;
  matches: TournamentMatch[];
  phaseDays: Record<string, string[]>;
  onSetPhaseDay: (bracket: string, round: number, iso: string) => void;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  styles: Styles;
  c: Palette;
}> = ({ open, tournament, matches, phaseDays, onSetPhaseDay, onClose, onSaved, onDeleted, styles, c }) => {
  const planDays = tournament ? buildTournamentDays(tournament.starts_on, tournament.ends_on) : [];
  const planPhases = tournament ? buildPlannerPhases(tournament.format, matches) : [];
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState<Date | null>(null);
  const [endsOn, setEndsOn] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [maxPairs, setMaxPairs] = useState('');
  const [fee, setFee] = useState('');
  const [prizesJson, setPrizesJson] = useState<PrizeEntry[]>([]);
  const [infoRows, setInfoRows] = useState<InfoRow[]>([]);
  const [observations, setObservations] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [seedingMode, setSeedingMode] = useState<SeedingMode>('points');
  // Formato de partido por cuadro (editable con el torneo ya empezado; solo
  // afecta a los partidos aún sin resultado, se lee en vivo al puntuar).
  const [phaseFmt, setPhaseFmt] = useState<Record<string, MatchFormat>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && tournament) {
      setName(tournament.name);
      setStartsOn(isoDateToDate(tournament.starts_on));
      setEndsOn(isoDateToDate(tournament.ends_on));
      setSeedingMode(tournament.seeding_mode ?? 'points');
      setLocation(tournament.location ?? '');
      setMaxPairs(tournament.max_pairs ? String(tournament.max_pairs) : '');
      setFee(tournament.entry_fee != null ? String(tournament.entry_fee) : '');
      setPrizesJson(
        tournament.prizes_json ??
          (tournament.prizes
            ? [{ place: '1º', items: [{ type: 'otros', desc: tournament.prizes }] }]
            : []),
      );
      setInfoRows(
        tournament.info_rows ??
          (tournament.extra_info ? [{ label: 'Info', value: tournament.extra_info }] : []),
      );
      setObservations(tournament.observations ?? '');
      setCoverUrl(tournament.cover_url ?? null);
      setCoverUri(null);
      const base = (tournament.match_format ?? 'bo3_stb') as MatchFormat;
      const fmt: Record<string, MatchFormat> = {};
      cuadrosForFormat(tournament.format).forEach((cu) => {
        fmt[cu.key] = (tournament.phase_formats?.[cu.key] ?? base) as MatchFormat;
      });
      setPhaseFmt(fmt);
    }
  }, [open, tournament]);

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sin permiso', 'Da acceso a tus fotos para elegir una portada.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setCoverUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!tournament || !name.trim()) {
      toast.error('Ponle un nombre al torneo');
      return;
    }
    setSaving(true);
    try {
      let cover = coverUrl;
      if (coverUri) cover = await uploadTournamentCover(tournament.club_id, coverUri);
      // Formato por cuadro (solo para torneos no sociales). El match_format
      // global se mantiene alineado al del cuadro principal.
      const cuadros = cuadrosForFormat(tournament.format);
      const fmtOf = (k: string): MatchFormat => phaseFmt[k] ?? 'bo3_stb';
      const phaseFormats: Record<string, MatchFormat> = {};
      cuadros.forEach((cu) => {
        phaseFormats[cu.key] = fmtOf(cu.key);
      });
      const defaultFmt = fmtOf(phaseFormats.main ? 'main' : cuadros[0]?.key ?? 'main');
      const fmtFields = isSocialFormat(tournament.format)
        ? {}
        : { matchFormat: defaultFmt, phaseFormats };
      await updateTournament(tournament.id, {
        name,
        ...fmtFields,
        startsOn: startsOn ? dateToIsoDate(startsOn) : null,
        endsOn: endsOn ? dateToIsoDate(endsOn) : null,
        seedingMode,
        location,
        maxPairs: maxPairs ? parseInt(maxPairs, 10) : null,
        entryFee: fee ? parseFloat(fee) : null,
        prizesJson,
        infoRows,
        observations,
        // Migrado a estructurado: se limpia el texto libre antiguo.
        prizes: null,
        extraInfo: null,
        coverUrl: cover,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!tournament) return;
    Alert.alert(
      'Borrar torneo',
      `¿Seguro? Se borrarán las inscripciones y los partidos de "${tournament.name}". No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTournament(tournament.id);
              toast.success('Torneo borrado');
              onDeleted();
            } catch (e: any) {
              toast.error('No se pudo borrar', e?.message ?? '');
            }
          },
        },
      ],
    );
  };

  const shownCover = coverUri ?? coverUrl;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || !name.trim()}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !name.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Guardar cambios</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>EDITAR TORNEO</Text>
      <Text style={styles.sheetTitle}>Editar</Text>

      <Text style={styles.label}>FOTO DE PORTADA</Text>
      <Pressable
        onPress={pickCover}
        style={({ pressed }) => [
          { height: 140, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.hairStrong, backgroundColor: c.bgCard },
          pressed && { opacity: 0.85 },
        ]}
      >
        {shownCover ? (
          <>
            <Image source={{ uri: shownCover }} style={{ width: '100%', height: '100%' }} />
            <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, backgroundColor: 'rgba(0,0,0,0.55)' }}>
              <IconCamera size={14} color={c.textInverse} />
              <Text style={{ color: c.textInverse, fontSize: 12, fontWeight: '700' }}>Cambiar</Text>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconCamera size={22} color={c.accent} />
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Añadir foto</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>NOMBRE</Text>
      <View style={styles.input}>
        <TextInput value={name} onChangeText={setName} placeholder="Nombre del torneo" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={60} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>FECHA INICIO</Text>
          <DateField value={startsOn} onChange={setStartsOn} placeholder="Inicio" allowClear label="INICIO" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>FECHA FIN</Text>
          <DateField value={endsOn} onChange={setEndsOn} placeholder="Fin" allowClear minimumDate={startsOn ?? undefined} label="FIN" />
        </View>
      </View>

      {tournament?.format === 'ko' || tournament?.format === 'ko_consolation' || tournament?.format === 'groups_ko' ? (
        <>
          <Text style={styles.label}>SIEMBRA</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                { id: 'points', label: 'Por puntos' },
                { id: 'federative', label: 'Federativa' },
              ] as { id: SeedingMode; label: string }[]
            ).map((s) => {
              const sel = seedingMode === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSeedingMode(s.id)}
                  style={[styles.durChip, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                >
                  <Text style={[styles.durChipText, { color: sel ? c.textInverse : c.text }]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {tournament && !isSocialFormat(tournament.format) ? (
        <>
          {cuadrosForFormat(tournament.format).map((cuadro) => {
            const cur = phaseFmt[cuadro.key] ?? 'bo3_stb';
            return (
              <View key={cuadro.key}>
                <Text style={styles.label}>
                  {cuadro.label ? `FORMATO · ${cuadro.label.toUpperCase()}` : 'FORMATO DE PARTIDO'}
                </Text>
                <View style={{ gap: 8 }}>
                  {MATCH_FORMATS.map((f) => {
                    const sel = cur === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => setPhaseFmt((prev) => ({ ...prev, [cuadro.key]: f.id }))}
                        style={[styles.fmtRow, sel && { borderColor: c.accent, backgroundColor: c.accent10 }]}
                      >
                        <View style={[styles.radio, sel && { borderColor: c.accent }]}>
                          {sel ? <View style={styles.radioDot} /> : null}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.fmtLabel}>{f.label}</Text>
                          <Text style={styles.fmtSub}>{f.sub}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <Text style={[styles.genHint, { textAlign: 'left', marginTop: 6 }]}>
            Cambiar el formato solo afecta a los partidos aún sin resultado; los ya
            puntuados se quedan como están.
          </Text>
        </>
      ) : null}

      {planDays.length > 1 && planPhases.length > 0 ? (
        <>
          <Text style={styles.label}>DÍAS DE CADA FASE</Text>
          <Text style={[styles.genHint, { textAlign: 'left', marginTop: -2, marginBottom: 8 }]}>
            Marca en qué días se juega cada fase (varios por fase). Todos los cuadros
            (oro/plata/bronce/consolación) comparten estos días.
          </Text>
          <View style={{ gap: 10 }}>
            {planPhases.map((ph) => {
              const selDays = phaseDays[`${ph.bracket}:${ph.round}`] ?? [];
              return (
                <View key={`${ph.bracket}:${ph.round}`} style={{ gap: 6 }}>
                  <Text style={styles.phaseLabel}>{ph.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {planDays.map((day) => {
                      const on = selDays.includes(day.iso);
                      return (
                        <Pressable
                          key={day.iso}
                          onPress={() => onSetPhaseDay(ph.bracket, ph.round, day.iso)}
                          style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                        >
                          <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                            {on ? '✓ ' : ''}{day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>LUGAR</Text>
      <View style={styles.input}>
        <TextInput value={location} onChangeText={setLocation} placeholder="Club · ciudad" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={80} />
      </View>

      <Text style={styles.label}>PLAZAS</Text>
      <View style={styles.input}>
        <TextInput value={maxPairs} onChangeText={(v) => setMaxPairs(v.replace(/[^0-9]/g, ''))} placeholder="16" placeholderTextColor={c.textFaint} style={styles.inputField} keyboardType="number-pad" maxLength={3} />
      </View>

      <Text style={styles.label}>CUOTA DE INSCRIPCIÓN (€)</Text>
      <View style={styles.input}>
        <TextInput
          value={fee}
          onChangeText={(v) => setFee(v.replace(/[^0-9.,]/g, '').replace(',', '.'))}
          placeholder="0 = gratis"
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          keyboardType="decimal-pad"
          maxLength={7}
        />
      </View>

      <View style={{ marginTop: 4 }}>
        <PrizeInfoEditor
          prizes={prizesJson}
          onPrizes={setPrizesJson}
          infoRows={infoRows}
          onInfoRows={setInfoRows}
          observations={observations}
          onObservations={setObservations}
        />
      </View>

      <Pressable onPress={confirmDelete} hitSlop={8} style={{ marginTop: 22, alignItems: 'center' }}>
        <Text style={{ color: c.error, fontSize: 14, fontWeight: '700' }}>Borrar torneo</Text>
      </Pressable>
    </BottomSheet>
  );
};

export const TournamentDetailScreen = ({
  navigation,
  route,
}: TournamentsStackScreenProps<'TournamentDetail'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;

  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editMatch, setEditMatch] = useState<TournamentMatch | null>(null);
  const [activeDiv, setActiveDiv] = useState<Division | null>(null);
  const [tab, setTab] = useState<TabKey>('main');
  const [scheduleCfgOpen, setScheduleCfgOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<TournamentRegistration | null>(null);
  const [phaseDays, setPhaseDays] = useState<Record<string, string[]>>({});
  const [koBracket, setKoBracket] = useState<'main' | 'consol'>('main');
  const [paying, setPaying] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleRound = (r: number) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });

  const load = useCallback(async () => {
    try {
      const [tt, rr, mm, pd] = await Promise.all([
        getTournament(tournamentId),
        listRegistrations(tournamentId),
        listMatches(tournamentId),
        getPhaseDays(tournamentId).catch(() => ({})),
      ]);
      setT(tt);
      setRegs(rr);
      setMatches(mm);
      setPhaseDays(pd);
    } catch (e: any) {
      toast.error('No se pudo cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Torneo retenido por el cobro: reabre el checkout. El servidor decide — si
  // ya estuviera cubierto responde sin cobrar, y si hay una sesión abierta la
  // reutiliza en vez de crear otra. Al volver del navegador, `useFocusEffect`
  // recarga y el torneo aparecerá ya publicado.
  const resumePayment = useCallback(async () => {
    if (!t) return;
    setPaying(true);
    try {
      const r = await startTournamentCheckout(t.id);
      if (r.paid) {
        toast.success('Torneo desbloqueado', 'Ya está cubierto: se ha publicado.');
        await load();
      }
    } catch (e: any) {
      toast.error('No se pudo abrir el pago', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setPaying(false);
    }
  }, [t, load]);

  const regName = useCallback(
    (id: string | null): string => {
      if (!id) return '—';
      const r = regs.find((x) => x.id === id);
      if (!r) return '—';
      const seed = r.seed ? `(${r.seed}) ` : '';
      return `${seed}${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}`;
    },
    [regs],
  );

  // Accesor enriquecido para las tarjetas de partido (avatar + siembra).
  const regInfo = useCallback(
    (id: string | null): RegInfo => {
      const r = id ? regs.find((x) => x.id === id) : null;
      return {
        name: r?.p1_name ?? '—',
        partner: r?.p2_name ?? null,
        seed: r?.seed ?? null,
        avatar: r?.p1_avatar ?? null,
        partnerAvatar: r?.p2_avatar ?? null,
      };
    },
    [regs],
  );

  // Divisiones = género × categoría (cada una su cuadro).
  const divisions = useMemo<Division[]>(() => {
    const gs = t?.genders?.length ? t.genders : [null];
    const cs = t?.categories?.length ? t.categories : [null];
    const out: Division[] = [];
    for (const g of gs) for (const cat of cs) out.push({ gender: g, category: cat });
    return out;
  }, [t]);

  useEffect(() => {
    if (
      divisions.length > 0 &&
      (!activeDiv || !divisions.some((d) => sameDiv(d, activeDiv)))
    ) {
      setActiveDiv(divisions[0]);
    }
  }, [divisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const dg = activeDiv?.gender ?? null;
  const dc = activeDiv?.category ?? null;
  const regsCat = useMemo(
    () => regs.filter((r) => r.gender === dg && r.category === dc),
    [regs, dg, dc],
  );
  const matchesCat = useMemo(
    () => matches.filter((m) => m.gender === dg && m.category === dc),
    [matches, dg, dc],
  );

  const isRR = t?.format === 'round_robin';
  const isGroups = t?.format === 'groups_ko';
  const isSocial = isSocialFormat(t?.format ?? '');
  const isMexicano = t?.format === 'mexicano';
  const hasBracket = matchesCat.length > 0;
  const mainTabLabel = isRR
    ? 'Clasificación'
    : isGroups
      ? 'Grupos'
      : isSocial
        ? 'Rondas'
        : 'Cuadro';
  const plainName = useCallback(
    (id: string | null) => regs.find((r) => r.id === id)?.p1_name ?? '—',
    [regs],
  );
  const enoughRegs = isSocial
    ? regsCat.length >= 4 && regsCat.length % 4 === 0
    : regsCat.length >= 2;

  const standings = useMemo(
    () => (isRR ? computeStandings(regsCat, matchesCat) : []),
    [isRR, regsCat, matchesCat],
  );

  const champion = useMemo(() => {
    if (!hasBracket) return null;
    if (isRR) {
      const allPlayed =
        matchesCat.length > 0 && matchesCat.every((m) => m.status === 'finished');
      return allPlayed ? standings[0]?.regId ?? null : null;
    }
    // KO: ganador de la final del cuadro principal. En grupos+KO el principal
    // es 'main' (modelo principal+consolación) o 'gold' (modelo por posición).
    const mainBracket = matchesCat.some((m) => m.bracket === 'main') ? 'main' : 'gold';
    const koMatches = matchesCat.filter((m) => m.bracket === mainBracket);
    const tr = koMatches.reduce((mx, x) => Math.max(mx, x.round), 0);
    const final = koMatches.find(
      (m) => m.round === tr && m.slot === 0 && m.status === 'finished',
    );
    return final?.winner_reg ?? null;
  }, [hasBracket, isRR, isGroups, matchesCat, standings]);

  const runGenerate = async (fn: () => Promise<void>) => {
    setGenerating(true);
    try {
      await fn();
      await load();
    } catch (e: any) {
      toast.error('No se pudo generar', e?.message ?? '');
    } finally {
      setGenerating(false);
    }
  };

  // Genera y, si va bien, avisa a los inscritos (in-app + push).
  const runGenerateBracket = (fn: () => Promise<void>) =>
    runGenerate(async () => {
      await fn();
      if (t) notifyTournamentPush('tournament_bracket', t.id);
    });

  const onGenerate = () => {
    if (!t) return;
    // Aviso si la categoría tiene menos parejas/jugadores que el mínimo del club.
    const minWarn =
      t.min_pairs != null && regsCat.length < t.min_pairs
        ? `⚠️ Esta categoría tiene ${regsCat.length} ${isSocial ? 'jugadores' : 'parejas'}, por debajo del mínimo de ${t.min_pairs}. `
        : '';
    if (isSocial) {
      Alert.alert(
        isMexicano ? 'Generar 1ª ronda' : 'Generar americano',
        minWarn +
          (isMexicano
            ? `Se creará la 1ª ronda del mexicano con ${regsCat.length} jugadores (siembra por puntos). Las siguientes rondas se generan por el ranking tras cada resultado.`
            : `Se crearán todas las rondas del americano con ${regsCat.length} jugadores (compañeros rotativos). No podrás añadir más jugadores.`),
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Generar',
            onPress: () =>
              runGenerateBracket(() =>
                isMexicano
                  ? generateMexicanoRound(t, regsCat, matchesCat, dg, dc)
                  : generateAmericano(t, regsCat, dg, dc),
              ),
          },
        ],
      );
      return;
    }
    if (isGroups) {
      Alert.alert(
        'Generar grupos',
        minWarn + `¿De cuántas parejas por grupo? Se repartirán las ${regsCat.length} parejas por siembra.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Grupos de 3', onPress: () => runGenerateBracket(() => generateGroups(t, regsCat, dg, dc, 3)) },
          { text: 'Grupos de 4', onPress: () => runGenerateBracket(() => generateGroups(t, regsCat, dg, dc, 4)) },
        ],
      );
      return;
    }
    Alert.alert(
      'Generar',
      minWarn +
        `Se ${isRR ? 'creará la liga' : 'creará el cuadro'}${activeDiv ? ` de ${divLabel(activeDiv)}` : ''} con ${regsCat.length} parejas. No podrás añadir más parejas a esta división.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: () =>
            runGenerateBracket(() =>
              isRR
                ? generateRoundRobin(t, regsCat, dg, dc)
                : generateKoBracket(t, regsCat, dg, dc),
            ),
        },
      ],
    );
  };

  const onGenerateKnockout = () => {
    if (!t) return;
    Alert.alert(
      'Generar eliminatorias',
      '¿Cómo reparto a los clasificados de los grupos?\n\n· Principal + consolación: los 2 primeros de cada grupo (+ los mejores 3os para llenar el cuadro) al cuadro principal; el resto a consolación.\n\n· Por posición: un cuadro por posición (Oro=1os, Plata=2os, Bronce=3os…).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Principal + consolación',
          onPress: () =>
            runGenerate(() =>
              generatePrincipalConsolationFromGroups(t, regsCat, matchesCat, dg, dc),
            ),
        },
        {
          text: 'Por posición (oro/plata…)',
          onPress: () =>
            runGenerate(() =>
              generateKnockoutFromGroups(t, regsCat, matchesCat, dg, dc),
            ),
        },
      ],
    );
  };

  const onGenerateNextRound = () => {
    if (!t) return;
    runGenerate(() => generateMexicanoRound(t, regsCat, matchesCat, dg, dc));
  };

  const onSetPhaseDay = async (bracket: string, round: number, iso: string) => {
    if (!t) return;
    // Toggle: una fase puede tener varios días.
    const key = `${bracket}:${round}`;
    const has = (phaseDays[key] ?? []).includes(iso);
    const on = !has;
    setPhaseDays((prev) => {
      const cur = prev[key] ?? [];
      const next = on ? [...cur, iso].sort() : cur.filter((x) => x !== iso);
      const copy = { ...prev };
      if (next.length) copy[key] = next;
      else delete copy[key];
      return copy;
    });
    try {
      await togglePhaseDay(t.id, bracket, round, iso, on);
    } catch (e: any) {
      toast.error('No se pudo guardar el día', e?.message ?? '');
      load();
    }
  };

  const onGenerateSchedule = () => {
    if (!t) return;
    runGenerate(async () => {
      const res = await autoScheduleTournament(t, regs, matches, phaseDays);
      if (res.unplaced > 0) {
        toast.error(
          `${res.scheduled} colocados · ${res.unplaced} sin hueco`,
          'No caben en un horario donde todos puedan. Añade pistas, amplía horas o mueve fases a otro día.',
        );
      } else {
        toast.success('Horario generado', `${res.scheduled} partidos colocados respetando la disponibilidad.`);
      }
      if (res.scheduled > 0) notifyTournamentPush('tournament_schedule', t.id);
    });
  };

  const onClearSchedule = () => {
    if (!t) return;
    Alert.alert('Borrar horario', '¿Quitar todas las horas y pistas asignadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => runGenerate(() => clearSchedule(t.id)),
      },
    ]);
  };

  const shareCode = async () => {
    if (!t?.signup_code) return;
    try {
      await Share.share({
        message:
          `🎾 Apúntate al torneo "${t.name}" en TACTIUM.\n` +
          `Código de inscripción: ${t.signup_code}`,
      });
    } catch {
      /* cancelado */
    }
  };

  const removeReg = (r: TournamentRegistration) => {
    Alert.alert('Quitar pareja', `¿Quitar a ${r.p1_name}${r.p2_name ? ' / ' + r.p2_name : ''}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRegistration(r.id);
            await load();
          } catch (e: any) {
            toast.error('No se pudo quitar', e?.message ?? '');
          }
        },
      },
    ]);
  };

  const dateRange =
    t && formatStartsOn(t.starts_on)
      ? t.ends_on && t.ends_on !== t.starts_on
        ? `${formatStartsOn(t.starts_on)} – ${formatStartsOn(t.ends_on)}`
        : formatStartsOn(t.starts_on)
      : null;

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : !t ? (
        <View style={[styles.center, { paddingHorizontal: 32, gap: 8 }]}>
          <Text style={styles.notFoundTitle}>Torneo no disponible</Text>
          <Text style={styles.notFoundText}>
            No se encontró este torneo o ya no existe.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.notFoundBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.notFoundBtnText}>Volver</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 64 + 12 + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO con portada */}
          <View style={styles.hero}>
            {t?.cover_url ? (
              <Image source={{ uri: t.cover_url }} style={styles.heroImg} />
            ) : (
              <LinearGradient
                colors={[c.accent25, c.bgCard]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroImg}
              />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)']}
              style={styles.heroFade}
            />
            <View style={styles.heroBottom}>
              {t?.status ? (
                <View style={styles.heroStatusPill}>
                  <View
                    style={[
                      styles.heroDot,
                      { backgroundColor: t.status === 'finished' ? '#cfcfcf' : c.primary },
                    ]}
                  />
                  <Text style={styles.heroStatusText}>
                    {tournamentStatusLabel(t.status, t.starts_on)}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.heroTitle} numberOfLines={2}>
                {t?.name ?? ''}
              </Text>
              {dateRange || t?.location ? (
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {[dateRange, t?.location].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Retenido por el pago: sin esto el torneo se quedaba en Borrador
              sin ninguna forma de retomar el checkout abandonado. */}
          {t?.status === 'draft' ? (
            <View style={styles.payBanner}>
              <Text style={styles.payBannerTitle}>Pendiente de pago</Text>
              <Text style={styles.payBannerText}>
                Este torneo no está publicado: no admite inscripciones ni tiene
                código para compartir hasta que se complete el pago.
              </Text>
              <Pressable
                onPress={resumePayment}
                disabled={paying}
                style={({ pressed }) => [
                  styles.payBannerBtn,
                  pressed && { opacity: 0.85 },
                  paying && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.payBannerBtnText}>
                  {paying ? 'Abriendo…' : 'Completar pago'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Campeón */}
          {champion ? (
            <ChampionHero info={regInfo(champion)} styles={styles} c={c} />
          ) : null}

          {/* Pestañas por división (género × categoría), cada una su cuadro */}
          {divisions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catTabs}
            >
              {divisions.map((d) => {
                const sel = activeDiv != null && sameDiv(d, activeDiv);
                return (
                  <Pressable
                    key={divLabel(d)}
                    onPress={() => setActiveDiv(d)}
                    style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                  >
                    <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                      {divLabel(d)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Pestañas de contenido: Cuadro · Horario · Jugadores · Info */}
          <ContentTabs
            tab={tab}
            setTab={setTab}
            mainLabel={mainTabLabel}
            showSchedule={hasBracket}
            styles={styles}
            c={c}
          />

          {tab === 'schedule' && t ? (
            <ScheduleView
              tournament={t}
              matches={matchesCat}
              allMatches={matches}
              defaultGender={dg}
              defaultCategory={dc}
              regs={regs}
              info={regInfo}
              onReload={load}
              onEdit={setEditMatch}
              onConfigure={() => setScheduleCfgOpen(true)}
              onGenerate={onGenerateSchedule}
              onClear={onClearSchedule}
              generating={generating}
              styles={styles}
              c={c}
            />
          ) : tab === 'players' ? (
            <PlayersView
              regs={regsCat}
              info={regInfo}
              social={isSocial}
              canEdit={!hasBracket}
              onAdd={() => setAdding(true)}
              onRemove={removeReg}
              onSelect={setSelectedReg}
              divName={activeDiv && divisions.length > 1 ? divLabel(activeDiv) : null}
              maxPairs={t?.max_pairs ?? null}
              styles={styles}
              c={c}
            />
          ) : tab === 'info' ? (
            <InfoView t={t} onShareCode={shareCode} styles={styles} c={c} />
          ) : !hasBracket ? (
            <View style={{ paddingHorizontal: 22 }}>
              {t?.signup_code ? (
                <View style={styles.codeCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.codeLabel}>CÓDIGO DE INSCRIPCIÓN</Text>
                    <Text style={styles.code}>{t.signup_code}</Text>
                    <Text style={styles.codeHint}>
                      Compártelo para que se apunten desde la app.
                    </Text>
                  </View>
                  <Pressable
                    onPress={shareCode}
                    hitSlop={8}
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
                  >
                    <IconShare size={16} color={c.accent} />
                  </Pressable>
                </View>
              ) : null}

              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                {regsCat.length}{' '}
                {isSocial
                  ? regsCat.length === 1
                    ? 'jugador inscrito'
                    : 'jugadores inscritos'
                  : regsCat.length === 1
                    ? 'pareja inscrita'
                    : 'parejas inscritas'}
                {t?.max_pairs ? ` · máx ${t.max_pairs}` : ''}
              </Text>
              <Text style={[styles.emptyText, { marginTop: 6 }]}>
                Gestiona los inscritos en la pestaña <Text style={{ color: c.accent, fontWeight: '700' }}>Jugadores</Text>. Cuando estén todos, genera{' '}
                {isRR ? 'la liga' : isGroups ? 'los grupos' : isSocial ? 'las rondas' : 'el cuadro'}.
              </Text>

              <Pressable
                onPress={onGenerate}
                disabled={!enoughRegs || generating}
                style={({ pressed }) => [
                  styles.generateBtn,
                  (!enoughRegs || generating) && { opacity: 0.4 },
                  pressed && { opacity: 0.9 },
                ]}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={c.textInverse} />
                ) : (
                  <Text style={styles.generateLabel}>
                    {isMexicano
                      ? 'Generar 1ª ronda'
                      : t?.format === 'americano'
                        ? 'Generar americano'
                        : isGroups
                          ? 'Generar grupos'
                          : isRR
                            ? 'Generar liga'
                            : 'Generar cuadro'}
                    {activeDiv && divisions.length > 1 ? ` · ${divLabel(activeDiv)}` : ''}
                  </Text>
                )}
              </Pressable>
              {!enoughRegs ? (
                <Text style={styles.genHint}>
                  {isSocial
                    ? 'Hacen falta jugadores en múltiplo de 4 (4, 8, 12…)'
                    : 'Hacen falta al menos 2 parejas'}
                  {activeDiv && divisions.length > 1 ? ` en ${divLabel(activeDiv)}` : ''}.
                </Text>
              ) : null}
            </View>
          ) : isSocial ? (
            <SocialView
              regs={regsCat}
              matches={matchesCat}
              info={regInfo}
              isMexicano={isMexicano}
              collapsed={collapsed}
              toggleRound={toggleRound}
              onEdit={setEditMatch}
              onGenerateNextRound={onGenerateNextRound}
              generating={generating}
            />
          ) : isRR ? (
            <RoundRobinView
              standings={standings}
              matches={matchesCat}
              info={regInfo}
              onEdit={setEditMatch}
            />
          ) : isGroups ? (
            <GroupsView
              regs={regsCat}
              matches={matchesCat}
              regName={regName}
              info={regInfo}
              collapsed={collapsed}
              toggleRound={toggleRound}
              onEdit={setEditMatch}
              onGenerateKnockout={onGenerateKnockout}
              generating={generating}
            />
          ) : (
            (() => {
              const hasConsol = matchesCat.some((m) => m.bracket === 'consol');
              const activeKo = hasConsol ? koBracket : 'main';
              return (
                <View>
                  {hasConsol ? (
                    <View style={styles.koTabs}>
                      {(
                        [
                          { id: 'main', label: 'Principal' },
                          { id: 'consol', label: 'Consolación' },
                        ] as { id: 'main' | 'consol'; label: string }[]
                      ).map((b) => {
                        const sel = activeKo === b.id;
                        return (
                          <Pressable
                            key={b.id}
                            onPress={() => setKoBracket(b.id)}
                            style={[styles.koTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                          >
                            <Text style={[styles.koTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                              {b.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
                      CUADRO
                    </Text>
                  )}
                  <BracketView
                    matches={matchesCat.filter((m) => m.bracket === activeKo)}
                    regName={regName}
                    onEdit={setEditMatch}
                    collapsed={collapsed}
                    toggleRound={toggleRound}
                  />
                  <Text style={styles.bracketHint}>
                    {activeKo === 'consol'
                      ? 'Cuadro de consolación: aquí caen los que pierden en la 1ª ronda del principal.'
                      : 'Toca una ronda para ocultarla/mostrarla. Toca un partido para meter el resultado.'}
                  </Text>
                </View>
              );
            })()
          )}
        </ScrollView>
      )}

      {/* Controles flotantes sobre el hero */}
      <View
        style={[styles.heroControls, { top: insets.top + 6 }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.heroCtrlBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={20} color="#fff" />
        </Pressable>
        {t && !loading ? (
          <Pressable
            onPress={() => setEditOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.heroCtrlBtn, pressed && { opacity: 0.7 }]}
          >
            <IconPencil size={17} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <AddPairSheet
        open={adding}
        tournamentId={tournamentId}
        gender={dg}
        category={dc}
        social={isSocial}
        onClose={() => setAdding(false)}
        onAdded={load}
      />

      <ResultSheet
        match={editMatch}
        matchFormat={resolveMatchFormat(t, editMatch?.bracket ?? '')}
        advance={!isRR && !isSocial}
        social={isSocial}
        homeName={
          isSocial
            ? `${plainName(editMatch?.home_reg ?? null)} / ${plainName(editMatch?.home_reg2 ?? null)}`
            : regName(editMatch?.home_reg ?? null)
        }
        awayName={
          isSocial
            ? `${plainName(editMatch?.away_reg ?? null)} / ${plainName(editMatch?.away_reg2 ?? null)}`
            : regName(editMatch?.away_reg ?? null)
        }
        onClose={() => setEditMatch(null)}
        onSaved={load}
      />

      <ScheduleConfigSheet
        open={scheduleCfgOpen}
        tournament={t}
        onClose={() => setScheduleCfgOpen(false)}
        onSaved={(generate) => {
          if (generate) onGenerateSchedule();
          else load();
        }}
        styles={styles}
        c={c}
      />

      <PlayerInfoSheet
        reg={selectedReg}
        social={isSocial}
        onClose={() => setSelectedReg(null)}
        styles={styles}
        c={c}
      />

      <EditTournamentSheet
        open={editOpen}
        tournament={t}
        matches={matches}
        phaseDays={phaseDays}
        onSetPhaseDay={onSetPhaseDay}
        onClose={() => setEditOpen(false)}
        onSaved={load}
        onDeleted={() => {
          setEditOpen(false);
          navigation.goBack();
        }}
        styles={styles}
        c={c}
      />
    </View>
  );
};

const MatchSide: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  name: string;
  score: number | null;
  win: boolean;
}> = ({ styles, name, score, win }) => {
  const bye = name === '—';
  return (
    <View style={styles.matchSide}>
      <View style={[styles.wDotSm, win && styles.wDotSmOn]}>
        {win ? <Text style={styles.wDotSmText}>W</Text> : null}
      </View>
      <Text
        style={[styles.matchName, win && styles.matchNameWin, bye && styles.matchNameBye]}
        numberOfLines={1}
      >
        {bye ? 'BYE' : name}
      </Text>
      <Text style={[styles.matchScore, win && styles.matchNameWin]}>
        {score ?? ''}
      </Text>
    </View>
  );
};

export type Styles = ReturnType<typeof makeStyles>;


// Tabla de clasificación (liga/grupo).
export const StandingsTable: React.FC<{ standings: StandingRow[]; styles: Styles }> = ({
  standings,
  styles,
}) => {
  const anyH2h = standings.some((s) => s.h2h);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
          <View style={styles.stHeader}>
            <Text style={styles.stPos}>#</Text>
            <Text style={styles.stName}>PAREJA</Text>
            <Text style={styles.stCol}>PJ</Text>
            <Text style={styles.stCol}>G</Text>
            <Text style={styles.stCol}>P</Text>
            <Text style={styles.stColW}>SETS</Text>
            <Text style={styles.stColW}>JUEGOS</Text>
            <Text style={styles.stCol}>PTS</Text>
          </View>
          {standings.map((s, i) => (
            <View key={s.regId} style={styles.stRow}>
              <Text style={styles.stPos}>{i + 1}</Text>
              <Text style={styles.stName} numberOfLines={1}>
                {s.name}
                {s.h2h ? <Text style={styles.h2hMark}> *</Text> : null}
              </Text>
              <Text style={styles.stCol}>{s.played}</Text>
              <Text style={styles.stCol}>{s.won}</Text>
              <Text style={styles.stCol}>{s.lost}</Text>
              <Text style={styles.stColW}>{s.setsFor}-{s.setsAgainst}</Text>
              <Text style={styles.stColW}>{s.gamesFor}-{s.gamesAgainst}</Text>
              <Text style={[styles.stCol, styles.stPts]}>{s.points}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {anyH2h ? (
        <Text style={styles.h2hLegend}>* orden por resultado directo (empate a puntos)</Text>
      ) : null}
    </>
  );
};

// Cuadro KO (columnas por ronda + conectores + rondas colapsables).
export const BracketView: React.FC<{
  matches: TournamentMatch[];
  regName: (id: string | null) => string;
  onEdit: (m: TournamentMatch) => void;
  collapsed: Set<number>;
  toggleRound: (r: number) => void;
  readOnly?: boolean;
}> = ({ matches, regName, onEdit, collapsed, toggleRound, readOnly }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const totalRounds = matches.reduce((m, x) => Math.max(m, x.round), 0);
  const r1count = matches.filter((m) => m.round === 1).length;
  const totalH = r1count * PITCH1;
  if (matches.length === 0) {
    return <Text style={styles.bracketHint}>Sin cuadro todavía.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 22, paddingTop: 12 }}>
        {Array.from({ length: totalRounds }, (_, r) => r + 1).map((round) => {
          const col = matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.slot - b.slot);
          const isCol = collapsed.has(round);
          const { pitch, topOffset } = roundMetrics(round);
          return (
            <React.Fragment key={round}>
              <View style={{ width: isCol ? 52 : COL_W }}>
                <Pressable
                  onPress={() => toggleRound(round)}
                  style={({ pressed }) => [styles.roundPill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.roundPillText} numberOfLines={1}>
                    {isCol ? shortRoundLabel(round, totalRounds) : roundLabel(round, totalRounds)}
                  </Text>
                  <Text style={styles.roundPillChevron}>{isCol ? '›' : '⌄'}</Text>
                </Pressable>
                {isCol ? (
                  <View style={[styles.collapsedStrip, { height: totalH }]}>
                    <Text style={styles.collapsedText}>{col.length}</Text>
                  </View>
                ) : (
                  <View style={{ height: totalH }}>
                    {col.map((m, i) => {
                      const playable = !!m.home_reg && !!m.away_reg;
                      const homeWin = m.winner_reg && m.winner_reg === m.home_reg;
                      const awayWin = m.winner_reg && m.winner_reg === m.away_reg;
                      return (
                        <Pressable
                          key={m.id}
                          disabled={!playable || readOnly}
                          onPress={() => onEdit(m)}
                          style={({ pressed }) => [
                            styles.matchCard,
                            { marginTop: i === 0 ? topOffset : pitch - BRACKET_H, height: BRACKET_H },
                            pressed && playable && !readOnly && { opacity: 0.85 },
                          ]}
                        >
                          <MatchSide styles={styles} name={regName(m.home_reg)} score={m.home_score} win={!!homeWin} />
                          <View style={styles.matchDivider} />
                          <MatchSide styles={styles} name={regName(m.away_reg)} score={m.away_score} win={!!awayWin} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
              {round < totalRounds ? (
                <RoundConnectors
                  round={round}
                  targets={Math.floor(r1count / Math.pow(2, round))}
                  totalH={totalH}
                  line={c.hairStrong}
                  hidden={isCol || collapsed.has(round + 1)}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
};

// Vista de LIGA: clasificación + lista de partidos.
export const RoundRobinView: React.FC<{
  standings: StandingRow[];
  matches: TournamentMatch[];
  info: (id: string | null) => RegInfo;
  onEdit: (m: TournamentMatch) => void;
  readOnly?: boolean;
}> = ({ standings, matches, info, onEdit, readOnly }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sorted = [...matches].sort((a, b) => a.slot - b.slot);
  const played = matches.filter((m) => m.status === 'finished').length;
  return (
    <View>
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
        CLASIFICACIÓN
      </Text>
      <StandingsTable standings={standings} styles={styles} />
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 24 }]}>
        PARTIDOS · {played}/{matches.length}
      </Text>
      <View style={{ paddingHorizontal: 22, gap: 8, marginTop: 6 }}>
        {sorted.map((m) => (
          <MatchCard key={m.id} m={m} info={info} onEdit={onEdit} readOnly={readOnly} styles={styles} c={c} />
        ))}
      </View>
    </View>
  );
};

// Vista de GRUPOS + eliminatorias: fase de grupos (clasificación + partidos) y
// luego los cuadros por posición (oro/plata/bronce).
export const GroupsView: React.FC<{
  regs: TournamentRegistration[];
  matches: TournamentMatch[];
  regName: (id: string | null) => string;
  info: (id: string | null) => RegInfo;
  collapsed: Set<number>;
  toggleRound: (r: number) => void;
  onEdit: (m: TournamentMatch) => void;
  onGenerateKnockout: () => void;
  generating: boolean;
  readOnly?: boolean;
}> = ({ regs, matches, regName, info, collapsed, toggleRound, onEdit, onGenerateKnockout, generating, readOnly }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const groupMatches = matches.filter((m) => m.bracket === 'grp');
  const koMatches = matches.filter((m) => m.bracket !== 'grp');
  const groupNos = Array.from(
    new Set(regs.filter((r) => r.group_no != null).map((r) => r.group_no as number)),
  ).sort((a, b) => a - b);
  const allGroupsDone =
    groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished');
  const koBrackets = Array.from(new Set(koMatches.map((m) => m.bracket))).sort(
    (a, b) => bracketRank(a) - bracketRank(b),
  );
  const [activeBracket, setActiveBracket] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  useEffect(() => {
    if (koBrackets.length && (!activeBracket || !koBrackets.includes(activeBracket))) {
      setActiveBracket(koBrackets[0]);
    }
  }, [koMatches.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (groupNos.length && (activeGroup == null || !groupNos.includes(activeGroup))) {
      setActiveGroup(groupNos[0]);
    }
  }, [groupNos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (koMatches.length === 0) {
    const gn = activeGroup ?? groupNos[0] ?? 0;
    const gRegs = regs.filter((r) => r.group_no === gn);
    const gMatches = groupMatches
      .filter((m) => m.group_no === gn)
      .sort((a, b) => a.slot - b.slot);
    const st = computeStandings(gRegs, gMatches);
    const gDone = gMatches.length > 0 && gMatches.every((m) => m.status === 'finished');
    return (
      <View>
        {/* Sub-pestañas por grupo */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catTabs}
        >
          {groupNos.map((n) => {
            const sel = gn === n;
            const nDone = groupMatches
              .filter((m) => m.group_no === n)
              .every((m) => m.status === 'finished');
            return (
              <Pressable
                key={n}
                onPress={() => setActiveGroup(n)}
                style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                  Grupo {groupName(n)}
                  {nDone ? ' ✓' : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 14 }]}>
          CLASIFICACIÓN · GRUPO {groupName(gn)}
        </Text>
        <StandingsTable standings={st} styles={styles} />
        <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 22 }]}>
          PARTIDOS {gDone ? '· completado' : ''}
        </Text>
        <View style={{ paddingHorizontal: 22, gap: 8, marginTop: 8 }}>
          {gMatches.map((m) => (
            <MatchCard key={m.id} m={m} info={info} onEdit={onEdit} readOnly={readOnly} styles={styles} c={c} />
          ))}
        </View>

        {readOnly ? null : (
          <>
            <Pressable
              onPress={onGenerateKnockout}
              disabled={!allGroupsDone || generating}
              style={({ pressed }) => [
                styles.generateBtn,
                { marginHorizontal: 22, marginTop: 24 },
                (!allGroupsDone || generating) && { opacity: 0.4 },
                pressed && { opacity: 0.9 },
              ]}
            >
              {generating ? (
                <ActivityIndicator size="small" color={c.textInverse} />
              ) : (
                <Text style={styles.generateLabel}>Generar eliminatorias</Text>
              )}
            </Pressable>
            {!allGroupsDone ? (
              <Text style={styles.genHint}>
                Termina todos los partidos de grupo para generar las eliminatorias.
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <View>
      {koBrackets.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catTabs}
        >
          {koBrackets.map((b) => {
            const sel = activeBracket === b;
            return (
              <Pressable
                key={b}
                onPress={() => setActiveBracket(b)}
                style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                  {bracketLabel(b)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 12 }]}>
        {(activeBracket ? bracketLabel(activeBracket) : 'CUADRO').toUpperCase()}
      </Text>
      <BracketView
        matches={koMatches.filter((m) => m.bracket === activeBracket)}
        regName={regName}
        onEdit={onEdit}
        collapsed={collapsed}
        toggleRound={toggleRound}
        readOnly={readOnly}
      />
    </View>
  );
};

// Vista SOCIAL (americano / mexicano): ranking individual + rondas 2vs2.
export const SocialView: React.FC<{
  regs: TournamentRegistration[];
  matches: TournamentMatch[];
  info: (id: string | null) => RegInfo;
  isMexicano: boolean;
  collapsed: Set<number>;
  toggleRound: (r: number) => void;
  onEdit: (m: TournamentMatch) => void;
  onGenerateNextRound: () => void;
  generating: boolean;
  readOnly?: boolean;
}> = ({
  regs,
  matches,
  info,
  isMexicano,
  collapsed,
  toggleRound,
  onEdit,
  onGenerateNextRound,
  generating,
  readOnly,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const standings = useMemo(
    () => computeIndividualStandings(regs, matches),
    [regs, matches],
  );
  const rounds = useMemo(
    () => Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b),
    [matches],
  );
  const lastRound = rounds.length ? rounds[rounds.length - 1] : 0;
  const lastRoundDone =
    lastRound > 0 &&
    matches.filter((m) => m.round === lastRound).every((m) => m.status === 'finished');

  return (
    <View>
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
        RANKING
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
          <View style={styles.stHeader}>
            <Text style={styles.stPos}>#</Text>
            <Text style={styles.stName}>JUGADOR</Text>
            <Text style={styles.stCol}>PJ</Text>
            <Text style={styles.stCol}>G</Text>
            <Text style={styles.stCol}>PTS</Text>
          </View>
          {standings.map((s, i) => (
            <View key={s.regId} style={styles.stRow}>
              <Text style={styles.stPos}>{i + 1}</Text>
              <Text style={styles.stName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.stCol}>{s.played}</Text>
              <Text style={styles.stCol}>{s.won}</Text>
              <Text style={[styles.stCol, styles.stPts]}>{s.points}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {rounds.map((round) => {
        const col = matches
          .filter((m) => m.round === round)
          .sort((a, b) => a.slot - b.slot);
        const isCol = collapsed.has(round);
        const done = col.filter((m) => m.status === 'finished').length;
        return (
          <View key={round}>
            <Pressable
              onPress={() => toggleRound(round)}
              style={({ pressed }) => [
                styles.socialRoundHead,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.sectionLabel}>
                RONDA {round} · {done}/{col.length}
              </Text>
              <Text style={styles.roundPillChevron}>{isCol ? '›' : '⌄'}</Text>
            </Pressable>
            {isCol ? null : (
              <View style={{ paddingHorizontal: 22, gap: 8, marginTop: 6 }}>
                {col.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    info={info}
                    onEdit={onEdit}
                    social
                    readOnly={readOnly}
                    styles={styles}
                    c={c}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      {isMexicano && !readOnly ? (
        <Pressable
          onPress={onGenerateNextRound}
          disabled={!lastRoundDone || generating}
          style={({ pressed }) => [
            styles.generateBtn,
            { marginHorizontal: 22, marginTop: 20 },
            (!lastRoundDone || generating) && { opacity: 0.4 },
            pressed && { opacity: 0.9 },
          ]}
        >
          {generating ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.generateLabel}>Generar ronda {lastRound + 1}</Text>
          )}
        </Pressable>
      ) : null}
      {isMexicano && !readOnly && !lastRoundDone ? (
        <Text style={styles.genHint}>
          Cierra todos los partidos de la ronda {lastRound} para generar la siguiente.
        </Text>
      ) : null}
    </View>
  );
};

const AddPairSheet: React.FC<{
  open: boolean;
  tournamentId: string;
  gender: string | null;
  category: string | null;
  social?: boolean;
  onClose: () => void;
  onAdded: () => void;
}> = ({ open, tournamentId, gender, category, social, onClose, onAdded }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [pts, setPts] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setP1('');
      setP2('');
      setPts('');
    }
  }, [open]);

  const save = async () => {
    if (!p1.trim()) {
      toast.error('Falta el jugador 1');
      return;
    }
    setSaving(true);
    try {
      await addRegistration({
        tournamentId,
        gender,
        category,
        p1Name: p1,
        p2Name: social ? '' : p2,
        seedPoints: pts ? parseInt(pts, 10) : null,
      });
      onAdded();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo añadir', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || !p1.trim()}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !p1.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>{social ? 'Añadir jugador' : 'Añadir pareja'}</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>{social ? 'AÑADIR JUGADOR' : 'AÑADIR PAREJA'}</Text>
      <Text style={styles.sheetTitle}>Alta manual</Text>

      <Text style={styles.label}>{social ? 'JUGADOR' : 'JUGADOR 1'}</Text>
      <View style={styles.input}>
        <TextInput value={p1} onChangeText={setP1} placeholder="Nombre" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
      </View>
      {!social ? (
        <>
          <Text style={styles.label}>JUGADOR 2</Text>
          <View style={styles.input}>
            <TextInput value={p2} onChangeText={setP2} placeholder="Nombre (opcional)" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
          </View>
        </>
      ) : null}
      <Text style={styles.label}>PUNTOS PARA LA SIEMBRA · OPCIONAL</Text>
      <View style={styles.input}>
        <TextInput
          value={pts}
          onChangeText={(v) => setPts(v.replace(/[^0-9]/g, ''))}
          placeholder="p. ej. 1500"
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          keyboardType="number-pad"
          maxLength={5}
        />
      </View>
    </BottomSheet>
  );
};

const ResultSheet: React.FC<{
  match: TournamentMatch | null;
  matchFormat: string;
  advance: boolean;
  social?: boolean;
  homeName: string;
  awayName: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ match, matchFormat, advance, social, homeName, awayName, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cfg = useMemo(() => formatConfig(matchFormat), [matchFormat]);
  const [rows, setRows] = useState<{ h: string; a: string }[]>([]);
  const [pts, setPts] = useState<{ h: string; a: string }>({ h: '', a: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setPts({
      h: match.home_score != null ? String(match.home_score) : '',
      a: match.away_score != null ? String(match.away_score) : '',
    });
    setRows(
      Array.from({ length: cfg.maxSets }, (_, i) => {
        const s = match.sets?.[i];
        return { h: s ? String(s[0]) : '', a: s ? String(s[1]) : '' };
      }),
    );
  }, [match, cfg.maxSets]);

  const setCell = (i: number, side: 'h' | 'a', v: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [side]: v.replace(/[^0-9]/g, '') } : r)),
    );

  const { wonHome, wonAway } = useMemo(() => {
    let wh = 0;
    let wa = 0;
    for (const r of rows) {
      const h = parseInt(r.h, 10);
      const a = parseInt(r.a, 10);
      if (Number.isNaN(h) || Number.isNaN(a) || h === a) continue;
      if (h > a) wh++;
      else wa++;
    }
    return { wonHome: wh, wonAway: wa };
  }, [rows]);

  const socialDecided = pts.h.trim() !== '' && pts.a.trim() !== '';
  const decided = social
    ? socialDecided
    : wonHome >= cfg.setsToWin || wonAway >= cfg.setsToWin;

  const save = async () => {
    if (!match) return;
    setSaving(true);
    try {
      if (social) {
        await setSocialResult(match, parseInt(pts.h, 10) || 0, parseInt(pts.a, 10) || 0);
      } else {
        const sets = rows
          .map((r) => [parseInt(r.h, 10), parseInt(r.a, 10)])
          .filter(([h, a]) => !Number.isNaN(h) && !Number.isNaN(a) && (h !== 0 || a !== 0));
        await setMatchResult(match, sets, cfg.setsToWin, advance);
      }
      toast.success('Resultado guardado');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  const setLabel = (i: number) =>
    cfg.thirdSuperTb && cfg.maxSets === 3 && i === 2
      ? 'SUPER TIE-BREAK (a 11)'
      : `SET ${i + 1}`;

  return (
    <BottomSheet
      open={!!match}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || !decided}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !decided) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Guardar resultado</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>
        RESULTADO{social ? ' · JUEGOS' : ` · ${cfg.label.toUpperCase()}`}
      </Text>
      <Text style={styles.setTeam} numberOfLines={1}>{homeName}</Text>
      <Text style={styles.setVs}>vs</Text>
      <Text style={styles.setTeam} numberOfLines={1}>{awayName}</Text>

      {social ? (
        <>
          <View style={styles.setRow}>
            <Text style={styles.setRowLabel}>JUEGOS</Text>
            <View style={styles.setInputs}>
              <TextInput
                value={pts.h}
                onChangeText={(v) => setPts((p) => ({ ...p, h: v.replace(/[^0-9]/g, '') }))}
                placeholder="0"
                placeholderTextColor={c.textFaint}
                style={styles.setInput}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.setSep}>–</Text>
              <TextInput
                value={pts.a}
                onChangeText={(v) => setPts((p) => ({ ...p, a: v.replace(/[^0-9]/g, '') }))}
                placeholder="0"
                placeholderTextColor={c.textFaint}
                style={styles.setInput}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          <Text style={[styles.liveResult, decided && { color: c.accent }]}>
            {decided
              ? `${pts.h}–${pts.a} · ${
                  parseInt(pts.h, 10) === parseInt(pts.a, 10)
                    ? 'empate'
                    : `gana ${parseInt(pts.h, 10) > parseInt(pts.a, 10) ? homeName : awayName}`
                }`
              : 'Introduce los juegos de cada pareja'}
          </Text>
        </>
      ) : (
        <>
          {rows.map((r, i) => (
            <View key={i} style={styles.setRow}>
              <Text style={styles.setRowLabel}>{setLabel(i)}</Text>
              <View style={styles.setInputs}>
                <TextInput
                  value={r.h}
                  onChangeText={(v) => setCell(i, 'h', v)}
                  placeholder="0"
                  placeholderTextColor={c.textFaint}
                  style={styles.setInput}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.setSep}>–</Text>
                <TextInput
                  value={r.a}
                  onChangeText={(v) => setCell(i, 'a', v)}
                  placeholder="0"
                  placeholderTextColor={c.textFaint}
                  style={styles.setInput}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
          ))}

          <Text style={[styles.liveResult, decided && { color: c.accent }]}>
            {wonHome}–{wonAway} en sets
            {decided
              ? ` · gana ${wonHome > wonAway ? homeName : awayName}`
              : ' · marcador incompleto'}
          </Text>
        </>
      )}
    </BottomSheet>
  );
};

export const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    notFoundTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
    notFoundText: { color: c.textMuted, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
    notFoundBtn: {
      marginTop: 10,
      backgroundColor: c.accent,
      borderRadius: Radius.md,
      paddingHorizontal: 24,
      paddingVertical: 11,
    },
    notFoundBtnText: { color: c.textInverse, fontSize: 14, fontWeight: '800' },
    championCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 22,
      marginTop: 8,
      padding: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    championLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.accentDim, fontWeight: '600' },
    championName: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
    // Cabecera: pill de estado + fecha
    headMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusPill: {
      paddingHorizontal: 8,
      height: 18,
      borderRadius: 5,
      justifyContent: 'center',
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    statusPillDone: { backgroundColor: c.bgRaised, borderColor: c.hairStrong },
    statusPillText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', color: c.accent },
    statusPillTextDone: { color: c.textMuted },
    headDate: { fontFamily: Fonts.mono, fontSize: 11, color: c.textFaint, fontWeight: '600' },
    // Hero de campeón
    heroCard: {
      marginHorizontal: 22,
      marginTop: 10,
      padding: 18,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroEyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '700' },
    heroBody: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
    heroAvatars: { flexDirection: 'row', alignItems: 'center' },
    heroName: { color: c.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
    // Pestañas de contenido
    contentTabs: {
      flexDirection: 'row',
      gap: 6,
      marginHorizontal: 22,
      marginTop: 14,
      padding: 4,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    contentTab: {
      flex: 1,
      height: 38,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentTabText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
    // Fila de jugador (pestaña Jugadores)
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    seedBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    seedBadgeText: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '800', color: c.accent },
    seedBadgeEmpty: { width: 24, height: 24 },
    playerName: { color: c.text, fontSize: 15, fontWeight: '700' },
    playerMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    // Tarjeta de información del torneo
    infoCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
    },
    payBanner: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(c.primary, 0.45),
      backgroundColor: withAlpha(c.primary, 0.1),
      gap: 8,
    },
    payBannerTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    payBannerText: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    payBannerBtn: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 9999,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payBannerBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, gap: 12 },
    infoRowBorder: { borderTopWidth: 1, borderColor: c.hair },
    infoLabel: { width: 120, color: c.textMuted, fontSize: 13, fontWeight: '600' },
    infoValue: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
    infoBlock: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 16,
    },
    infoBlockText: { color: c.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },
    availChip: {
      paddingHorizontal: 10,
      height: 30,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    availChipText: { color: c.text, fontSize: 12, fontWeight: '600' },
    // Banner de portada
    coverBanner: { height: 180, marginBottom: 4 },
    coverBannerImg: { width: '100%', height: '100%' },
    coverBannerFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 },
    // Hero de cabecera con portada
    hero: { height: 250, backgroundColor: c.bgCard, marginBottom: 4 },
    heroImg: { position: 'absolute', width: '100%', height: '100%' },
    heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%' },
    heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 16 },
    heroStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 9999,
      backgroundColor: 'rgba(0,0,0,0.45)',
      marginBottom: 8,
    },
    heroDot: { width: 7, height: 7, borderRadius: 4 },
    heroStatusText: { color: '#fff', fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' },
    heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    heroMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', marginTop: 4 },
    heroControls: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    heroCtrlBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    // Tus partidos (vista del jugador)
    myMatchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.accent10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.accent25,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    myMatchRival: { color: c.text, fontSize: 15, fontWeight: '700' },
    myMatchMeta: { color: c.textMuted, fontSize: 12, marginTop: 3, fontWeight: '600' },
    myMatchScore: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '800', color: c.accent },
    enrolled: {
      marginHorizontal: 22,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
    },
    enrolledText: { color: c.accent, fontSize: 14, fontWeight: '800' },
    // Horario
    matchWhen: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', color: c.accent },
    schedConfigCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 8,
    },
    schedConfigLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.5, color: c.textFaint, fontWeight: '600' },
    schedConfigValue: { color: c.text, fontSize: 14, fontWeight: '600', marginTop: 3 },
    schedTime: {
      fontFamily: Fonts.mono,
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 8,
    },
    schedPhaseHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    schedPhaseTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
    schedPhaseCount: { color: c.textFaint, fontWeight: '600' },
    dayTab: {
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayTabText: { fontSize: 12.5, fontWeight: '700' },
    phaseRow: { gap: 6 },
    phaseLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
    phaseDayChip: {
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phaseDayChipText: { fontSize: 13, fontWeight: '700' },
    unplacedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: withAlpha(c.error, 0.06),
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: withAlpha(c.error, 0.3),
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    unplacedTeams: { color: c.text, fontSize: 14, fontWeight: '700' },
    manualBtn: {
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 9999,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manualBtnText: { color: c.textInverse, fontSize: 12.5, fontWeight: '800' },
    timeChip: {
      paddingHorizontal: 10,
      height: 34,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeChipText: { fontFamily: Fonts.mono, fontSize: 12.5, fontWeight: '700' },
    availLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.bgCard,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: c.hair,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    availName: { width: 96, color: c.text, fontSize: 13, fontWeight: '700' },
    availFranjas: { flex: 1, color: c.accent, fontSize: 12.5, fontWeight: '600' },
    conflictBanner: {
      backgroundColor: withAlpha(c.error, 0.12),
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: withAlpha(c.error, 0.4),
      padding: 12,
      marginTop: 12,
    },
    conflictBannerText: { color: c.error, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
    conflictTag: { color: c.error, fontSize: 11, fontWeight: '800', marginBottom: 4 },
    durChip: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durChipText: { fontSize: 14, fontWeight: '700' },
    catTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingTop: 12 },
    catTab: {
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catTabText: { fontSize: 14, fontWeight: '700' },
    koTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingTop: 12, marginBottom: 2 },
    koTab: {
      paddingHorizontal: 16,
      height: 36,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    koTabText: { fontSize: 13.5, fontWeight: '700' },
    gridBtn: {
      marginTop: 10,
      height: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridBtnText: { color: c.text, fontSize: 14, fontWeight: '700' },
    carriedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 10,
      padding: 10,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    carriedText: { flex: 1, color: c.text, fontSize: 13, fontWeight: '700' },
    carriedRemove: { color: c.error, fontSize: 12.5, fontWeight: '800' },
    carriedCancel: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    gridCorner: { width: 52, height: 30 },
    gridHeadCell: { width: 98, height: 26, alignItems: 'center', justifyContent: 'center' },
    gridHeadText: { color: c.textMuted, fontSize: 11, fontWeight: '800' },
    gridTimeCell: { width: 42, height: 52, alignItems: 'center', justifyContent: 'center' },
    gridTimeText: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    gridCell: {
      width: 98,
      height: 48,
      margin: 1.5,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    gridCellFull: { backgroundColor: c.bgCard, borderColor: c.hairStrong },
    gridCellFree: { backgroundColor: c.bgRaised, borderColor: c.hairStrong },
    gridCellCat: {
      fontFamily: Fonts.mono,
      fontSize: 7.5,
      letterSpacing: 0.2,
      color: c.accent,
      fontWeight: '800',
    },
    gridCellText: { color: c.text, fontSize: 9, fontWeight: '700', textAlign: 'center' },
    gridCellTextAway: { color: c.textMuted, fontSize: 9, fontWeight: '600', textAlign: 'center' },
    gridCellFreeText: { color: c.accent, fontSize: 15, fontWeight: '800' },
    unschedChip: {
      paddingHorizontal: 10,
      height: 34,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: 160,
    },
    unschedChipText: { fontSize: 12, fontWeight: '700' },
    codeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent25,
      padding: 16,
      marginTop: 8,
    },
    codeLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.textFaint, fontWeight: '500' },
    code: { fontFamily: Fonts.mono, fontSize: 28, fontWeight: '800', color: c.accent, letterSpacing: 4, marginTop: 4 },
    codeHint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    shareBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    regHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 8,
    },
    sectionLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: c.textFaint, textTransform: 'uppercase', fontWeight: '500' },
    socialRoundHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      marginTop: 22,
    },
    addLink: { color: c.accent, fontSize: 13, fontWeight: '600' },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    regRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    regIdx: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.textFaint, width: 20 },
    regName: { color: c.text, fontSize: 15, fontWeight: '600' },
    regMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    generateBtn: {
      height: 52,
      marginTop: 20,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    genHint: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 8 },
    // Formato de partido por cuadro (hoja de editar)
    fmtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
    fmtLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    fmtSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    // Bracket
    bracket: { paddingHorizontal: 22, paddingTop: 12, gap: 14 },
    roundCol: { width: 190 },
    roundLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      color: c.accent,
      textTransform: 'uppercase',
      fontWeight: '600',
      marginBottom: 10,
    },
    roundColInner: { flex: 1, justifyContent: 'space-around', gap: 10 },
    roundPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 34,
      marginBottom: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 8,
    },
    roundPillText: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1,
      color: c.accent,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    roundPillChevron: { color: c.textFaint, fontSize: 12, fontWeight: '700' },
    collapsedStrip: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    collapsedText: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      color: c.textFaint,
    },
    matchCard: {
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 10,
    },
    matchSide: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
    matchName: { flex: 1, color: c.textMuted, fontSize: 12, fontWeight: '500' },
    matchNameWin: { color: c.accent, fontWeight: '800' },
    matchNameBye: { color: c.textFaint, fontStyle: 'italic' },
    wDotSm: {
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    wDotSmOn: { backgroundColor: c.primary },
    wDotSmText: { color: '#0A0F0D', fontSize: 8, fontWeight: '900' },
    matchScore: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.text, minWidth: 16, textAlign: 'right' },
    matchDivider: { height: 1, backgroundColor: c.hair },
    bracketHint: { color: c.textFaint, fontSize: 12, paddingHorizontal: 22, marginTop: 12 },
    // Clasificación (liga)
    stHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderColor: c.hairStrong,
    },
    stRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderColor: c.hair,
    },
    stPos: {
      width: 22,
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      color: c.textFaint,
    },
    stName: { width: 150, color: c.text, fontSize: 13, fontWeight: '600', paddingRight: 8 },
    stCol: {
      width: 34,
      textAlign: 'center',
      fontFamily: Fonts.mono,
      fontSize: 12,
      color: c.textMuted,
      fontWeight: '600',
    },
    stColW: {
      width: 52,
      textAlign: 'center',
      fontFamily: Fonts.mono,
      fontSize: 12,
      color: c.textMuted,
      fontWeight: '600',
    },
    stPts: { color: c.accent, fontWeight: '800' },
    h2hMark: { color: c.accent, fontWeight: '900' },
    h2hLegend: {
      color: c.textFaint,
      fontSize: 11,
      fontStyle: 'italic',
      paddingHorizontal: 22,
      marginTop: 6,
    },
    rrMatch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rrName: { color: c.textMuted, fontSize: 13, fontWeight: '500', paddingVertical: 3 },
    rrWin: { color: c.accent, fontWeight: '800' },
    rrScore: {
      fontFamily: Fonts.mono,
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      paddingVertical: 1,
    },
    rrPending: { color: c.accent, fontSize: 12, fontWeight: '700' },
    // Tarjeta de partido pro (avatar + siembra + badge W + sets en columnas)
    matchRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    teamRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    teamName: { flex: 1, color: c.textMuted, fontSize: 14, fontWeight: '600' },
    teamNameWin: { color: c.text, fontWeight: '800' },
    seedSup: { color: c.textFaint, fontSize: 11, fontWeight: '600' },
    byeText: { color: c.textFaint, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    avatarInitials: { color: c.textMuted, fontWeight: '800' },
    scoreArea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    wCol: { justifyContent: 'space-between', gap: 8, height: 44 },
    wBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wBadgeOn: { backgroundColor: c.primary },
    wBadgeOff: { backgroundColor: 'transparent' },
    wBadgeText: { color: '#0A0F0D', fontSize: 11, fontWeight: '900' },
    setCol: { minWidth: 18, justifyContent: 'space-between', gap: 8, height: 44 },
    setScore: {
      fontFamily: Fonts.mono,
      fontSize: 16,
      fontWeight: '700',
      color: c.textFaint,
      textAlign: 'center',
      lineHeight: 18,
    },
    setScoreWin: { color: c.text, fontWeight: '800' },
    playChip: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    playChipText: { color: c.accent, fontSize: 18, fontWeight: '800', marginTop: -2 },
    // Sheets
    sheetEyebrow: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, letterSpacing: 2, fontWeight: '500' },
    sheetTitle: { color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 16,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputField: { color: c.text, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
    },
    scoreName: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
    scoreInput: {
      width: 64,
      height: 52,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreInputField: {
      color: c.text,
      fontSize: 22,
      fontWeight: '800',
      fontFamily: Fonts.mono,
      textAlign: 'center',
      width: '100%',
    },
    scoreHint: { color: c.textMuted, fontSize: 12, marginTop: 16, lineHeight: 18 },
    setTeam: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
    setVs: { color: c.textFaint, fontSize: 12, fontFamily: Fonts.mono, marginVertical: 2 },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    setRowLabel: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1, color: c.textMuted, fontWeight: '600' },
    setInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    setInput: {
      width: 52,
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      color: c.text,
      fontSize: 20,
      fontWeight: '800',
      fontFamily: Fonts.mono,
      textAlign: 'center',
    },
    setSep: { color: c.textFaint, fontSize: 18, fontWeight: '700' },
    liveResult: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginTop: 18 },
    saveBtn: { height: 52, borderRadius: Radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  });
