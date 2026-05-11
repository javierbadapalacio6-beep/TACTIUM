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
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const loadTeam = useTeamStore((s) => s.loadForUser);
  const resetTeam = useTeamStore((s) => s.reset);
  const loadClubs = useClubStore((s) => s.loadForUser);
  const resetClubs = useClubStore((s) => s.reset);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      let cancelled = false;
      (async () => {
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
      })();
      return () => {
        cancelled = true;
      };
    } else {
      resetTeam();
      resetClubs();
    }
  }, [isAuthenticated, loadTeam, resetTeam, loadClubs, resetClubs]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          {isHydrating ? (
            <View style={styles.loader}>
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          ) : (
            <RootNavigator />
          )}
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
