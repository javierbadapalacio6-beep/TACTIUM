import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconPin } from '@components/ui';
import { describeTandasShort, isValidTandas, pairsFor } from '@core/utils/tandas';

/**
 * Sede y tandas de la jornada, visibles en todas las pestañas (antes solo salían en la Previa y,
 * como al estar la alineación lista se abre en «Alineación», no se veían). El capitán toca la
 * tarjeta para editarlas a mano.
 */
export const JornadaSedeTandas: React.FC<{
  venue: string;
  tandas?: string | null;
  gender?: string | null;
  /** Hora de inicio «HH:MM»: con ella cada tanda sale con su hora. */
  time?: string | null;
  canEdit?: boolean;
  onEdit?: () => void;
}> = ({ venue, tandas, gender, time, canEdit, onEdit }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const valid = !!tandas && isValidTandas(tandas, pairsFor(gender));
  const short = valid ? describeTandasShort(tandas!, gender, time) : '';

  // Dos líneas y sin etiquetas: lugar + reparto, y debajo las horas (orientativas) de cada tanda.
  const body = (
    <View style={styles.card}>
      <View style={styles.top}>
        <IconPin size={13} color={c.textMuted} />
        <Text style={styles.venue} numberOfLines={1}>
          {venue}
        </Text>
        {tandas ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{tandas}</Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: canEdit ? c.warning : c.textFaint }]}>
            {canEdit ? 'Tandas · poner' : 'Sin tandas'}
          </Text>
        )}
      </View>
      {short ? (
        <Text style={styles.sub} numberOfLines={2}>
          {time ? 'Horas orientativas · ' : 'Orden · '}
          {short}
        </Text>
      ) : null}
    </View>
  );

  if (!canEdit || !onEdit) return body;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel="Editar sede y tandas"
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      {body}
    </Pressable>
  );
};

/** Selector de tandas (chips): «Sin tanda» + las composiciones válidas para el equipo. */
export const TandasChips: React.FC<{
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}> = ({ value, options, onChange }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const all: (string | null)[] = [null, ...options];
  return (
    <View style={styles.chips}>
      {all.map((opt) => {
        const sel = value === opt;
        return (
          <Pressable
            key={opt ?? 'none'}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            style={({ pressed }) => [styles.chip, sel && styles.chipActive, pressed && { opacity: 0.85 }]}
          >
            <Text style={[styles.chipLabel, sel && { color: c.accent }]}>{opt ?? 'Sin tanda'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 4,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    venue: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
    hint: { fontSize: 12.5, fontWeight: '500' },
    pill: {
      paddingHorizontal: 9,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent,
    },
    pillText: { fontFamily: Fonts.mono, fontSize: 12.5, fontWeight: '700', color: c.accent, letterSpacing: 0.4 },
    sub: { color: c.textMuted, fontSize: 12, paddingLeft: 21 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: c.accent10, borderColor: c.accent },
    chipLabel: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '600', letterSpacing: 0.4, color: c.textMuted },
  });
