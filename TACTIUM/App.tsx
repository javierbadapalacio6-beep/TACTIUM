import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
import { Colors, type Palette } from './src/core/theme/colors';
import { useColors, useResolvedScheme } from './src/core/theme/useColors';
import { useAuthStore } from './src/store/authStore';
import { useTeamStore } from './src/store/teamStore';
import { useClubStore } from './src/store/clubStore';
import { useConnectionStore } from './src/store/connectionStore';
import { useSubscriptionStore } from './src/store/subscriptionStore';
import { useNotificationStore } from './src/store/notificationStore';
import { configurePurchases, logOutPurchases } from './src/core/purchases';
import { maybePromptForPush } from './src/core/push';
import { ToastHost, OfflineBanner, ResponsiveFrame } from './src/components/ui';
import { TrialStartedModal } from './src/features/subscription/components/TrialStartedModal';

function makeNavTheme(c: Palette, isDark: boolean) {
  return {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      background: c.background,
      card: c.bgRaised,
      text: c.text,
      border: c.hair,
      primary: c.accent,
      notification: c.accent,
    },
  };
}

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

  const loadNotifications = useNotificationStore((s) => s.load);
  const subscribeNotifications = useNotificationStore((s) => s.subscribe);
  const resetNotifications = useNotificationStore((s) => s.reset);

  // Tema (claro/oscuro/sistema). navTheme y StatusBar reaccionan al modo
  // elegido en Ajustes. Las pantallas migradas usan useColors() directamente.
  const c = useColors();
  const scheme = useResolvedScheme();
  const navTheme = useMemo(
    () => makeNavTheme(c, scheme === 'dark'),
    [c, scheme],
  );

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

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
        if (cancelled) return;
        // Notificaciones in-app (campanita): carga inicial + realtime para
        // que el badge de no leídos suba en vivo.
        void loadNotifications();
        subscribeNotifications(userId);
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
      resetNotifications();
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
    loadNotifications,
    subscribeNotifications,
    resetNotifications,
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
    <GestureHandlerRootView style={[styles.root, { backgroundColor: c.background }]}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* ResponsiveFrame: en teléfono es transparente; en tablet/iPad
              centra toda la app en una columna de ancho máximo sobre el
              fondo de marca para que los layouts no se estiren. */}
          <ResponsiveFrame>
            {isHydrating ? (
              <View style={[styles.loader, { backgroundColor: c.background }]}>
                <ActivityIndicator color={c.accent} size="large" />
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
