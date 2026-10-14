import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { TimeField, isoTimeToDate, dateToIsoTime } from '@components/ui/DateTimeField';
import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  DAY_KIND_LABEL,
  dayKindOf,
  windowForDay,
  type DayKind,
  type PlayWindows,
} from '@core/services/tournaments';

const KINDS: DayKind[] = ['weekday', 'weekend', 'holiday'];
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** ¿Todas las franjas tienen el fin después del inicio? */
export const playWindowsValid = (w: PlayWindows): boolean =>
  KINDS.every((k) => toMin(w[k].to) > toMin(w[k].from));

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

/**
 * Franjas de juego del torneo: a qué horas se juega entre semana, en fin de semana y en festivos. El horario
 * automático, la tabla del club y la rejilla de inscripción solo usan estas horas (antes salían franjas desde
 * primera hora aunque nadie fuese a jugar). Los días del torneo se enseñan con su franja y se pueden marcar
 * como festivo con un toque.
 */
export const PlayWindowsEditor: React.FC<{
  windows: PlayWindows;
  onWindows: (next: PlayWindows) => void;
  /** Días del torneo (ISO). Vacío si aún no hay fechas. */
  days: string[];
  holidays: string[];
  onHolidays: (next: string[]) => void;
}> = ({ windows, onWindows, days, holidays, onHolidays }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const valid = playWindowsValid(windows);

  const setTime = (kind: DayKind, key: 'from' | 'to', d: Date | null) => {
    if (!d) return;
    onWindows({ ...windows, [kind]: { ...windows[kind], [key]: dateToIsoTime(d).slice(0, 5) } });
  };
  const toggleHoliday = (iso: string) =>
    onHolidays(holidays.includes(iso) ? holidays.filter((x) => x !== iso) : [...holidays, iso].sort());

  return (
    <View>
      <Text style={s.label}>FRANJAS DE JUEGO</Text>
      <Text style={s.hint}>
        A qué horas se juega cada tipo de día. El horario y la inscripción solo ofrecen estas horas.
      </Text>
      {KINDS.map((k) => (
        <View key={k} style={s.card}>
          <Text style={s.kind}>{DAY_KIND_LABEL[k]}</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>Desde</Text>
              <TimeField value={isoTimeToDate(`${windows[k].from}:00`)} onChange={(d) => setTime(k, 'from', d)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>Hasta</Text>
              <TimeField value={isoTimeToDate(`${windows[k].to}:00`)} onChange={(d) => setTime(k, 'to', d)} />
            </View>
          </View>
          {k === 'holiday' ? (
            <Text style={s.note}>Solo se usa en los días que marques como festivo.</Text>
          ) : null}
        </View>
      ))}
      {!valid ? <Text style={s.error}>En cada franja, la hora de fin tiene que ser posterior a la de inicio.</Text> : null}

      {days.length > 0 ? (
        <>
          <Text style={[s.label, { marginTop: 16 }]}>DÍAS DEL TORNEO</Text>
          <Text style={s.hint}>Toca un día para marcarlo como festivo (usa la franja de festivos).</Text>
          <View style={s.days}>
            {days.map((iso) => {
              const w = windowForDay({ play_windows: windows, holidays }, iso);
              const holiday = dayKindOf(iso, holidays) === 'holiday';
              return (
                <Pressable
                  key={iso}
                  onPress={() => toggleHoliday(iso)}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayLabel(iso)}: ${w.from} a ${w.to}${holiday ? ', festivo' : ''}`}
                  style={[s.day, holiday && s.dayHoliday]}
                >
                  <Text style={[s.dayName, holiday && { color: c.textInverse }]}>
                    {dayLabel(iso)}
                    {holiday ? ' · festivo' : ''}
                  </Text>
                  <Text style={[s.dayWin, holiday && { color: c.textInverse }]}>
                    {w.from}–{w.to}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={s.note}>
          Cuando pongas las fechas del torneo verás aquí cada día con su franja.
        </Text>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    label: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '600',
      marginBottom: 6,
    },
    hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
    card: {
      padding: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      marginBottom: 8,
      gap: 8,
    },
    kind: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    sub: { color: c.textMuted, fontSize: 12, marginBottom: 4 },
    row: { flexDirection: 'row', gap: 10 },
    note: { color: c.textFaint, fontSize: 12.5, lineHeight: 17 },
    error: { color: c.error, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
    days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    day: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.background,
    },
    dayHoliday: { backgroundColor: c.accent, borderColor: c.accent },
    dayName: { color: c.text, fontSize: 13, fontWeight: '700' },
    dayWin: { color: c.textMuted, fontSize: 12, fontFamily: Fonts.mono, marginTop: 2 },
  });
