import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconPin } from '@components/ui';
import { describeTandas, isValidTandas, pairsFor } from '@core/utils/tandas';

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
  const lines = tandas && isValidTandas(tandas, pairsFor(gender)) ? describeTandas(tandas, gender, time) : [];

  const body = (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>SEDE</Text>
        <View style={styles.valueWrap}>
          <IconPin size={12} color={c.textMuted} />
          <Text style={styles.value} numberOfLines={2}>
            {venue}
          </Text>
        </View>
      </View>
      <View style={[styles.row, { alignItems: 'flex-start', borderBottomWidth: 0 }]}>
        <Text style={[styles.label, { marginTop: 4 }]}>TANDAS</Text>
        {tandas ? (
          <View style={styles.tandasBox}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{tandas}</Text>
            </View>
            {lines.map((l) => (
              <Text key={l} style={styles.tandaLine}>
                {l}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={[styles.value, { color: canEdit ? c.warning : c.textFaint }]}>
            {canEdit ? 'Sin definir · toca para ponerlas' : 'Sin definir'}
          </Text>
        )}
      </View>
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
      paddingHorizontal: 16,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    label: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.textFaint },
    valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    value: { color: c.text, fontSize: 13, fontWeight: '500', textAlign: 'right', flexShrink: 1 },
    tandasBox: { flexShrink: 1, alignItems: 'flex-end', gap: 4 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent,
    },
    pillText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.accent, letterSpacing: 0.5 },
    tandaLine: { color: c.textMuted, fontSize: 12.5, textAlign: 'right' },
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
