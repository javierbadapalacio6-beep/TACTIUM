import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { SeasonsScreen } from '@features/seasons/screens/SeasonsScreen';
import { SeasonDetailScreen } from '@features/seasons/screens/SeasonDetailScreen';

import type { SeasonsStackParamList } from './types';

const Stack = createNativeStackNavigator<SeasonsStackParamList>();

export const SeasonsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SeasonsRoot" component={SeasonsScreen} />
      <Stack.Screen name="SeasonDetail" component={SeasonDetailScreen} />
    </Stack.Navigator>
  );
};
