import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';

/** Siglas de un equipo: «Smash A» → «SMA», «Laredo Pádel B» → «LAR». */
export function teamInitials(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  return (clean.slice(0, 3) || 'EQ').toUpperCase();
}

/** Escudo del equipo: la imagen si la hay; si no, sus siglas en una tesela. */
export const TeamCrest: React.FC<{
  name: string;
  logo?: string | null;
  size?: number;
}> = ({ name, logo, size = 44 }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const r = Math.round(size * 0.28);
  if (logo) {
    return (
      <Image
        source={{ uri: logo }}
        style={[s.box, { width: size, height: size, borderRadius: r }]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[s.box, { width: size, height: size, borderRadius: r }]}>
      <Text style={[s.text, { fontSize: Math.max(10, Math.round(size * 0.28)) }]}>
        {teamInitials(name)}
      </Text>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    text: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });
