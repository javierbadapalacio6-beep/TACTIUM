import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useProfileStore } from '@store/profileStore';

import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { TabNavigator } from './TabNavigator';
import { NewUserStack } from './NewUserStack';
import { PlayerClaimGate } from '@features/onboarding/components/PlayerClaimGate';
import { PaywallScreen } from '@features/subscription/screens/PaywallScreen';
import { SubscriptionScreen } from '@features/subscription/screens/SubscriptionScreen';
import { ClubBillingScreen } from '@features/subscription/screens/ClubBillingScreen';
import { MyDataScreen } from '@features/profile/screens/MyDataScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboarding = useTeamStore((s) => s.isOnboarding);
  const hasLoadedOnce = useTeamStore((s) => s.hasLoadedOnce);
  const team = useTeamStore((s) => s.team);
  const activeRole = useTeamStore((s) => s.activeRole);
  const profileOnboarded = useProfileStore((s) => s.onboarded);

  // Mientras esté autenticado pero no haya terminado la primera carga del
  // teamStore NI se sepa si el perfil está completo (onboarded===null),
  // mostramos loader — así evitamos flashes entre feed / alta de perfil.
  if (isAuthenticated && (!hasLoadedOnce || profileOnboarded === null)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  // Alta del usuario nuevo (Fase 1d): si el perfil no está completo Y no tiene
  // equipo ni gestiona un club → elige tipo (jugador/club/sede). Los existentes
  // (onboarded=true backfill) o quien ya tiene equipo/club lo saltan. El flujo
  // "crear equipo/club" tiene prioridad (isOnboarding) porque se lanza DESDE
  // aquí (opción "gestiono un club").
  const needsProfileSetup =
    isAuthenticated &&
    profileOnboarded === false &&
    !team &&
    activeRole !== 'club_admin';

  const showMainTabs =
    isAuthenticated && hasLoadedOnce && !needsProfileSetup && !isOnboarding;

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
        ) : isOnboarding ? (
          <Stack.Screen name="OnboardingFlow" component={OnboardingStack} />
        ) : needsProfileSetup ? (
          <Stack.Screen name="NewUserFlow" component={NewUserStack} />
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
