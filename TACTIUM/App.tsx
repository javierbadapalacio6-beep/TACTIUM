import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplash } from './src/components/brand/AnimatedSplash';

// Evita que el splash NATIVO se auto-oculte: lo mantenemos hasta que el
// AnimatedSplash (overlay JS) esté montado y llame a hideAsync(), para un
// handoff sin parpadeo. Se llama a nivel de módulo (lo antes posible).
SplashScreen.preventAutoHideAsync().catch(() => {});

import { RootNavigator } from './src/navigation';
import { Colors } from './src/core/theme/colors';
import { useAuthStore } from './src/store/authStore';
import { useTeamStore } from './src/store/teamStore';
import { useClubStore } from './src/store/clubStore';
import { useConnectionStore } from './src/store/connectionStore';
import { useSubscriptionStore } from './src/store/subscriptionStore';
import { configurePurchases, logOutPurchases } from './src/core/purchases';
import { reconcileSubscriptionFromStore } from './src/core/services/subscriptions';
import { useProfileStore } from './src/store/profileStore';
import { useVenueStore } from './src/store/venueStore';
import { maybePromptForPush } from './src/core/push';
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
  // Overlay del splash animado: visible hasta que su animación de salida
  // termina. La app se monta debajo desde el principio (hidrata mientras).
  const [splashVisible, setSplashVisible] = useState(true);
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
  const loadProfile = useProfileStore((s) => s.load);
  const resetProfile = useProfileStore((s) => s.reset);
  const loadVenue = useVenueStore((s) => s.load);
  const resetVenue = useVenueStore((s) => s.reset);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // La app es vertical por defecto; solo pantallas concretas (la pizarra)
  // permiten rotar. Bloqueamos portrait al arrancar (no-op si el módulo
  // nativo no está en este binario).
  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
  }, []);

  // Backstop: si por lo que sea el AnimatedSplash no llegara a ocultar el
  // splash nativo, lo forzamos pasados unos segundos para no dejar la app
  // colgada en la pantalla de arranque. hideAsync es idempotente.
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);

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
        // Configura RC y, en cuanto está listo, RECONCILIA el estado real de
        // la tienda con la BD (auto-cura suscripciones que el webhook no
        // actualizó: conversión de prueba→pago, renovación...). No bloquea el
        // arranque; al terminar refresca el store para repintar la UI.
        configurePurchases(userId)
          .catch((e) => console.warn('configurePurchases failed', e))
          .then(() => reconcileSubscriptionFromStore())
          .then((n) => {
            if (!cancelled && n > 0) return refreshSubs(userId);
          })
          .catch((e) =>
            console.warn('reconcileSubscriptionFromStore failed', e),
          );

        // Perfil: carga el flag `onboarded` para el gate de alta de perfil
        // (Fase 1d). Fail-open dentro del store → nunca deja al usuario
        // colgado. No bloquea el resto del arranque.
        void loadProfile();
        // Sede propia: para que el TabNavigator adapte las tabs (Equipo → Mi
        // sede). No bloquea el arranque.
        void loadVenue(userId);

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
        if (cancelled) return;
        // Avisos push: priming + registro del token (no bloquea el arranque).
        void maybePromptForPush(userId);
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
      resetProfile();
      resetVenue();
    }
  }, [
    isAuthenticated,
    userId,
    loadProfile,
    resetProfile,
    loadVenue,
    resetVenue,
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
      {/* Splash animado por encima de todo. Se desmonta solo al terminar
          su fade-out. Va fuera del SafeAreaProvider para cubrir notch y
          home indicator a sangre completa. */}
      {splashVisible ? (
        <AnimatedSplash onFinish={() => setSplashVisible(false)} />
      ) : null}
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
