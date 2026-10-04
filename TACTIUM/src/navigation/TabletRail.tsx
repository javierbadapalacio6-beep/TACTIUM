import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconPlus } from '@components/ui/Icon';
import { LayoutMetrics, useLayout } from '@components/ui/ResponsiveFrame';

/**
 * Rail lateral de TABLET. Sustituye a la isla flotante inferior cuando
 * `useLayout().isTablet`. Lo pinta el `tabBar` de bottom-tabs 7 con
 * `tabBarPosition: 'left'`, así que las pantallas quedan a su derecha
 * sin tocar nada.
 *
 * - 76 px compacto (icono + nombre pequeño debajo).
 * - 220 px expandido (icono + nombre en fila) si `railExpanded` y ninguna
 *   pantalla enfocada ha pedido `useCompactRail()`.
 * - Arriba el logo y debajo el «＋» destacado (abre CreateSheet).
 * - La ruta `Create` no se pinta como pestaña: es el «＋».
 */
export const TabletRail: React.FC<BottomTabBarProps & { onCreate: () => void }> = ({
  state,
  descriptors,
  navigation,
  onCreate,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { railWidth } = useLayout();
  const expanded = railWidth === LayoutMetrics.railExpanded;

  const width = useSharedValue(railWidth);
  useEffect(() => {
    width.value = withTiming(railWidth, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [railWidth, width]);
  const widthStyle = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      style={[
        styles.rail,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        widthStyle,
      ]}
    >
      <View style={[styles.brand, expanded && styles.brandWide]}>
        <TactiumMark size={34} gradient />
        {expanded ? <Text style={styles.brandText}>TACTIUM</Text> : null}
      </View>

      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Crear"
        accessibilityHint="Abre las acciones rápidas para crear"
        style={({ pressed }) => [
          styles.plus,
          expanded ? styles.plusWide : styles.plusCompact,
          { backgroundColor: c.accent, shadowColor: c.accent },
          pressed && styles.pressed,
        ]}
      >
        <IconPlus size={20} color={c.textInverse} />
        {expanded ? <Text style={styles.plusText}>Crear</Text> : null}
      </Pressable>

      <View style={styles.items}>
        {state.routes.map((route, index) => {
          if (route.name === 'Create') return null;
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? c.accent : c.textMuted;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.dispatch({
                ...CommonActions.navigate(route),
                target: state.key,
              });
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.item,
                expanded ? styles.itemWide : styles.itemCompact,
                focused && {
                  backgroundColor: c.accent + (expanded ? '1A' : '00'),
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  !expanded && focused && {
                    backgroundColor: c.accent + '22',
                    borderColor: c.accent + '55',
                  },
                ]}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  expanded ? styles.labelWide : styles.labelCompact,
                  { color: focused ? c.accent : expanded ? c.text : c.textFaint },
                  focused && styles.labelFocused,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    rail: {
      height: '100%',
      backgroundColor: c.bgRaised,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.hairStrong,
      paddingHorizontal: 12,
      overflow: 'hidden',
    },
    brand: {
      alignItems: 'center',
      marginBottom: 16,
    },
    brandWide: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 4,
    },
    brandText: {
      color: c.text,
      fontFamily: Fonts.mono,
      fontWeight: '800',
      fontSize: 13,
      letterSpacing: 2,
    },
    plus: {
      alignItems: 'center',
      justifyContent: 'center',
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      marginBottom: 18,
    },
    plusCompact: {
      alignSelf: 'center',
      width: 48,
      height: 48,
      borderRadius: 16,
    },
    plusWide: {
      flexDirection: 'row',
      gap: 8,
      height: 44,
      borderRadius: 14,
    },
    plusText: {
      color: c.textInverse,
      fontWeight: '800',
      fontSize: 14,
    },
    items: {
      gap: 6,
    },
    item: {
      borderRadius: 14,
    },
    itemCompact: {
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
    },
    itemWide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 32,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    labelCompact: {
      fontSize: 10,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    labelWide: {
      fontSize: 15,
      fontWeight: '600',
      flexShrink: 1,
    },
    labelFocused: {
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.75,
      transform: [{ scale: 0.96 }],
    },
  });
