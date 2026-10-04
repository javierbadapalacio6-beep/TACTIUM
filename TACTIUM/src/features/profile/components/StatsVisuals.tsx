import React, { useEffect } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@core/theme';
import { Fonts } from '@core/theme/fonts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Anillo del % de victorias. Se llena una vez al entrar (900 ms, salida
 * suave). Sin animación si el sistema pide menos movimiento. `pct` null =
 * todavía sin partidos: anillo vacío y «–%».
 */
export const WinRing: React.FC<{ pct: number | null; size?: number }> = ({
  pct,
  size = 84,
}) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const stroke = Math.max(6, Math.round(size / 10.5));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = pct == null ? 0 : Math.max(0, Math.min(100, pct)) / 100;
  const p = useSharedValue(reduced ? target : 0);

  useEffect(() => {
    p.value = reduced
      ? target
      : withTiming(target, { duration: 900, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
  }, [target, reduced, p]);

  const props = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - p.value),
  }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={pct == null ? 'Sin partidos todavía' : `${pct} % de victorias`}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.hairStrong} strokeWidth={stroke} fill="none" />
        {pct != null ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={c.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            animatedProps={props}
            fill="none"
          />
        ) : null}
      </Svg>
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: Math.round(size * 0.24),
          fontWeight: '800',
          color: pct == null ? c.textFaint : c.text,
        }}
      >
        {pct == null ? '–%' : `${pct}%`}
      </Text>
    </View>
  );
};

const Pip: React.FC<{ win: boolean; index: number }> = ({ win, index }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    v.value = reduced ? 1 : withDelay(index * 60, withTiming(1, { duration: 300 }));
  }, [reduced, index, v]);
  const st = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.4 + 0.6 * v.value }],
  }));
  return (
    <Animated.View
      style={[
        { width: 11, height: 11, borderRadius: 3, backgroundColor: win ? c.accent : c.error },
        st,
      ]}
    />
  );
};

/** Los últimos resultados como cuadros (V verde · D rojo), uno tras otro. */
export const StreakPips: React.FC<{ results: ('W' | 'L')[] }> = ({ results }) => (
  <View
    style={{ flexDirection: 'row', gap: 4 }}
    accessibilityLabel={`Últimos ${results.length}: ${results
      .map((r) => (r === 'W' ? 'victoria' : 'derrota'))
      .join(', ')}`}
  >
    {results.map((r, i) => (
      <Pip key={i} win={r === 'W'} index={i} />
    ))}
  </View>
);

/** Barra horizontal que crece hasta `pct` al entrar. */
export const GrowBar: React.FC<{ pct: number; style?: StyleProp<ViewStyle> }> = ({
  pct,
  style,
}) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(100, pct));
  const v = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    v.value = reduced
      ? target
      : withTiming(target, { duration: 800, easing: Easing.bezier(0.2, 0.7, 0.2, 1) });
  }, [target, reduced, v]);
  const st = useAnimatedStyle(() => ({ width: `${v.value}%` }));
  return (
    <View
      style={[
        { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.hairStrong, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[{ height: '100%', borderRadius: 4, backgroundColor: c.accent }, st]} />
    </View>
  );
};
