import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@core/theme';

/** Confeti verde corto al guardar una victoria. Nada con movimiento reducido. */
export const Confetti: React.FC<{ run: boolean; count?: number }> = ({ run, count = 18 }) => {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.round(((i + 0.5) / count) * width + (Math.random() - 0.5) * 40),
        delay: Math.round(Math.random() * 260),
        drift: (Math.random() - 0.5) * 80,
        spin: (Math.random() - 0.5) * 540,
        size: 6 + Math.round(Math.random() * 5),
        light: i % 3 === 0,
      })),
    [count, width],
  );
  if (!run || reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Piece key={i} {...p} />
      ))}
    </View>
  );
};

const Piece: React.FC<{
  x: number;
  delay: number;
  drift: number;
  spin: number;
  size: number;
  light: boolean;
}> = ({ x, delay, drift, spin, size, light }) => {
  const c = useColors();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * 0.9,
    transform: [
      { translateY: -20 + t.value * 420 },
      { translateX: t.value * drift },
      { rotate: `${t.value * spin}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: x,
          width: size,
          height: size * 0.6,
          borderRadius: 2,
          backgroundColor: light ? c.text : c.accent,
        },
        style,
      ]}
    />
  );
};
