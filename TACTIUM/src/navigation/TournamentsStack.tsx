import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { ClubTournamentsScreen } from '@features/tournaments/screens/ClubTournamentsScreen';
import { TournamentDetailScreen } from '@features/tournaments/screens/TournamentDetailScreen';

import type { TournamentsStackParamList } from './types';

const Stack = createNativeStackNavigator<TournamentsStackParamList>();

export const TournamentsStack = () => {
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
      <Stack.Screen name="TournamentsRoot" component={ClubTournamentsScreen} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    </Stack.Navigator>
  );
};
