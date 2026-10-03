import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';

const TOTAL = 3;

/**
 * Barra de progreso del onboarding de equipo y de club: 3 segmentos y la
 * etiqueta «PASO N DE 3». Los caminos son el mismo para los dos:
 *   1 · lo tuyo (equipo, o club + sus equipos) · 2 · tu gente · 3 · avisos.
 * El segmento del paso actual se rellena al entrar; los anteriores ya llegan
 * llenos. `sublabel` matiza el paso 1 del club («Club» / «Equipos»). `right`
 * es la acción de la cabecera (Atrás, Salir, Lo haré luego…).
 */
export const OnboardingProgress: React.FC<{
  step: 1 | 2 | 3;
  sublabel?: string;
  right?: React.ReactNode;
}> = ({ step, sublabel, right }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.wrap}>
      <View
        style={styles.bars}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: TOTAL, now: step }}
      >
        {Array.from({ length: TOTAL }, (_, i) => (
          <Segment
            key={i}
            state={i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo'}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>
          PASO {step} DE {TOTAL}
          {sublabel ? ` · ${sublabel.toUpperCase()}` : ''}
        </Text>
        {right ?? null}
      </View>
    </View>
  );
};

/** Acción de texto para el lado derecho de la barra («‹ Atrás», «Salir»…). */
export const ProgressAction: React.FC<{ label: string; onPress: () => void }> = ({
  label,
  onPress,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Text style={styles.action}>{label}</Text>
    </Pressable>
  );
};

const Segment: React.FC<{ state: 'done' | 'current' | 'todo' }> = ({ state }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const fill = useSharedValue(state === 'done' || (state === 'current' && reduced) ? 1 : 0);

  useEffect(() => {
    const target = state === 'todo' ? 0 : 1;
    if (reduced) {
      fill.value = target;
      return;
    }
    // Un respiro tras la transición de pantalla para que se vea rellenarse.
    fill.value = withDelay(
      state === 'current' ? 180 : 0,
      withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, [state, reduced, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: 10,
    },
    bars: {
      flexDirection: 'row',
      gap: 6,
    },
    track: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.hairStrong,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: c.accent,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 22,
    },
    action: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      color: c.textMuted,
      fontWeight: '500',
    },
  });
