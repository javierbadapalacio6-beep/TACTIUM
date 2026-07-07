import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { HomeScreen } from '@features/home/screens/HomeScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';
import { NoTeamScreen } from '@features/home/screens/NoTeamScreen';
import { useTeamStore } from '@store/teamStore';

import type { HomeStackParamList, HomeStackScreenProps } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

// Raíz del tab "Equipo": si el usuario está en un equipo, su hub; si no
// (acceso abierto), el estado "sin equipo" para unirse o crear.
const HomeRoot = (props: HomeStackScreenProps<'HomeRoot'>) => {
  const team = useTeamStore((s) => s.team);
  return team ? <HomeScreen {...props} /> : <NoTeamScreen />;
};

export const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HomeRoot" component={HomeRoot} />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
    </Stack.Navigator>
  );
};
