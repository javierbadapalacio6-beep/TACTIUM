import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { FeedScreen } from '@features/feed/screens/FeedScreen';
import { VenuePublicScreen } from '@features/venue/screens/VenuePublicScreen';

// Stack del tab Feed: la pantalla del tablón + la ficha pública de sede (al
// tocar un club en el feed). Mismo patrón que ProfileStack (wrapper de un
// screen para evitar el bug de mount de v7 bottom-tabs).
const Stack = createNativeStackNavigator();

export const FeedStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      animation: 'none',
    }}
  >
    <Stack.Screen name="FeedRoot" component={FeedScreen} />
    <Stack.Screen name="VenuePublic" component={VenuePublicScreen} />
  </Stack.Navigator>
);
