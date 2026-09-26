import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { PublishHubScreen } from '@features/matches/screens/PublishHubScreen';
import { RegistrarScreen } from '@features/matches/screens/RegistrarScreen';
import { ComposeScreen } from '@features/matches/screens/ComposeScreen';

import type { PublishStackParamList } from './types';

const Stack = createNativeStackNavigator<PublishStackParamList>();

// Tab ➕ "Crear": hub estilo Instagram → resultado / vídeo / foto / texto.
export const PublishStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="PublishHub" component={PublishHubScreen} />
    <Stack.Screen name="Registrar" component={RegistrarScreen} />
    <Stack.Screen name="Compose" component={ComposeScreen} />
  </Stack.Navigator>
);
