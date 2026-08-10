import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { HomeScreen } from '@features/home/screens/HomeScreen';
import { SoloHomeScreen } from '@features/home/screens/SoloHomeScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';
import { AmistosoScreen } from '@features/home/screens/AmistosoScreen';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FcpTeamScreen } from '@features/seasons/screens/FcpTeamScreen';
import { FcpPlayerScreen } from '@features/seasons/screens/FcpPlayerScreen';
import { FcpGroupScreen } from '@features/seasons/screens/FcpGroupScreen';

import { useTeamStore } from '@store/teamStore';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStack = () => {
  // Sin equipo (modo jugador suelto) la Home es la reducida de amistosos.
  const hasTeam = useTeamStore((s) => !!s.team);
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
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="HomeRoot"
        component={hasTeam ? HomeScreen : SoloHomeScreen}
      />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
      <Stack.Screen name="Amistoso" component={AmistosoScreen} />
      {/* Explorar Federación desde el atajo de Home → "atrás" vuelve a Inicio. */}
      <Stack.Screen name="Federacion" component={FederacionScreen} />
      <Stack.Screen name="FcpTeam" component={FcpTeamScreen} />
      <Stack.Screen name="FcpPlayer" component={FcpPlayerScreen} />
      <Stack.Screen name="FcpGroup" component={FcpGroupScreen} />
    </Stack.Navigator>
  );
};
