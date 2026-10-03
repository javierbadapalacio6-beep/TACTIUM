import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, type TextStyle } from 'react-native';

import { useColors, type Palette } from '@core/theme';

// Las mismas URLs que enlazan el paywall y Ajustes.
export const TERMS_URL = 'https://tactium.io/legal/terminos';
export const PRIVACY_URL = 'https://tactium.io/legal/privacidad';

const open = (url: string) => {
  Linking.openURL(url).catch(() => {
    /* sin navegador: no hay nada más que hacer */
  });
};

/**
 * Aviso legal con enlaces de verdad: «{prefijo} los Términos y la Privacidad».
 * Texto anidado para que los enlaces fluyan en la misma línea y partan bien en
 * pantallas estrechas.
 */
export const LegalNote: React.FC<{
  prefix?: string;
  style?: TextStyle;
}> = ({ prefix = 'Al continuar aceptas', style }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Text style={[styles.legal, style]}>
      {prefix} los{' '}
      <Text
        style={styles.link}
        onPress={() => open(TERMS_URL)}
        accessibilityRole="link"
        suppressHighlighting
      >
        Términos
      </Text>{' '}
      y la{' '}
      <Text
        style={styles.link}
        onPress={() => open(PRIVACY_URL)}
        accessibilityRole="link"
        suppressHighlighting
      >
        Privacidad
      </Text>
    </Text>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    legal: {
      textAlign: 'center',
      color: c.textFaint,
      fontSize: 11.5,
      lineHeight: 16,
    },
    link: {
      color: c.textMuted,
      textDecorationLine: 'underline',
    },
  });
