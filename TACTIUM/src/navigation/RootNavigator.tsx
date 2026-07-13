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
import { PaywallScreen } from '@features/subscription/screens/PaywallScreen';
import { SubscriptionScreen } from '@features/subscription/screens/SubscriptionScreen';
import { ClubBillingScreen } from '@features/subscription/screens/ClubBillingScreen';
import { MyDataScreen } from '@features/profile/screens/MyDataScreen';
import { MyStatsScreen } from '@features/profile/screens/MyStatsScreen';
import { CasualMatchDetailScreen } from '@features/profile/screens/CasualMatchDetailScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const team = useTeamStore((s) => s.team);
  const isOnboarding = useTeamStore((s) => s.isOnboarding);
  const soloMode = useTeamStore((s) => s.soloMode);
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

  const showMainTabs =
    isAuthenticated && (!!team || soloMode) && !isOnboarding;

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
        ) : !showMainTabs ? (
          <Stack.Screen name="OnboardingFlow" component={OnboardingStack} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            {/* Modales de suscripción presentados sobre las tabs.
                `presentation:'modal'` da la animación slide-up nativa y
                permite gesto de cierre por swipe-down en iOS. */}
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{
                // `fullScreenModal` cubre completamente la pantalla anterior
                // (no se ve el screen detrás como con `modal` en iOS, evitando
                // el efecto de fondo transparente solapado).
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="ClubBilling"
              component={ClubBillingScreen}
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="MyData"
              component={MyDataScreen}
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="MyStats"
              component={MyStatsScreen}
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="CasualMatchDetail"
              component={CasualMatchDetailScreen}
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
          </>
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
