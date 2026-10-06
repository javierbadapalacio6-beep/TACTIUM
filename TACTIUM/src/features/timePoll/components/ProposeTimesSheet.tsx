import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';

import { BottomSheet } from '@components/ui/BottomSheet';
import { Button } from '@components/ui/Button';
import { TimeField, isoTimeToDate, dateToIsoTime } from '@components/ui/DateTimeField';
import { Toggle } from '@components/ui/Toggle';
import { IconPlus, IconX } from '@components/ui/Icon';
import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { optionDayLabel, suggestOptions } from '@core/services/timePolls';

interface Draft {
  date: string;
  time: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** «J08 vs Club Rival» */
  title: string;
  matchDate: string | null;
  matchTime: string | null;
  slots: string[];
  sending: boolean;
  onSubmit: (input: { options: Draft[]; message: string | null; deadline: Date | null }) => void;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Días que se pueden elegir: desde hoy (o 3 días antes de la jornada) 12 días. */
function dayStrip(matchDate: string | null): string[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let start = matchDate ? new Date(`${matchDate}T12:00:00`) : today;
  start = new Date(start.getTime() - 3 * 86_400_000);
  if (start < today) start = today;
  return Array.from({ length: 12 }, (_, i) => iso(new Date(start.getTime() + i * 86_400_000)));
}

/**
 * «Proponer horas»: de 2 a 4 opciones de día y hora, mensaje y fecha límite
 * opcionales. Arranca con sugerencias (la fecha de la jornada y las franjas
 * favoritas del equipo).
 *
 * Patrón: «Create a poll» de LinkedIn (filas de opción + «Añadir opción» +
 * duración) con la tira de días de «Select date and time» de Fresha.
 */
export const ProposeTimesSheet: React.FC<Props> = ({
  open,
  onClose,
  title,
  matchDate,
  matchTime,
  slots,
  sending,
  onSubmit,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const days = useMemo(() => dayStrip(matchDate), [matchDate]);
  const [options, setOptions] = useState<Draft[]>([]);
  const [message, setMessage] = useState('');
  const [withDeadline, setWithDeadline] = useState(false);
  const [deadlineDay, setDeadlineDay] = useState<string | null>(null);
  const [deadlineTime, setDeadlineTime] = useState('21:00');

  useEffect(() => {
    if (!open) return;
    const sug = suggestOptions(matchDate, matchTime, slots).filter((o) => days.includes(o.date));
    while (sug.length < 2) sug.push({ date: matchDate && days.includes(matchDate) ? matchDate : days[0], time: sug.length ? '18:00' : '10:00' });
    setOptions(sug.slice(0, 4));
    setMessage('');
    setWithDeadline(false);
    // Fecha límite por defecto: dos días antes de la jornada (o mañana).
    const md = matchDate ? new Date(`${matchDate}T12:00:00`) : null;
    const tomorrow = new Date(Date.now() + 86_400_000);
    const def = md && md.getTime() - 2 * 86_400_000 > Date.now() ? new Date(md.getTime() - 2 * 86_400_000) : tomorrow;
    setDeadlineDay(iso(def));
    setDeadlineTime('21:00');
  }, [open, matchDate, matchTime, slots, days]);

  const keys = options.map((o) => `${o.date} ${o.time}`);
  const dupes = keys.length !== new Set(keys).size;
  const valid = options.length >= 2 && options.length <= 4 && !dupes;

  const deadline =
    withDeadline && deadlineDay ? new Date(`${deadlineDay}T${deadlineTime}:00`) : null;
  const deadlinePast = !!deadline && deadline.getTime() <= Date.now();

  const update = (i: number, patch: Partial<Draft>) =>
    setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      scrollable
      footer={
        <Button
          label="Enviar al equipo"
          onPress={() =>
            onSubmit({
              options,
              message: message.trim() || null,
              deadline,
            })
          }
          disabled={!valid || deadlinePast}
          isLoading={sending}
        />
      }
    >
      <Text style={styles.title}>Proponer horas</Text>
      <Text style={styles.lede}>
        {title}. Tu equipo marca las que le van y tú fijas la que más convenga.
      </Text>

      {options.map((o, i) => (
        <View key={i} style={styles.option}>
          <View style={styles.optionHead}>
            <Text style={styles.optionLabel}>Opción {i + 1}</Text>
            <Text style={styles.optionSummary}>
              {optionDayLabel(o.date)} · {o.time}
            </Text>
            {options.length > 2 ? (
              <Pressable
                onPress={() => setOptions((os) => os.filter((_, j) => j !== i))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Quitar la opción ${i + 1}`}
              >
                <IconX size={16} color={c.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {days.map((d) => {
              const on = d === o.date;
              const [dow, dm] = optionDayLabel(d).split(' ');
              return (
                <Pressable
                  key={d}
                  onPress={() => update(i, { date: d })}
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
          <TimeField
            value={isoTimeToDate(o.time)}
            onChange={(d) => d && update(i, { time: dateToIsoTime(d).slice(0, 5) })}
          />
        </View>
      ))}

      {dupes ? <Text style={styles.error}>Hay dos opciones iguales.</Text> : null}

      {options.length < 4 ? (
        <Pressable
          onPress={() =>
            setOptions((os) => [...os, { date: os[os.length - 1]?.date ?? days[0], time: '18:00' }])
          }
          style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <IconPlus size={15} color={c.accent} />
          <Text style={styles.addLabel}>Añadir opción</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Mensaje (opcional)</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        maxLength={280}
        multiline
        placeholder="«El domingo hay pistas libres desde las 10»"
        placeholderTextColor={c.textFaint}
        style={styles.input}
      />

      <View style={styles.deadlineRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionInline}>Fecha límite para votar</Text>
          <Text style={styles.hint}>Después nadie puede cambiar su voto.</Text>
        </View>
        <Toggle value={withDeadline} onChange={setWithDeadline} accessibilityLabel="Poner fecha límite" />
      </View>
      {withDeadline ? (
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {dayStrip(null).slice(0, 10).map((d) => {
              const on = d === deadlineDay;
              const [dow, dm] = optionDayLabel(d).split(' ');
              return (
                <Pressable
                  key={d}
                  onPress={() => setDeadlineDay(d)}
                  style={[styles.day, on && styles.dayOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.dayDow, on && styles.dayTextOn]}>{dow}</Text>
                  <Text style={[styles.dayNum, on && styles.dayTextOn]}>{dm.split('/')[0]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <TimeField
            value={isoTimeToDate(deadlineTime)}
            onChange={(d) => d && setDeadlineTime(dateToIsoTime(d).slice(0, 5))}
          />
          {deadlinePast ? <Text style={styles.error}>La fecha límite ya ha pasado.</Text> : null}
        </View>
      ) : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    lede: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 4, marginBottom: 12 },
    option: {
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      padding: 12,
      gap: 10,
      marginBottom: 10,
    },
    optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
    optionSummary: { flex: 1, color: c.textMuted, fontSize: 13, fontFamily: Fonts.mono },
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
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.accent40,
      marginBottom: 6,
    },
    addLabel: { color: c.accent, fontSize: 14, fontWeight: '700' },
    section: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 6 },
    sectionInline: { color: c.text, fontSize: 14, fontWeight: '700' },
    hint: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    input: {
      minHeight: 64,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      color: c.text,
      fontSize: 14,
      padding: 12,
      textAlignVertical: 'top',
    },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 10 },
    error: { color: c.error, fontSize: 12.5 },
  });
