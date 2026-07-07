import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { HomeScreen } from '@features/home/screens/HomeScreen';
import { SoloHomeScreen } from '@features/home/screens/SoloHomeScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';
import { AmistosoScreen } from '@features/home/screens/AmistosoScreen';

import { useTeamStore } from '@store/teamStore';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStack = () => {
  // Sin equipo (modo jugador suelto) la Home es la reducida de amistosos.
  const hasTeam = useTeamStore((s) => !!s.team);
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="HomeRoot"
        component={hasTeam ? HomeScreen : SoloHomeScreen}
      />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
      <Stack.Screen name="Amistoso" component={AmistosoScreen} />
    </Stack.Navigator>
  );
};
