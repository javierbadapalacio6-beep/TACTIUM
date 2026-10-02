import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';

interface Action {
  label: string;
  onPress: () => void;
}

/**
 * Estado vacío de una pestaña (o de un segmento de Competir): icono, titular,
 * texto y hasta dos botones. Sin header ni safe-area: lo pone quien lo usa.
 */
export const TabEmptyState: React.FC<{
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  text: string;
  primary?: Action;
  secondary?: Action;
}> = ({ icon, eyebrow, title, text, primary, secondary }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.box}>
      <View style={styles.icon}>{icon}</View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      {primary ? (
        <Pressable
          onPress={primary.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.primaryLabel}>{primary.label}</Text>
        </Pressable>
      ) : null}
      {secondary ? (
        <Pressable
          onPress={secondary.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.secondaryLabel}>{secondary.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: {
      alignItems: 'center',
      paddingHorizontal: 28,
      paddingTop: 48,
      gap: 10,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2.4,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    text: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 10,
    },
    primary: {
      alignSelf: 'stretch',
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '800',
    },
    secondary: {
      alignSelf: 'stretch',
      height: 50,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
    },
  });
