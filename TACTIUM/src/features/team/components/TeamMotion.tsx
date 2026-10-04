import React, { useEffect, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/**
 * Piezas de movimiento del bloque Equipo. Todas respetan «Reducir
 * movimiento»: con él activo el contenido aparece quieto y los números ya
 * están en su valor.
 */

/** Háptica ligera, sin romper nunca (simulador, web, sin módulo). */
export function lightTap() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    /* sin háptica */
  }
}

/** Número que cuenta de 0 a su valor (400 ms). */
export const CountUp: React.FC<{
  value: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}> = ({ value, suffix = '', style, duration = 400 }) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const v = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    v.value = reduced
      ? value
      : withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, reduced, v, duration]);
  useAnimatedReaction(
    () => Math.round(v.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setShown)(cur);
    },
  );
  return (
    <Text style={style}>
      {shown}
      {suffix}
    </Text>
  );
};

/**
 * Fila que entra escalonada (60 ms cada una). `animate=false` la deja quieta:
 * se usa para que las tarjetas solo entren en la primera carga.
 */
export const StaggerRow: React.FC<{
  index: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ index, animate = true, style, children }) => {
  const reduced = useReducedMotion();
  if (reduced || !animate) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 12) * 60).duration(320)}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Segmento de dos o más opciones con la pastilla que se desliza (180 ms).
 */
export function SlidingSegment<T extends string>({
  value,
  options,
  onChange,
  colors,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  colors: { track: string; pill: string; border: string; on: string; off: string };
}) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const segW = w > 0 ? (w - 6) / options.length : 0;
  useEffect(() => {
    x.value = reduced
      ? idx * segW
      : withTiming(idx * segW, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [idx, segW, reduced, x]);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: 11,
        backgroundColor: colors.track,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {segW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 3,
              bottom: 3,
              left: 3,
              width: segW,
              borderRadius: 8,
              backgroundColor: colors.pill,
            },
            pillStyle,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: on ? '700' : '600',
                color: on ? colors.on : colors.off,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fundido cruzado al cambiar de contenido (pestañas, equipo activo). */
export const CrossFade: React.FC<{
  id: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ id, style, children }) => {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      key={id}
      entering={reduced ? undefined : FadeIn.duration(180)}
      style={style}
    >
      {children}
    </Animated.View>
  );
};
