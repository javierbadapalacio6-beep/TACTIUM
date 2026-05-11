import React, { useEffect } from 'react';
import {
  createBottomTabNavigator,
  BottomTabBar,
  type BottomTabBarButtonProps,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
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
import { TeamScreen } from '@features/team/screens/TeamScreen';
import { ProfileScreen } from '@features/profile/screens/ProfileScreen';
import { useTeamStore } from '@store/teamStore';

import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// Icono del tab con micro-animación: cuando pasa de inactivo a activo,
// hace un "pop" spring (1 → 1.18 → 1.0) en ~280ms — siguiendo la regla
// `motion-meaning` (la animación expresa la transición de estado).
const TabIcon: React.FC<{
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  focused: boolean;
}> = ({ Icon, focused }) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.18, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 180 }),
      );
    }
  }, [focused, scale]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[styles.icon, animStyle]}>
      <Icon
        size={22}
        color={focused ? Colors.tabBarActive : Colors.tabBarInactive}
      />
    </Animated.View>
  );
};

// Botón custom que añade press-feedback (scale 1 → 0.88) sobre el item
// del tab. Sigue las reglas `scale-feedback` + `interruptible` +
// `spring-physics` del UX guide.
const AnimatedTabButton: React.FC<BottomTabBarButtonProps> = ({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  testID,
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
        scale.value = withSpring(0.88, { damping: 14, stiffness: 280 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      android_ripple={null}
      style={styles.tabButton}
    >
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
const FloatingTabBar: React.FC<BottomTabBarProps> = (props) => {
  const insets = useSafeAreaInsets();
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
            name="Profile"
            component={ProfileScreen}
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
              component={TeamScreen}
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
            component={ProfileScreen}
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
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
