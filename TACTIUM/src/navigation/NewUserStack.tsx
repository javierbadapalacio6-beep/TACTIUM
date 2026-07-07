import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { AccountTypeScreen } from '@features/onboarding/screens/AccountTypeScreen';
import { ProfileSetupScreen } from '@features/onboarding/screens/ProfileSetupScreen';
import { VenueSetupScreen } from '@features/onboarding/screens/VenueSetupScreen';

import type { NewUserStackParamList } from './types';

const Stack = createNativeStackNavigator<NewUserStackParamList>();

// Flujo de alta del usuario nuevo (Fase 1d): elige tipo → perfil / sede.
// "Club/equipo" no vive aquí: dispara isOnboarding y el RootNavigator cambia
// al OnboardingStack de crear equipo/club.
export const NewUserStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="AccountType" component={AccountTypeScreen} />
    <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    <Stack.Screen name="VenueSetup" component={VenueSetupScreen} />
  </Stack.Navigator>
);
