/**
 * Barra de navegación «Muesca» (recurso de Moxen, licencia de uso libre en apps entregadas), portada a React
 * Native: la barra tiene una muesca en el borde que viaja con resorte hasta la pestaña activa mientras el borde
 * se curva a su alrededor; el ícono sube a una burbuja con un pequeño rebote y el título se escribe letra a
 * letra. Arrastrar el dedo por la barra mueve la muesca de forma continua y encaja en la pestaña más cercana.
 * La pestaña central (Crear) es una acción, no una sección: abre la hoja CREAR de siempre.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  FadeInDown,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useColors, useIsDark } from '@core/theme';
import { IconHome, IconTeam, IconTrophy, IconUser, IconPlus } from '@components/ui/Icon';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** La forma de la barra (px). `arriba`: dónde empieza su borde dentro de la caja de `alto`. */
const GEO = { arriba: 28, alto: 86, hondo: 34, ancho: 33, esquina: 18, margen: 46 };
/** Margen lateral de la barra: más estrecha que la demo (390 px) para que no ocupe todo el ancho. */
const LATERAL = 34;
const MUESCA = { stiffness: 235, damping: 21.5, mass: 1 };
const BURBUJA = { stiffness: 330, damping: 14.5, mass: 1 };

/** Pantallas de detalle donde la barra se oculta (misma lista que la barra de cristal anterior). */
const HIDE_TAB_BAR_ON: ReadonlySet<string> = new Set([
  'Jornada',
  'Lineup',
  'Results',
  'Availability',
  'LiveScore',
  'SeasonDetail',
  'FcpTeam',
  'FcpPlayer',
  'Federacion',
  'FcpGroup',
  'CreateTeamFromClub',
  'ClubTeamPreview',
]);

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Home: IconHome,
  Competir: IconTrophy,
  Team: IconTeam,
  Profile: IconUser,
};

/** El borde de la barra con su muesca: se estira y se inclina con la velocidad. */
function camino(cx: number, lean: number, ancho: number, W: number): string {
  'worklet';
  const T = GEO.arriba;
  const H = GEO.alto;
  const D = GEO.hondo;
  const R = GEO.esquina;
  const A = Math.max(22, Math.min(ancho, cx - R - 3, W - R - 3 - cx));
  const bx = cx + lean;
  const x0 = cx - A;
  const x1 = cx + A;
  const k = A * 0.58;
  return (
    `M0 ${T + R}Q0 ${T} ${R} ${T}L${x0.toFixed(2)} ${T}` +
    `C${(x0 + k).toFixed(2)} ${T} ${(bx - k * 1.05).toFixed(2)} ${T + D} ${bx.toFixed(2)} ${T + D}` +
    `C${(bx + k * 1.05).toFixed(2)} ${T + D} ${(x1 - k).toFixed(2)} ${T} ${x1.toFixed(2)} ${T}` +
    `L${W - R} ${T}Q${W} ${T} ${W} ${T + R}L${W} ${H - R}Q${W} ${H} ${W - R} ${H}` +
    `L${R} ${H}Q0 ${H} 0 ${H - R}Z`
  );
}

const lim = (v: number, a: number, b: number) => {
  'worklet';
  return Math.max(a, Math.min(b, v));
};

/** Un ícono de pestaña que se aparta (se desvanece y baja) cuando la muesca pasa por encima. */
const TabIconSlot: React.FC<{
  center: number;
  cx: SharedValue<number>;
  children: React.ReactNode;
}> = ({ center, cx, children }) => {
  const st = useAnimatedStyle(() => {
    const p = lim(1 - Math.abs(center - cx.value) / 46, 0, 1);
    return {
      opacity: 1 - p,
      transform: [{ translateY: p * 9 }, { scale: 1 - p * 0.25 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[s.ic, { left: center - 13 }, st]}>
      {children}
    </Animated.View>
  );
};

export const MuescaTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const c = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const W = screenW - LATERAL * 2;

  const focusedTab = state.routes[state.index];
  const focusedName = getFocusedRouteNameFromRoute(focusedTab);
  const hidden = focusedName !== undefined && HIDE_TAB_BAR_ON.has(focusedName);

  const n = state.routes.length; // Inicio · Competir · Crear · Equipo · Perfil
  const centers = useMemo(() => {
    const paso = (W - 2 * GEO.margen) / (n - 1);
    return state.routes.map((_, i) => GEO.margen + i * paso);
  }, [W, n, state.routes]);

  const active = state.index;
  const cx = useSharedValue(centers[active]);
  const target = useSharedValue(centers[active]);
  const lift = useSharedValue(1);
  const [hover, setHover] = useState<number | null>(null);

  // La pestaña activa cambia (toque, arrastre o navegación desde fuera): la muesca viaja hasta ella.
  useEffect(() => {
    target.value = centers[active];
    cx.value = withSpring(centers[active], MUESCA);
    lift.value = 0.3;
    lift.value = withSpring(1, BURBUJA);
    setHover(null);
  }, [active, centers, cx, target, lift]);

  const press = useCallback(
    (index: number) => {
      const route = state.routes[index];
      const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (e.defaultPrevented) return;
      if (index !== state.index) {
        Haptics.selectionAsync().catch(() => {});
        navigation.navigate(route.name as never);
      }
    },
    [navigation, state.index, state.routes],
  );

  const nearest = useCallback(
    (x: number) => {
      let best = -1;
      state.routes.forEach((r, i) => {
        if (r.name === 'Create') return;
        if (best < 0 || Math.abs(centers[i] - x) < Math.abs(centers[best] - x)) best = i;
      });
      return best;
    },
    [centers, state.routes],
  );

  const onDragPick = useCallback((x: number) => setHover(nearest(x)), [nearest]);
  const onDragEnd = useCallback(
    (x: number) => {
      const i = nearest(x);
      setHover(null);
      if (i >= 0) press(i);
    },
    [nearest, press],
  );

  const first = centers[0];
  const last = centers[centers.length - 1];
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(7)
        .activeOffsetX([-7, 7])
        .onStart(() => {
          lift.value = withSpring(1.14, BURBUJA);
        })
        .onUpdate((e) => {
          const x = lim(e.x, first, last);
          target.value = x;
          cx.value = withSpring(x, MUESCA);
          runOnJS(onDragPick)(x);
        })
        .onEnd((e) => {
          const x = lim(e.x, first, last);
          lift.value = withSpring(1, BURBUJA);
          runOnJS(onDragEnd)(x);
        }),
    [first, last, cx, target, lift, onDragPick, onDragEnd],
  );

  const pathProps = useAnimatedProps(() => {
    const err = target.value - cx.value;
    const lean = lim(err * 0.14, -15, 15);
    const ancho = GEO.ancho + lim(Math.abs(err) * 0.1, 0, 11);
    return { d: camino(cx.value, lean, ancho, W) };
  });
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx.value - 23 },
      { translateY: (1 - lim(lift.value, -0.4, 1.4)) * 30 },
      { scale: 0.5 + 0.5 * lim(lift.value, 0, 1.3) },
    ],
  }));
  const labelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: cx.value - 60 }] }));

  if (hidden) return null;

  const shownIndex = hover ?? active;
  const shownRoute = state.routes[shownIndex];
  const BubbleIcon = ICONS[shownRoute.name] ?? IconHome;
  const activeLabel = String(descriptors[state.routes[active].key]?.options.tabBarLabel ?? '');
  // Cristal: el fondo es translúcido y el BlurView de debajo difumina lo que pasa por detrás.
  const barFill = isDark ? 'rgba(27,29,33,0.52)' : 'rgba(255,255,255,0.56)';

  return (
    <View
      style={[s.wrap, { left: LATERAL, bottom: Math.max(insets.bottom, 12) + 8, width: W }]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={pan}>
        <View style={{ width: W, height: GEO.alto }}>
          {/* Cristal difuminado bajo la barra */}
          <View style={[s.glass, { width: W }]} pointerEvents="none">
            <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          </View>
          {/* La barra con su muesca */}
          <Svg width={W} height={GEO.alto} style={s.svg}>
            <AnimatedPath
              animatedProps={pathProps}
              fill={barFill}
              stroke={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,21,24,0.10)'}
              strokeWidth={1}
            />
          </Svg>

          {/* Íconos de las pestañas (se apartan al pasar la muesca) */}
          {state.routes.map((route, i) => {
            if (route.name === 'Create') return null;
            const Icon = ICONS[route.name];
            if (!Icon) return null;
            return (
              <TabIconSlot key={route.key} center={centers[i]} cx={cx}>
                <Icon size={26} color={c.tabBarInactive} />
              </TabIconSlot>
            );
          })}

          {/* Zonas táctiles */}
          {state.routes.map((route, i) => {
            const isCreate = route.name === 'Create';
            const label = String(descriptors[route.key]?.options.tabBarLabel ?? route.name);
            return (
              <Pressable
                key={`hit-${route.key}`}
                onPress={() => press(i)}
                accessibilityRole={isCreate ? 'button' : 'tab'}
                accessibilityLabel={isCreate ? 'Crear' : label}
                accessibilityHint={isCreate ? 'Abre las acciones rápidas para crear' : undefined}
                accessibilityState={isCreate ? undefined : { selected: i === active }}
                android_ripple={null}
                style={[s.hit, { left: centers[i] - 26, top: GEO.arriba }]}
              />
            );
          })}

          {/* La burbuja que sube a la muesca con el ícono activo */}
          <Animated.View pointerEvents="none" style={[s.bubble, { backgroundColor: c.accent }, bubbleStyle]}>
            <BubbleIcon size={23} color={c.textInverse} />
          </Animated.View>

          {/* Título de la pestaña activa: se escribe letra a letra */}
          <Animated.View pointerEvents="none" style={[s.label, labelStyle]}>
            <View key={`${active}-${activeLabel}`} style={s.labelRow}>
              {Array.from(activeLabel).map((ch, k) => (
                <Animated.Text
                  key={k}
                  entering={FadeInDown.delay(170 + k * 42)
                    .duration(380)
                    .easing(Easing.out(Easing.cubic))}
                  style={[s.labelText, { color: c.text }]}
                >
                  {ch === ' ' ? ' ' : ch}
                </Animated.Text>
              ))}
            </View>
          </Animated.View>

          {/* La acción central: Crear */}
          {state.routes.map((route, i) =>
            route.name === 'Create' ? (
              <CreateButton key={`create-${route.key}`} center={centers[i]} onPress={() => press(i)} />
            ) : null,
          )}
        </View>
      </GestureDetector>
    </View>
  );
};

const CreateButton: React.FC<{ center: number; onPress: () => void }> = ({ center, onPress }) => {
  const c = useColors();
  const scale = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[s.create, { left: center - 28, backgroundColor: c.text, borderColor: c.bgCard }, st]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.92, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, BURBUJA);
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={s.createHit}
        android_ripple={null}
      >
        <IconPlus size={24} color={c.bgCard} />
      </Pressable>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { position: 'absolute' },
  glass: {
    position: 'absolute',
    left: 0,
    top: GEO.arriba,
    height: GEO.alto - GEO.arriba,
    borderRadius: GEO.esquina,
    overflow: 'hidden',
  },
  svg: { position: 'absolute', left: 0, top: 0, overflow: 'visible' },
  ic: { position: 'absolute', top: 45, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  hit: { position: 'absolute', width: 52, height: 58 },
  bubble: {
    position: 'absolute',
    left: 0,
    top: 7,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { position: 'absolute', left: 0, top: 64, width: 120, alignItems: 'center' },
  labelRow: { flexDirection: 'row' },
  labelText: { fontSize: 12.5, fontWeight: '600', letterSpacing: -0.1 },
  create: {
    position: 'absolute',
    top: 4,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  createHit: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
