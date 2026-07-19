import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { SeasonsScreen } from '@features/seasons/screens/SeasonsScreen';
import { SeasonDetailScreen } from '@features/seasons/screens/SeasonDetailScreen';

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
    </Stack.Navigator>
  );
};
