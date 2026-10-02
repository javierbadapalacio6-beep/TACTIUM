import React, { useMemo } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconTrash } from '@components/ui';

/** Menú «⋯» de la barra superior de la jornada (acciones secundarias). */
export const JornadaMoreSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
}> = ({ open, onClose, onDelete }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <BottomSheet open={open} onClose={onClose} scrollable={false}>
      <Text style={styles.eyebrow}>JORNADA · MÁS OPCIONES</Text>
      <Pressable
        onPress={() => {
          onClose();
          // Deja cerrar el sheet antes de abrir la confirmación (iOS no
          // presenta un Alert encima de un Modal que se está cerrando).
          setTimeout(onDelete, 250);
        }}
        accessibilityRole="button"
        accessibilityLabel="Eliminar jornada"
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      >
        <IconTrash size={16} color={c.error} />
        <Text style={styles.deleteLabel}>Eliminar jornada</Text>
      </Pressable>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.cancelLabel}>Cancelar</Text>
      </Pressable>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      color: c.textFaint,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 50,
      paddingHorizontal: 16,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: withAlpha(c.error, 0.35),
      backgroundColor: withAlpha(c.error, 0.08),
    },
    deleteLabel: { color: c.error, fontSize: 14, fontWeight: '600' },
    cancel: {
      height: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    cancelLabel: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
  });
