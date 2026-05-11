import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { ClubDashboardScreen } from '@features/club/screens/ClubDashboardScreen';
import { CreateTeamFromClubScreen } from '@features/club/screens/CreateTeamFromClubScreen';

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
    </Stack.Navigator>
  );
};
