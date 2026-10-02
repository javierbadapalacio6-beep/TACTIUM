import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';

import { BottomSheet } from '@components/ui/BottomSheet';
import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { MAYBE_REASONS, type MaybeReason } from '@core/services/availability';

import { withAlpha } from './statusColors';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (reason: MaybeReason | null, note: string | null) => void;
  /** «J07 · vie 10:30»: cuándo cierra la duda, para decirlo claro. */
  deadlineLabel?: string | null;
  /** Encabezado: «Jornada 7». */
  title?: string;
  initialReason?: MaybeReason | null;
  initialNote?: string | null;
  /** Cuando el capitán marca por otro: «¿Qué le frena a Diego?». */
  forName?: string | null;
}

/** Hoja de «Duda»: motivo rápido + nota opcional. */
export const MaybeSheet: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  deadlineLabel,
  title,
  initialReason = null,
  initialNote = null,
  forName,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [reason, setReason] = useState<MaybeReason | null>(initialReason);
  const [note, setNote] = useState(initialNote ?? '');

  useEffect(() => {
    if (open) {
      setReason(initialReason);
      setNote(initialNote ?? '');
    }
  }, [open, initialReason, initialNote]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          onPress={() => onSave(reason, note.trim() || null)}
          style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.saveLabel}>Guardar duda</Text>
        </Pressable>
      }
    >
      <Text style={styles.eyebrow}>{(title ?? 'Jornada').toUpperCase()} · DUDA</Text>
      <Text style={styles.heading}>{forName ? `¿Qué le frena a ${forName}?` : '¿Qué te frena?'}</Text>
      <Text style={styles.sub}>
        {forName ? 'Queda anotado en la convocatoria.' : 'Tu capitán lo verá para organizarse. Es opcional.'}
      </Text>

      <View style={styles.chips}>
        {MAYBE_REASONS.map((r) => {
          const on = reason === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setReason(on ? null : r.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && { color: c.warning }]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Añade una nota… «salgo de guardia a las 10»"
        placeholderTextColor={c.textFaint}
        maxLength={140}
        style={styles.input}
      />

      {deadlineLabel ? (
        <Text style={styles.hint}>
          Te volveremos a preguntar en 12 horas. Si no decides antes del {deadlineLabel}, contarás como «No puedo».
        </Text>
      ) : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.4,
      color: c.warning,
      marginBottom: 6,
    },
    heading: { color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
    sub: { color: c.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    chipOn: { borderColor: c.warning, backgroundColor: withAlpha(c.warning, 0.12) },
    chipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    input: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 14,
    },
    hint: { color: c.textFaint, fontSize: 12, marginTop: 14, lineHeight: 17 },
    save: {
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
  });
