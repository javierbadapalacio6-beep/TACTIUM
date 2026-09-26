import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { VenuePanelScreen } from '@features/venue/screens/VenuePanelScreen';
import { VenuePublicScreen } from '@features/venue/screens/VenuePublicScreen';

// Stack del tab "Mi sede" (cuenta de negocio): el Panel de sede + la ficha
// pública (para previsualizarla). Solo se usa como tab cuando el usuario
// posee una sede (ver TabNavigator).
const Stack = createNativeStackNavigator();

export const VenueStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      animation: 'none',
    }}
  >
    <Stack.Screen name="VenuePanel" component={VenuePanelScreen} />
    <Stack.Screen name="VenuePublic" component={VenuePublicScreen} />
  </Stack.Navigator>
);
