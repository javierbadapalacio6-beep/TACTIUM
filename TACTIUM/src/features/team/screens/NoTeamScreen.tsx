import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { NoTeamState } from '@features/team/components/NoTeamState';

/** Pestaña Equipo del jugador SUELTO: estado vacío con crear / unirse. */
export const NoTeamScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>EQUIPO</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 + 12 + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <NoTeamState />
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 22, paddingBottom: 4 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2.4,
      fontWeight: '500',
    },
  });
