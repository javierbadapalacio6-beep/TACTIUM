import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation';
import { Colors } from './src/core/theme/colors';
import { useAuthStore } from './src/store/authStore';
import { useTeamStore } from './src/store/teamStore';
import { useClubStore } from './src/store/clubStore';
import { useConnectionStore } from './src/store/connectionStore';
import { useSubscriptionStore } from './src/store/subscriptionStore';
import { configurePurchases, logOutPurchases } from './src/core/purchases';
import { ToastHost, OfflineBanner, ResponsiveFrame } from './src/components/ui';
import { TrialStartedModal } from './src/features/subscription/components/TrialStartedModal';

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.bgRaised,
    text: Colors.text,
    border: Colors.hair,
    primary: Colors.accent,
    notification: Colors.accent,
  },
};

export default function App() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const loadTeam = useTeamStore((s) => s.loadForUser);
  const resetTeam = useTeamStore((s) => s.reset);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const subscribePlayersRealtime = useTeamStore(
    (s) => s.subscribePlayersRealtime,
  );
  const unsubscribePlayersRealtime = useTeamStore(
    (s) => s.unsubscribePlayersRealtime,
  );
  const loadClubs = useClubStore((s) => s.loadForUser);
  const resetClubs = useClubStore((s) => s.reset);

  const initConnection = useConnectionStore((s) => s.init);
  const refreshSubs = useSubscriptionStore((s) => s.refresh);
  const subscribeSubsRealtime = useSubscriptionStore((s) => s.subscribeRealtime);
  const resetSubs = useSubscriptionStore((s) => s.reset);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    // Suscribe NetInfo. El propio store evita duplicar listeners si
    // el efecto se re-ejecuta (HMR).
    const unsub = initConnection();
    return unsub;
  }, [initConnection]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      let cancelled = false;
      (async () => {
        // RevenueCat primero (sincrónico, sin red): el SDK se configura
        // localmente con el userId de Supabase. Compras posteriores
        // quedan asociadas a este user en el backend de RC. Si más
        // tarde el user cambia (re-login con otra cuenta), el helper
        // hace `Purchases.logIn` internamente.
        configurePurchases(userId).catch((e) =>
          console.warn('configurePurchases failed', e),
        );

        // Esperamos a que zustand-persist hidrate el activeTeamId desde
        // AsyncStorage; si no, loadForUser puede leer null y caer al
        // fallback "primer equipo" perdiendo la selección del usuario.
        if (!useTeamStore.persist.hasHydrated()) {
          await new Promise<void>((resolve) => {
            const unsub = useTeamStore.persist.onFinishHydration(() => {
              unsub();
              resolve();
            });
          });
        }
        if (cancelled) return;
        // Clubs primero: teamStore.loadForUser lee clubStore para
        // derivar activeRole correctamente.
        await loadClubs();
        if (cancelled) return;
        await loadTeam();
        if (cancelled) return;
        // Subscriptions: refresh inicial + Realtime para que el cambio
        // de status (webhook → DB) repinte UI sin polling.
        await refreshSubs(userId);
        if (cancelled) return;
        subscribeSubsRealtime(userId);
      })();
      return () => {
        cancelled = true;
      };
    } else {
      // Logout: limpiar todos los stores + cerrar sesión en RC para que
      // el siguiente user que entre en este device no herede compras.
      logOutPurchases().catch(() => {});
      resetTeam();
      resetClubs();
      resetSubs();
    }
  }, [
    isAuthenticated,
    userId,
    loadTeam,
    resetTeam,
    loadClubs,
    resetClubs,
    refreshSubs,
    subscribeSubsRealtime,
    resetSubs,
  ]);

  // Realtime de players: cuando el team activo cambia (login, switch de
  // equipo en Profile, etc.) abrimos un canal Supabase filtrado por
  // team_id. Cualquier UPDATE en `players` — típicamente un jugador
  // marcándose (no) disponible desde otro dispositivo — refresca el
  // store y la UI del captain se actualiza al instante.
  useEffect(() => {
    if (!activeTeamId) {
      unsubscribePlayersRealtime();
      return;
    }
    subscribePlayersRealtime(activeTeamId);
    return () => {
      unsubscribePlayersRealtime();
    };
  }, [activeTeamId, subscribePlayersRealtime, unsubscribePlayersRealtime]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          {/* ResponsiveFrame: en teléfono es transparente; en tablet/iPad
              centra toda la app en una columna de ancho máximo sobre el
              fondo de marca para que los layouts no se estiren. */}
          <ResponsiveFrame>
            {isHydrating ? (
              <View style={styles.loader}>
                <ActivityIndicator color={Colors.accent} size="large" />
              </View>
            ) : (
              <RootNavigator />
            )}
            {/* Host de toasts y banner offline: flotan encima de cualquier
                pantalla. Van DENTRO del NavigationContainer para heredar
                el theme y respetar safe-area del provider. Banner ANTES
                del Toast en el árbol pero ambos absolute → orden no afecta
                al render, sí al stacking entre ellos (Toast queda encima
                porque su zIndex es mayor). */}
            <OfflineBanner />
            <ToastHost />
            {/* Modal one-shot que da la bienvenida al trial al detectar
                una sub trialing nueva (auto-creada por trigger DB tras
                crear primer club/team). */}
            <TrialStartedModal />
          </ResponsiveFrame>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
