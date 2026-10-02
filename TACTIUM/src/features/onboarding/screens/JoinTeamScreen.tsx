import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { AmbientBackdrop, IconBack } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { savePendingInviteCode } from '@core/services/pendingInvite';
import { JoinTeamPreview } from '@features/onboarding/components/JoinTeamPreview';

import type { RootStackScreenProps } from '@navigation/types';

/**
 * Destino del enlace de invitación `tactium.io/i/{CODE}` (y `tactium://i/{CODE}`).
 * Enseña la vista previa del equipo y deja unirse. Existe en las tres ramas del
 * navegador (sin sesión, onboarding y app): sin sesión guarda el código y, tras
 * entrar, `PendingInviteHandler` vuelve a abrir esta pantalla con él.
 */
export const JoinTeamScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'JoinTeam'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);

  const code = String(route.params?.code ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
  const complete = code.length === 8;

  // Sin sesión: guardamos el código ya, por si entra por otro camino.
  useEffect(() => {
    if (!isAuthenticated && complete) void savePendingInviteCode(code);
  }, [isAuthenticated, complete, code]);

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Abierto en frío desde el enlace: no hay pantalla anterior.
    const state = navigation.getState();
    const names = state.routeNames as string[];
    const home = (['MainTabs', 'OnboardingFlow', 'AuthFlow'] as const).find((n) =>
      names.includes(n),
    );
    if (home) navigation.navigate(home);
  };

  const goToLogin = () => {
    void savePendingInviteCode(code);
    navigation.navigate('AuthFlow');
  };

  return (
    <View style={styles.root}>
      <AmbientBackdrop intensity={0.6} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={leave}
          hitSlop={10}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <IconBack size={20} color={c.textMuted} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>INVITACIÓN DE EQUIPO</Text>
        <Text style={styles.title}>Únete a tu equipo</Text>
        <Text style={styles.code}>Código {complete ? code : '—'}</Text>

        {complete ? (
          <JoinTeamPreview
            code={code}
            onLoginRequired={goToLogin}
            onJoined={() => {
              // Si veníamos del onboarding, la raíz cambia sola a la app.
              if (navigation.getState().routeNames.includes('MainTabs')) {
                navigation.navigate('MainTabs');
              }
            }}
            onGoToTeam={(teamId) => {
              void setActiveTeam(teamId).catch(() => {});
              finishOnboarding();
              if (navigation.getState().routeNames.includes('MainTabs')) {
                navigation.navigate('MainTabs');
              }
            }}
          />
        ) : (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Código no válido</Text>
            <Text style={styles.errorBody}>
              El enlace no trae un código de 8 caracteres. Pide a tu capitán que
              te lo vuelva a enviar.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingTop: 12 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.6,
      marginTop: 6,
    },
    code: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 12,
      letterSpacing: 1.5,
      marginTop: 6,
      marginBottom: 18,
    },
    errorCard: {
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.error,
      backgroundColor: c.bgCard,
      gap: 4,
    },
    errorTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    errorBody: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  });
