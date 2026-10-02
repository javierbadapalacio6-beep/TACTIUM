import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';

export type JornadaTab = 'previa' | 'alineacion' | 'resultado' | 'fotos';

export const JORNADA_TABS: { key: JornadaTab; label: string }[] = [
  { key: 'previa', label: 'Previa' },
  { key: 'alineacion', label: 'Alineación' },
  { key: 'resultado', label: 'Resultado' },
  { key: 'fotos', label: 'Fotos' },
];

/**
 * Pestaña con la que se abre la jornada según su fase:
 *  · jugada / en juego / acta cerrada → Resultado
 *  · con alineación y sin jugar       → Alineación
 *  · sin alineación y sin jugar       → Previa
 */
export function defaultJornadaTab(s: {
  closed: boolean;
  matchStarted: boolean;
  lineupReady: boolean;
}): JornadaTab {
  if (s.closed || s.matchStarted) return 'resultado';
  if (s.lineupReady) return 'alineacion';
  return 'previa';
}

export const JornadaPhaseTabs: React.FC<{
  value: JornadaTab;
  onChange: (t: JornadaTab) => void;
}> = ({ value, onChange }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {JORNADA_TABS.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && !active && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      marginTop: 14,
      marginBottom: 16,
      padding: 3,
      gap: 3,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tab: {
      flex: 1,
      height: 34,
      borderRadius: Radius.md - 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabActive: {
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 0.4,
      color: c.textMuted,
      fontWeight: '500',
    },
    labelActive: { color: c.accent, fontWeight: '600' },
  });
