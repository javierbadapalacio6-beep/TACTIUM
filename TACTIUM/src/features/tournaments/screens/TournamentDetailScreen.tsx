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
  generateAmericano,
  generateMexicanoRound,
  computeStandings,
  computeIndividualStandings,
  setSocialResult,
  autoScheduleTournament,
  updateTournamentSchedule,
  clearSchedule,
  matchScheduleConflict,
  getPhaseDays,
  setPhaseDay,
  isSocialFormat,
  posBracket,
  BRACKET_LABEL,
  groupName,
  setMatchResult,
  formatConfig,
  type Tournament,
  type TournamentRegistration,
  type TournamentMatch,
  type StandingRow,
  type PlayerStanding,
} from '@core/services/tournaments';

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
  round_robin: 'Liga · todos contra todos',
  groups_ko: 'Grupos + eliminatorias',
  americano: 'Americano',
  mexicano: 'Mexicano',
};

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
}> = ({ info, win, bye, styles, c }) => {
  if (bye) {
    return (
      <View style={styles.teamRow}>
        <View style={[styles.avatarFallback, { width: 26, height: 26, borderRadius: 13, opacity: 0.5 }]} />
        <Text style={styles.byeText}>BYE</Text>
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
  const homeBye = !social && !m.home_reg;
  const awayBye = !social && !m.away_reg;
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
            🕐 {fmtTime(m.scheduled_at)}
            {m.court ? ` · ${m.court}` : ''}
          </Text>
        ) : null}
        <MatchTeam info={homeInfo} win={homeWin} bye={homeBye} styles={styles} c={c} />
        <MatchTeam info={awayInfo} win={awayWin} bye={awayBye} styles={styles} c={c} />
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
      ) : homeBye || awayBye || readOnly ? null : (
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
              ...(r.availability ?? []),
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
  const rows: { label: string; value: string }[] = [
    { label: 'Formato', value: FORMAT_LABEL[t.format] ?? t.format },
    ...(!isSocialFormat(t.format)
      ? [{ label: 'Partidos', value: formatConfig(t.match_format).label }]
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
    { label: 'Estado', value: STATUS_LABEL[t.status] ?? t.status },
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

      {t.prizes ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 10 }]}>
            🏆 PREMIOS
          </Text>
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockText}>{t.prizes}</Text>
          </View>
        </>
      ) : null}

      {t.extra_info ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 10 }]}>
            ℹ️ INFORMACIÓN ADICIONAL
          </Text>
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockText}>{t.extra_info}</Text>
          </View>
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
  regs: TournamentRegistration[];
  info: (id: string | null) => RegInfo;
  onEdit: (m: TournamentMatch) => void;
  onConfigure: () => void;
  onGenerate: () => void;
  onClear: () => void;
  generating: boolean;
  readOnly?: boolean;
  phaseDays?: Record<string, string>;
  onSetPhaseDay?: (bracket: string, round: number, iso: string) => void;
  styles: Styles;
  c: Palette;
}> = ({
  tournament,
  matches,
  regs,
  info,
  onEdit,
  onConfigure,
  onGenerate,
  onClear,
  generating,
  readOnly,
  phaseDays = {},
  onSetPhaseDay,
  styles,
  c,
}) => {
  // Días del torneo (inicio → fin).
  const days = useMemo(() => {
    if (!tournament.starts_on) return [] as { iso: string; label: string }[];
    const parse = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const start = parse(tournament.starts_on);
    const end = tournament.ends_on ? parse(tournament.ends_on) : start;
    const ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const out: { iso: string; label: string }[] = [];
    const dd = new Date(start);
    let guard = 0;
    while (dd.getTime() <= end.getTime() && guard < 31) {
      const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
      out.push({ iso, label: `${ABBR[dd.getDay()]} ${dd.getDate()}` });
      dd.setDate(dd.getDate() + 1);
      guard++;
    }
    return out;
  }, [tournament.starts_on, tournament.ends_on]);
  const multiDay = days.length > 1;

  // Fases del torneo (para asignar día a cada una).
  const phases = useMemo(() => {
    const real = matches.filter((m) => m.status !== 'bye');
    const out: { bracket: string; round: number; label: string }[] = [];
    const brackets = Array.from(new Set(real.map((m) => m.bracket)));
    const SINGLE: Record<string, string> = {
      grp: 'Fase de grupos',
      rr: 'Liga',
      amer: 'Americano',
      mex: 'Mexicano',
    };
    for (const b of brackets) {
      if (SINGLE[b]) {
        out.push({ bracket: b, round: 0, label: SINGLE[b] });
      } else {
        const bm = real.filter((m) => m.bracket === b);
        const total = bm.reduce((mx, m) => Math.max(mx, m.round), 0);
        const rounds = Array.from(new Set(bm.map((m) => m.round))).sort((a, z) => a - z);
        const prefix = b === 'main' ? '' : `${BRACKET_LABEL[b] ?? b} · `;
        for (const r of rounds) out.push({ bracket: b, round: r, label: `${prefix}${roundLabel(r, total)}` });
      }
    }
    return out;
  }, [matches]);

  const dayLabelOf = (iso: string | null) => days.find((x) => x.iso === iso)?.label ?? null;
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
  // Agrupa por día + hora.
  const groups: { time: string; items: TournamentMatch[] }[] = [];
  for (const m of scheduled) {
    const iso = (m.scheduled_at as string).slice(0, 10);
    const dl = multiDay ? dayLabelOf(iso) : null;
    const time = `${dl ? `${dl} · ` : ''}${fmtTime(m.scheduled_at) ?? '—'}`;
    const g = groups.find((x) => x.time === time);
    if (g) g.items.push(m);
    else groups.push({ time, items: [m] });
  }
  // Partidos con jugadores conocidos que quedaron SIN hora (no cabían en un
  // hueco donde todos pudieran).
  const unplaced = matches.filter(
    (m) =>
      m.status !== 'bye' &&
      m.status !== 'finished' &&
      !!m.home_reg &&
      !!m.away_reg &&
      !m.scheduled_at,
  ).length;

  return (
    <View style={{ paddingHorizontal: 22 }}>
      {readOnly ? null : (
        <>
          <View style={styles.schedConfigCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.schedConfigLabel}>CONFIGURACIÓN</Text>
              <Text style={styles.schedConfigValue}>
                {tournament.courts} {tournament.courts === 1 ? 'pista' : 'pistas'} · desde{' '}
                {tournament.start_time} · {tournament.slot_minutes} min · descanso{' '}
                {tournament.rest_minutes ?? 60}
                {!tournament.starts_on ? ' · sin fecha' : ''}
              </Text>
            </View>
            <Pressable onPress={onConfigure} hitSlop={8}>
              <Text style={styles.addLink}>Configurar</Text>
            </Pressable>
          </View>

          {multiDay && phases.length > 0 && onSetPhaseDay ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionLabel}>DÍA DE CADA FASE</Text>
              <Text style={[styles.genHint, { textAlign: 'left', marginTop: 4, marginBottom: 8 }]}>
                Asigna cada fase a un día del torneo. Una fase sin día se juega el
                día de inicio.
              </Text>
              <View style={{ gap: 10 }}>
                {phases.map((ph) => {
                  const sel = phaseDays[`${ph.bracket}:${ph.round}`] ?? null;
                  return (
                    <View key={`${ph.bracket}:${ph.round}`} style={styles.phaseRow}>
                      <Text style={styles.phaseLabel} numberOfLines={1}>{ph.label}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {days.map((day) => {
                          const on = sel === day.iso;
                          return (
                            <Pressable
                              key={day.iso}
                              onPress={() => onSetPhaseDay(ph.bracket, ph.round, day.iso)}
                              style={[styles.phaseDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                            >
                              <Text style={[styles.phaseDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                                {day.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
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
        </>
      )}

      {!readOnly && unplaced > 0 ? (
        <View style={styles.conflictBanner}>
          <Text style={styles.conflictBannerText}>
            ⚠️ {unplaced} {unplaced === 1 ? 'partido' : 'partidos'} sin hueco donde todos
            puedan jugar. Añade pistas, amplía horas o mueve alguna fase a otro día y
            vuelve a generar.
          </Text>
        </View>
      ) : null}

      {scheduled.length === 0 ? (
        <Text style={[styles.emptyText, { marginTop: 14 }]}>
          {readOnly
            ? 'El horario aún no está publicado. Cuando el club lo genere verás aquí tu hora y pista.'
            : 'Aún no hay horario. Genera el cuadro/los grupos y pulsa “Generar horario”: repartiremos los partidos por pista y hora respetando la disponibilidad de cada jugador.'}
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {groups.map((g) => (
            <View key={g.time} style={{ marginTop: 16 }}>
              <Text style={styles.schedTime}>{g.time}</Text>
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

          {readOnly ? null : (
            <Pressable onPress={onClear} hitSlop={8} style={{ marginTop: 22 }}>
              <Text style={[styles.addLink, { color: c.error, textAlign: 'center' }]}>
                Borrar horario
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
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
      setRest(String(tournament.rest_minutes ?? 60));
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

      <Text style={styles.label}>DESCANSO ENTRE PARTIDOS DE UNA PAREJA</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { v: '0', label: 'Sin mín.' },
          { v: '30', label: '30 min' },
          { v: '60', label: '60 min' },
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

          <Text style={[styles.label, { marginTop: 14 }]}>DISPONIBILIDAD</Text>
          {reg.availability?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {reg.availability.map((a, i) => (
                <View key={i} style={styles.availChip}>
                  <Text style={styles.availChipText}>{a}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoBlockText}>No indicó disponibilidad.</Text>
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
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  styles: Styles;
  c: Palette;
}> = ({ open, tournament, onClose, onSaved, onDeleted, styles, c }) => {
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState<Date | null>(null);
  const [endsOn, setEndsOn] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [maxPairs, setMaxPairs] = useState('');
  const [prizes, setPrizes] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && tournament) {
      setName(tournament.name);
      setStartsOn(isoDateToDate(tournament.starts_on));
      setEndsOn(isoDateToDate(tournament.ends_on));
      setLocation(tournament.location ?? '');
      setMaxPairs(tournament.max_pairs ? String(tournament.max_pairs) : '');
      setPrizes(tournament.prizes ?? '');
      setExtraInfo(tournament.extra_info ?? '');
      setCoverUrl(tournament.cover_url ?? null);
      setCoverUri(null);
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
      await updateTournament(tournament.id, {
        name,
        startsOn: startsOn ? dateToIsoDate(startsOn) : null,
        endsOn: endsOn ? dateToIsoDate(endsOn) : null,
        location,
        maxPairs: maxPairs ? parseInt(maxPairs, 10) : null,
        prizes,
        extraInfo,
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

      <Text style={styles.label}>LUGAR</Text>
      <View style={styles.input}>
        <TextInput value={location} onChangeText={setLocation} placeholder="Club · ciudad" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={80} />
      </View>

      <Text style={styles.label}>PLAZAS</Text>
      <View style={styles.input}>
        <TextInput value={maxPairs} onChangeText={(v) => setMaxPairs(v.replace(/[^0-9]/g, ''))} placeholder="16" placeholderTextColor={c.textFaint} style={styles.inputField} keyboardType="number-pad" maxLength={3} />
      </View>

      <Text style={styles.label}>PREMIOS</Text>
      <View style={[styles.input, { minHeight: 84, paddingVertical: 12 }]}>
        <TextInput value={prizes} onChangeText={setPrizes} placeholder="1º: trofeo + material…" placeholderTextColor={c.textFaint} style={[styles.inputField, { minHeight: 60, textAlignVertical: 'top' }]} multiline maxLength={400} />
      </View>

      <Text style={styles.label}>INFORMACIÓN ADICIONAL</Text>
      <View style={[styles.input, { minHeight: 84, paddingVertical: 12 }]}>
        <TextInput value={extraInfo} onChangeText={setExtraInfo} placeholder="BBQ, música, sorteos…" placeholderTextColor={c.textFaint} style={[styles.inputField, { minHeight: 60, textAlignVertical: 'top' }]} multiline maxLength={600} />
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
  const [phaseDays, setPhaseDays] = useState<Record<string, string>>({});
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
    // KO (o cuadro ORO en grupos): ganador de la final del cuadro principal.
    const mainBracket = isGroups ? 'gold' : 'main';
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
    if (isSocial) {
      Alert.alert(
        isMexicano ? 'Generar 1ª ronda' : 'Generar americano',
        isMexicano
          ? `Se creará la 1ª ronda del mexicano con ${regsCat.length} jugadores (siembra por puntos). Las siguientes rondas se generan por el ranking tras cada resultado.`
          : `Se crearán todas las rondas del americano con ${regsCat.length} jugadores (compañeros rotativos). No podrás añadir más jugadores.`,
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
        `¿De cuántas parejas por grupo? Se repartirán las ${regsCat.length} parejas por siembra.`,
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
      'Se crearán los cuadros (oro, plata, bronce…) con los clasificados de cada grupo por su posición.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
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
    // Alterna: si ya está en ese día, lo quita.
    const key = `${bracket}:${round}`;
    const next = phaseDays[key] === iso ? null : iso;
    setPhaseDays((prev) => {
      const copy = { ...prev };
      if (next) copy[key] = next;
      else delete copy[key];
      return copy;
    });
    try {
      await setPhaseDay(t.id, bracket, round, next);
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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.headMeta}>
            {t?.status ? (
              <View
                style={[
                  styles.statusPill,
                  t.status === 'finished' && styles.statusPillDone,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    t.status === 'finished' && styles.statusPillTextDone,
                  ]}
                >
                  {STATUS_LABEL[t.status] ?? t.status.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {formatStartsOn(t?.starts_on ?? null) ? (
              <Text style={styles.headDate}>{formatStartsOn(t?.starts_on ?? null)}</Text>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {t?.name ?? ''}
          </Text>
        </View>
        {t ? (
          <Pressable
            onPress={() => setEditOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <IconPencil size={17} color={c.text} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Portada del torneo */}
          {t?.cover_url ? (
            <View style={styles.coverBanner}>
              <Image source={{ uri: t.cover_url }} style={styles.coverBannerImg} />
              <LinearGradient
                colors={['transparent', c.background]}
                style={styles.coverBannerFade}
              />
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
              matches={matches}
              regs={regs}
              info={regInfo}
              phaseDays={phaseDays}
              onSetPhaseDay={onSetPhaseDay}
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
            <View>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
                CUADRO
              </Text>
              <BracketView
                matches={matchesCat.filter((m) => m.bracket === 'main')}
                regName={regName}
                onEdit={setEditMatch}
                collapsed={collapsed}
                toggleRound={toggleRound}
              />
              <Text style={styles.bracketHint}>
                Toca una ronda para ocultarla/mostrarla. Toca un partido para meter
                el resultado.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

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
        matchFormat={t?.match_format ?? 'bo3_stb'}
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
}) => (
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
          <Text style={styles.stName} numberOfLines={1}>{s.name}</Text>
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
);

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
  const koBrackets = Array.from(new Set(koMatches.map((m) => m.bracket)));
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
                  {BRACKET_LABEL[b] ?? b}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 12 }]}>
        {(BRACKET_LABEL[activeBracket ?? ''] ?? 'CUADRO').toUpperCase()}
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
      fontSize: 15,
      fontWeight: '800',
      color: c.text,
      marginBottom: 8,
    },
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
