import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { OnboardingChoiceScreen } from '@features/onboarding/screens/OnboardingChoiceScreen';
import { CreateClubScreen } from '@features/onboarding/screens/CreateClubScreen';
import { CreateTeamsForClubScreen } from '@features/onboarding/screens/CreateTeamsForClubScreen';
import { CreateTeamScreen } from '@features/onboarding/screens/CreateTeamScreen';
import { AddPlayersScreen } from '@features/onboarding/screens/AddPlayersScreen';
import { PaywallScreen } from '@features/subscription/screens/PaywallScreen';

import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="OnboardingChoice" component={OnboardingChoiceScreen} />
      <Stack.Screen name="CreateClub" component={CreateClubScreen} />
      <Stack.Screen name="CreateTeamsForClub" component={CreateTeamsForClubScreen} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} />
      <Stack.Screen name="AddPlayers" component={AddPlayersScreen} />
      {/* Paywall obligatorio entre creación del subject (club/team) y
          los pasos posteriores del onboarding (CreateTeamsForClub /
          AddPlayers). Reusa PaywallScreen — el componente detecta
          mode onboarding a partir de route.params.nextScreen. */}
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen as any}
        options={{
          // En onboarding mostramos el paywall como una pantalla normal
          // (no modal) para que no se vea OnboardingChoice debajo y el
          // usuario perciba el gate como parte del flow, no un overlay.
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};
