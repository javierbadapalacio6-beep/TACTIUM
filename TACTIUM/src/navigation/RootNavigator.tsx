import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';

import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { TabNavigator } from './TabNavigator';
import { PlayerClaimGate } from '@features/onboarding/components/PlayerClaimGate';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const team = useTeamStore((s) => s.team);
  const isOnboarding = useTeamStore((s) => s.isOnboarding);
  const hasLoadedOnce = useTeamStore((s) => s.hasLoadedOnce);
  const isLoading = useTeamStore((s) => s.isLoading);

  // Mientras esté autenticado pero el teamStore no haya terminado su primera
  // carga, mostramos loader. Si solo comprobamos `isLoading` aquí, hay un
  // frame inicial (justo tras el login) en el que team=null e isLoading=false
  // todavía, y el RootNavigator pinta OnboardingFlow → flash visual.
  if (isAuthenticated && !hasLoadedOnce) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const showMainTabs = isAuthenticated && !!team && !isOnboarding;

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="AuthFlow" component={AuthStack} />
        ) : !team || isOnboarding ? (
          <Stack.Screen name="OnboardingFlow" component={OnboardingStack} />
        ) : (
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        )}
      </Stack.Navigator>
      {showMainTabs ? <PlayerClaimGate /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
