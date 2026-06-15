import React, { useEffect, useRef } from 'react';
import {
  createBottomTabNavigator,
  BottomTabBar,
  type BottomTabBarButtonProps,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import {
  IconHome,
  IconCalendar,
  IconTeam,
  IconUser,
} from '@components/ui/Icon';
import { HomeStack } from './HomeStack';
import { SeasonsStack } from './SeasonsStack';
import { ClubStack } from './ClubStack';
import { ClubTeamsStack } from './ClubTeamsStack';
import { TeamStack } from './TeamStack';
import { ProfileStack } from './ProfileStack';
import { useTeamStore } from '@store/teamStore';

import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// Icono del tab — sólo cambia color según foco. El halo accent se renderiza
// en el botón (AnimatedTabButton) para englobar icono + label.
const TabIcon: React.FC<{
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  focused: boolean;
}> = ({ Icon, focused }) => {
  return (
    <View style={styles.icon}>
      <Icon
        size={22}
        color={focused ? Colors.tabBarActive : Colors.tabBarInactive}
      />
    </View>
  );
};

// Botón custom: añade press-feedback (scale 1 → 0.88) y halo accent que
// englobe icono + label cuando el tab está activo. El halo aparece sin
// rebote: si el tab ya está activo al montar (Inicio en arranque), se
// pinta directo en opacidad 1 sin animar.
const AnimatedTabButton: React.FC<BottomTabBarButtonProps> = ({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  testID,
}) => {
  const focused = accessibilityState?.selected ?? false;
  const scale = useSharedValue(1);
  const haloOpacity = useSharedValue(focused ? 1 : 0);
  const isFirstMount = useRef(true);

  useEffect(() => {
    const skip = isFirstMount.current;
    isFirstMount.current = false;
    if (focused) {
      // Sin rebote: timing con ease-out. En el primer render, si ya está
      // activo, saltamos la animación (debe estar ya englobado).
      haloOpacity.value = skip
        ? 1
        : withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    } else {
      haloOpacity.value = withTiming(0, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [focused, haloOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withTiming(0.92, {
          duration: 90,
          easing: Easing.out(Easing.cubic),
        });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, {
          duration: 140,
          easing: Easing.out(Easing.cubic),
        });
      }}
      android_ripple={null}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
      <Animated.View style={[styles.tabButtonInner, animStyle]}>
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
};

// Icono para el tab "Club" — aprovechamos el de Team con sutil tinte distinto.
// Mantenerlo simple evita añadir un asset nuevo en Fase 4.
const IconClub = IconTeam;

// Tab bar flotante "isla" con cristal. Estructura:
//   floatingWrap (absolute, posiciona horizontal/bottom)
//     glassPill (overflow hidden, borderRadius → clip del BlurView)
//       BlurView + tint + border = efecto cristal
//     BottomTabBar absolute encima (transparente, solo iconos/labels)
//
// Se OCULTA automáticamente en screens anidadas (Jornada, Lineup, etc.)
// — patrón drill-down estándar (Instagram, Twitter): el tab bar molesta
// y pisa CTAs sticky en pantallas de detalle.
//
// Detección por NOMBRE de ruta (allowlist explícita). Confiar en
// `state.index > 0` es frágil: tras navegar a un detalle, cambiar de tab
// y volver, el stack puede quedar con index > 0 aunque la screen visible
// sea ahora root — eso hacía que el tab bar desapareciera en Home.
const HIDE_TAB_BAR_ON: ReadonlySet<string> = new Set([
  'Jornada',
  'Lineup',
  'Results',
  'Availability',
  'SeasonDetail',
  'CreateTeamFromClub',
  // Vista de detalle del team desde el tab Equipos (club_admin) — oculta
  // el tab bar para enfocar la lectura del team elegido.
  'ClubTeamPreview',
]);

const FloatingTabBar: React.FC<BottomTabBarProps> = (props) => {
  const insets = useSafeAreaInsets();

  const focusedTab = props.state.routes[props.state.index];
  const focusedRouteName = getFocusedRouteNameFromRoute(focusedTab);
  // Si aún no hay state hidratado, focusedRouteName es undefined → root.
  const isNestedScreen =
    focusedRouteName !== undefined && HIDE_TAB_BAR_ON.has(focusedRouteName);

  if (isNestedScreen) return null;

  return (
    <View
      style={[
        styles.floatingWrap,
        { bottom: Math.max(insets.bottom, 12) },
      ]}
      pointerEvents="box-none"
    >
      {/* Pill con clipping para que el blur respete las esquinas
          redondeadas. Sombra externa va aparte (debajo). */}
      <View style={styles.shadowWrap}>
        <View style={styles.glassPill}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
          <View style={[StyleSheet.absoluteFill, styles.glassBorder]} />
          <BottomTabBar {...props} />
        </View>
      </View>
    </View>
  );
};

export const TabNavigator = () => {
  const activeRole = useTeamStore((s) => s.activeRole);

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        // El BottomTabBar interno se renderiza encima del pill cristal.
        // Lo dejamos transparente para que se vea el blur a través.
        tabBarStyle: styles.innerTabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarBackground: () => null,
        // Botón con animación de press (scale-feedback + spring).
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
        // `animation: 'none'`: con `'shift'` se veía el bug del lazy mount;
        // con `'fade'` aún quedaba un edge case donde nav rápida entre tabs
        // dejaba opacity 0 (Profile salía blanco). `none` cambia
        // instantáneo entre tabs — menos sutil visualmente, pero 100%
        // robusto. La animación bonita entre stacks la sigue dando el
        // `slide_from_right` de los stacks internos para drill-down.
        animation: 'none',
        // Pre-montamos las 3 tabs al arrancar (vs. `lazy: true` default que
        // monta solo al primer focus). Sin esto, navegar rápido entre tabs
        // disparaba el lazy-mount del stack interno a mitad de la animación
        // `fade` y la pantalla quedaba con tab bar visible pero contenido
        // vacío. Coste: ~50-100 KB extra de RAM por tener las 3 montadas;
        // aceptable porque solo tenemos 2 stacks por rol.
        lazy: false,
        // Defensa adicional: no congelar el render de la tab al perder
        // focus. `freezeOnBlur: true` (que es default cuando hay
        // react-native-screens) puede causar que al re-focus haya un
        // frame con contenido stale o vacío en navegaciones muy rápidas.
        freezeOnBlur: false,
      }}
    >
      {activeRole === 'club_admin' ? (
        <>
          <Tab.Screen
            name="Club"
            component={ClubStack}
            options={{
              tabBarLabel: 'Club',
              tabBarIcon: ({ focused }) => (
                <TabIcon Icon={IconClub} focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="ClubTeams"
            component={ClubTeamsStack}
            options={{
              tabBarLabel: 'Equipos',
              tabBarIcon: ({ focused }) => (
                <TabIcon Icon={IconTeam} focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileStack}
            options={{
              tabBarLabel: 'Perfil',
              tabBarIcon: ({ focused }) => (
                <TabIcon Icon={IconUser} focused={focused} />
              ),
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="Home"
            component={HomeStack}
            options={{
              tabBarLabel: 'Inicio',
              tabBarIcon: ({ focused }) => (
                <TabIcon Icon={IconHome} focused={focused} />
              ),
            }}
          />

          {activeRole !== 'player' ? (
            <Tab.Screen
              name="Seasons"
              component={SeasonsStack}
              options={{
                tabBarLabel: 'Temporadas',
                tabBarIcon: ({ focused }) => (
                  <TabIcon Icon={IconCalendar} focused={focused} />
                ),
              }}
            />
          ) : null}

          {activeRole !== 'player' ? (
            <Tab.Screen
              name="Team"
              component={TeamStack}
              options={{
                tabBarLabel: 'Equipo',
                tabBarIcon: ({ focused }) => (
                  <TabIcon Icon={IconTeam} focused={focused} />
                ),
              }}
            />
          ) : null}

          <Tab.Screen
            name="Profile"
            component={ProfileStack}
            options={{
              tabBarLabel: 'Perfil',
              tabBarIcon: ({ focused }) => (
                <TabIcon Icon={IconUser} focused={focused} />
              ),
            }}
          />
        </>
      )}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  floatingWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 12,
  },
  // Wrapper de sombra: la sombra NO puede ir en glassPill porque ese tiene
  // overflow: hidden (necesario para clipping del BlurView). La sombra
  // se aplica en un padre con overflow: visible.
  shadowWrap: {
    borderRadius: 32,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  glassPill: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  innerTabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    height: 64,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    elevation: 0,
    shadowOpacity: 0,
    // Cancela cualquier position absolute que el BottomTabBar tenga por
    // defecto, así se renderiza dentro del pill como child normal.
    position: 'relative',
  },
  glassTint: {
    backgroundColor: 'rgba(7,18,15,0.42)',
  },
  glassBorder: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  item: {
    paddingTop: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonInner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
  },
  halo: {
    // Englobe icono + label. Inset en los lados para no tocar los bordes
    // del pill, y en vertical para respetar el padding del tab bar.
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 8,
    right: 8,
    borderRadius: 18,
    backgroundColor: Colors.accent + '22', // ~13% alpha
    borderWidth: 1,
    borderColor: Colors.accent + '55',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
