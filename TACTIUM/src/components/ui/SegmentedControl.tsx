import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

const PAD = 4;

/**
 * Selector segmentado (p. ej. «Liga · Federación · Torneos» en Competir).
 * Componente propio en JS — sin pager nativo — con la pastilla del segmento
 * activo deslizándose entre opciones.
 */
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const segW = width > 0 ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);
  const ready = React.useRef(false);

  useEffect(() => {
    if (!segW) return;
    const target = index * segW;
    // Primera colocación sin animar: la pastilla aparece ya en su sitio.
    x.value = ready.current
      ? withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) })
      : target;
    ready.current = true;
  }, [index, segW, x]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={onLayout} accessibilityRole="tablist">
      {segW ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: segW }, pillStyle]}
        />
      ) : null}
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={o.label}
            style={styles.item}
          >
            <Text
              style={[styles.label, { color: sel ? c.textInverse : c.textMuted }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      padding: PAD,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    pill: {
      position: 'absolute',
      top: PAD,
      bottom: PAD,
      left: PAD,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
    },
    item: {
      flex: 1,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 13.5,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  });
