import React, { useEffect, useRef, useState } from 'react';
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

import { useColors, useIsDark } from '@core/theme';
import {
  IconHome,
  IconTeam,
  IconUser,
  IconTrophy,
  IconPlus,
} from '@components/ui/Icon';
import { HomeStack } from './HomeStack';
import { CompetirStack } from './CompetirStack';
import { TeamStack } from './TeamStack';
import { ProfileStack } from './ProfileStack';
import { CreateSheet } from '@features/create/components/CreateSheet';
import { useNavRole } from './navRole';
import { TabletRail } from './TabletRail';
import { useLayout } from '@components/ui/ResponsiveFrame';

import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// Icono del tab — sólo cambia color según foco. El halo accent se renderiza
// en el botón (AnimatedTabButton) para englobar icono + label.
// `color` lo pasa la barra (en móvil coincide con tabBarActive/Inactive;
// en el rail de tablet es el acento).
const TabIcon: React.FC<{
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  focused: boolean;
  color?: string;
}> = ({ Icon, focused, color }) => {
  const c = useColors();
  return (
    <View style={styles.icon}>
      <Icon
        size={22}
        color={color ?? (focused ? c.tabBarActive : c.tabBarInactive)}
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
  const c = useColors();
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
      <Animated.View
        style={[
          styles.halo,
          {
            backgroundColor: c.accent + '22', // ~13% alpha
            borderColor: c.accent + '55',
          },
          haloStyle,
        ]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.tabButtonInner, animStyle]}>
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
};

// Botón central ＋: círculo de acento con sombra, más grande que el resto de
// huecos. No es una pestaña — abre la hoja CREAR (acciones por rol).
const CreateTabButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const c = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.9, {
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
      accessibilityRole="button"
      accessibilityLabel="Crear"
      accessibilityHint="Abre las acciones rápidas para crear"
      android_ripple={null}
      style={styles.tabButton}
    >
      <Animated.View
        style={[
          styles.createCircle,
          { backgroundColor: c.accent, shadowColor: c.accent },
          animStyle,
        ]}
      >
        <IconPlus size={22} color={c.textInverse} />
      </Animated.View>
    </Pressable>
  );
};

// Pantalla vacía del hueco ＋ (nunca se enfoca: el toque se intercepta).
const CreatePlaceholder = () => null;

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
  'LiveScore',
  'SeasonDetail',
  'FcpTeam',
  'FcpPlayer',
  'Federacion',
  'FcpGroup',
  'CreateTeamFromClub',
  // Vista de detalle del team desde el tab Equipos (club_admin) — oculta
  // el tab bar para enfocar la lectura del team elegido.
  'ClubTeamPreview',
]);

const FloatingTabBar: React.FC<BottomTabBarProps> = (props) => {
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();

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
      <View
        style={[
          styles.shadowWrap,
          !isDark && { shadowOpacity: 0.14, shadowRadius: 20 },
        ]}
      >
        <View style={styles.glassPill}>
          <BlurView
            intensity={70}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              isDark ? styles.glassTint : styles.glassTintLight,
            ]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              isDark ? styles.glassBorder : styles.glassBorderLight,
            ]}
          />
          <BottomTabBar {...props} />
        </View>
      </View>
    </View>
  );
};

/**
 * Barra ÚNICA para todos los roles: Inicio · Competir · ＋ · Equipo · Perfil.
 * Lo que cambia por rol es el CONTENIDO de cada pestaña (ver HomeStack,
 * CompetirStack, TeamStack) y las acciones de la hoja ＋ (CreateSheet).
 * Los nombres de pestaña son estables (`Home`, `Team`, `Profile`) para que
 * avisos, push y enlaces sigan llegando a su sitio sea cual sea el rol.
 */
export const TabNavigator = () => {
  const c = useColors();
  const [createOpen, setCreateOpen] = useState(false);
  // Al cambiar de rol (Perfil → cambiar de equipo/club) el contenido de las
  // stacks se recalcula solo; aquí solo se usa para el texto de Equipo.
  const role = useNavRole();
  const teamLabel = role === 'club' || role === 'organizer' ? 'Equipos' : 'Equipo';
  // Tablet: la barra pasa a ser un rail a la izquierda (TabletRail). En
  // móvil todo sigue igual: isla flotante inferior.
  const { isTablet } = useLayout();

  return (
    <>
      <Tab.Navigator
        tabBar={(props) =>
          isTablet ? (
            <TabletRail {...props} onCreate={() => setCreateOpen(true)} />
          ) : (
            <FloatingTabBar {...props} />
          )
        }
        screenOptions={{
          headerShown: false,
          tabBarPosition: isTablet ? 'left' : 'bottom',
          tabBarActiveTintColor: c.tabBarActive,
          tabBarInactiveTintColor: c.tabBarInactive,
          // El BottomTabBar interno se renderiza encima del pill cristal.
          // Lo dejamos transparente para que se vea el blur a través.
          tabBarStyle: styles.innerTabBar,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: styles.item,
          tabBarBackground: () => null,
          // Botón con animación de press (scale-feedback + halo).
          tabBarButton: (props) => <AnimatedTabButton {...props} />,
          // `animation: 'none'`: con `'shift'`/`'fade'` quedaban frames vacíos
          // en navegación rápida entre pestañas. La animación bonita la dan
          // los `slide_from_right` de las stacks internas.
          animation: 'none',
          // Pre-montamos las pestañas al arrancar: el lazy-mount a mitad de
          // una navegación rápida dejaba la pantalla vacía. Además los avisos
          // navegan a rutas anidadas y necesitan las stacks montadas.
          lazy: false,
          // No congelar al perder el foco: evita un frame stale/vacío al
          // volver en navegaciones muy rápidas.
          freezeOnBlur: false,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarLabel: 'Inicio',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon color={color} Icon={IconHome} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Competir"
          component={CompetirStack}
          options={{
            tabBarLabel: 'Competir',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon color={color} Icon={IconTrophy} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Create"
          component={CreatePlaceholder}
          options={{
            tabBarLabel: 'Crear',
            tabBarButton: () => (
              <CreateTabButton onPress={() => setCreateOpen(true)} />
            ),
          }}
          listeners={{
            // Nunca se navega a este hueco: solo abre la hoja.
            tabPress: (e) => {
              e.preventDefault();
              setCreateOpen(true);
            },
          }}
        />
        <Tab.Screen
          name="Team"
          component={TeamStack}
          options={{
            tabBarLabel: teamLabel,
            tabBarIcon: ({ focused, color }) => (
              <TabIcon color={color} Icon={IconTeam} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{
            tabBarLabel: 'Perfil',
            tabBarIcon: ({ focused, color }) => (
              <TabIcon color={color} Icon={IconUser} focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
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
  glassTintLight: {
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  glassBorder: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  glassBorderLight: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(14,26,20,0.10)',
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
    borderWidth: 1,
  },
  createCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
