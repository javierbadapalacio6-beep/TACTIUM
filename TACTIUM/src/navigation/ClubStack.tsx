import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { ClubDashboardScreen } from '@features/club/screens/ClubDashboardScreen';
import { CreateTeamFromClubScreen } from '@features/club/screens/CreateTeamFromClubScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';

import type { ClubStackParamList } from './types';

const Stack = createNativeStackNavigator<ClubStackParamList>();

export const ClubStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ClubRoot" component={ClubDashboardScreen} />
      <Stack.Screen
        name="CreateTeamFromClub"
        component={CreateTeamFromClubScreen}
      />
      {/* Jornada/Lineup/Results reusadas para navegar desde ClubDashboard
          a un partido concreto. Read-only para club_admin. */}
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
    </Stack.Navigator>
  );
};
