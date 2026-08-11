import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { WelcomeScreen } from '@features/auth/screens/WelcomeScreen';
import { PublicHomeScreen } from '@features/auth/screens/PublicHomeScreen';
import { LoginScreen } from '@features/auth/screens/LoginScreen';
import { PublicPlansScreen } from '@features/auth/screens/PublicPlansScreen';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FcpGroupScreen } from '@features/seasons/screens/FcpGroupScreen';
import { FcpTeamScreen } from '@features/seasons/screens/FcpTeamScreen';
import { FcpPlayerScreen } from '@features/seasons/screens/FcpPlayerScreen';
import { useAuthStore } from '@store/authStore';

import type { AuthStackParamList, SeasonsStackScreenProps } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Las pantallas de federación se reutilizan tal cual desde el stack de
 * Temporadas: no tocan sesión ni stores, sólo `navigation` y `route`, y los
 * nombres de ruta son los mismos aquí. Lo único que no encaja es el TIPO —
 * allí van compuestas con las props de las tabs, que aquí no existen — así
 * que se adaptan en estos envoltorios en vez de duplicar las pantallas.
 */
const asSeasons = <T extends 'Federacion' | 'FcpGroup' | 'FcpTeam' | 'FcpPlayer'>(
  props: unknown,
) => props as SeasonsStackScreenProps<T>;

const PublicFederacion = (props: object) => (
  <FederacionScreen {...asSeasons<'Federacion'>(props)} />
);
const PublicFcpGroup = (props: object) => (
  <FcpGroupScreen {...asSeasons<'FcpGroup'>(props)} />
);
const PublicFcpTeam = (props: object) => (
  <FcpTeamScreen {...asSeasons<'FcpTeam'>(props)} />
);
const PublicFcpPlayer = (props: object) => (
  <FcpPlayerScreen {...asSeasons<'FcpPlayer'>(props)} />
);

export const AuthStack = () => {
  const hasSeenWelcome = useAuthStore((s) => s.hasSeenWelcome);
  const c = useColors();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: c.background },
      animation: 'slide_from_right' as const,
    }),
    [c],
  );
  return (
    <Stack.Navigator
      // Tras el carrusel de bienvenida se aterriza en la HOME PÚBLICA, no en
      // el login: mirar no debería costar una cuenta.
      initialRouteName={hasSeenWelcome ? 'PublicHome' : 'Welcome'}
      screenOptions={screenOptions}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PublicHome" component={PublicHomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Plans" component={PublicPlansScreen} />

      <Stack.Screen name="Federacion" component={PublicFederacion} />
      <Stack.Screen name="FcpGroup" component={PublicFcpGroup} />
      <Stack.Screen name="FcpTeam" component={PublicFcpTeam} />
      <Stack.Screen name="FcpPlayer" component={PublicFcpPlayer} />
    </Stack.Navigator>
  );
};
