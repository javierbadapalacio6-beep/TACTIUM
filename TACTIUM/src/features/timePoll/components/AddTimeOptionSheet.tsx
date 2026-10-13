import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

import { BottomSheet } from '@components/ui/BottomSheet';
import { Button } from '@components/ui/Button';
import { TimeField, isoTimeToDate, dateToIsoTime } from '@components/ui/DateTimeField';
import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { optionDayLabel } from '@core/services/timePolls';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fecha de la jornada (o el primer día de su fin de semana): la tira de días arranca cerca. */
  matchDate: string | null;
  /** «2026-10-23 10:30» de las horas que ya tiene la encuesta (para no repetir). */
  existing: string[];
  sending: boolean;
  onSubmit: (date: string, time: string) => void;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 12 días desde 3 antes de la jornada (nunca antes de hoy). */
function dayStrip(matchDate: string | null): string[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let start = matchDate ? new Date(`${matchDate}T12:00:00`) : today;
  start = new Date(start.getTime() - 3 * 86_400_000);
  if (start < today) start = today;
  return Array.from({ length: 12 }, (_, i) => iso(new Date(start.getTime() + i * 86_400_000)));
}

/** «Añadir hora»: un día y una hora más para una encuesta que ya está en marcha. */
export const AddTimeOptionSheet: React.FC<Props> = ({ open, onClose, matchDate, existing, sending, onSubmit }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const days = useMemo(() => dayStrip(matchDate), [matchDate]);
  const [date, setDate] = useState<string>(days[0]);
  const [time, setTime] = useState('10:30');

  useEffect(() => {
    if (!open) return;
    setDate(matchDate && days.includes(matchDate) ? matchDate : days[0]);
    setTime('10:30');
  }, [open, matchDate, days]);

  const dupe = existing.includes(`${date} ${time}`);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={<Button label="Añadir a la encuesta" onPress={() => onSubmit(date, time)} disabled={dupe} isLoading={sending} />}
    >
      <Text style={styles.title}>Añadir una hora</Text>
      <Text style={styles.lede}>
        Se suma a las que ya hay. Los votos que ya tienes se mantienen y avisamos a quien ya ha votado.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((d) => {
          const on = d === date;
          const [dow, dm] = optionDayLabel(d).split(' ');
          return (
            <Pressable
              key={d}
              onPress={() => setDate(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayDow, on && styles.dayTextOn]}>{dow}</Text>
              <Text style={[styles.dayNum, on && styles.dayTextOn]}>{dm.split('/')[0]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ marginTop: 12 }}>
        <TimeField value={isoTimeToDate(time)} onChange={(d) => d && setTime(dateToIsoTime(d).slice(0, 5))} />
      </View>
      {dupe ? <Text style={styles.error}>Esa hora ya está en la encuesta.</Text> : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    lede: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 4, marginBottom: 14 },
    days: { gap: 6, paddingRight: 8 },
    day: {
      width: 48,
      paddingVertical: 8,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.background,
      alignItems: 'center',
      gap: 2,
    },
    dayOn: { backgroundColor: c.accent, borderColor: c.accent },
    dayDow: { color: c.textMuted, fontSize: 11.5 },
    dayNum: { color: c.text, fontSize: 16, fontWeight: '700', fontFamily: Fonts.mono },
    dayTextOn: { color: c.textInverse },
    error: { color: c.error, fontSize: 12.5, marginTop: 8 },
  });
