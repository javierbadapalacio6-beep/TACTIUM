import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { SeasonsScreen } from '@features/seasons/screens/SeasonsScreen';
import { SeasonDetailScreen } from '@features/seasons/screens/SeasonDetailScreen';
import { FcpTeamScreen } from '@features/seasons/screens/FcpTeamScreen';
import { FcpPlayerScreen } from '@features/seasons/screens/FcpPlayerScreen';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FcpGroupScreen } from '@features/seasons/screens/FcpGroupScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';

import type { SeasonsStackParamList } from './types';

const Stack = createNativeStackNavigator<SeasonsStackParamList>();

export const SeasonsStack = () => {
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
      <Stack.Screen name="SeasonsRoot" component={SeasonsScreen} />
      <Stack.Screen name="SeasonDetail" component={SeasonDetailScreen} />
      <Stack.Screen name="FcpTeam" component={FcpTeamScreen} />
      <Stack.Screen name="FcpPlayer" component={FcpPlayerScreen} />
      <Stack.Screen name="Federacion" component={FederacionScreen} />
      <Stack.Screen name="FcpGroup" component={FcpGroupScreen} />
      {/* Flujo de jornada dentro de Temporadas → "atrás" vuelve a la temporada. */}
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
    </Stack.Navigator>
  );
};
