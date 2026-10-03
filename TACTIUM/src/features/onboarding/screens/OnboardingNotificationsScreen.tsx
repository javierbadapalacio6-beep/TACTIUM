import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import {
  getPushPermission,
  markPushPromptSeen,
  registerForPushNotifications,
} from '@core/push';
import { OnboardingProgress } from '@features/onboarding/components/OnboardingProgress';

import type {
  OnboardingStackScreenProps,
  RootStackScreenProps,
} from '@navigation/types';

// Pedir los avisos cuando se entienden: en vez de la alerta que saltaba nada
// más iniciar sesión, una pantalla que enseña lo que va a llegar (la
// convocatoria con Voy/Duda/No) y solo entonces abre el diálogo del sistema.
// La misma vista sirve para el paso 3 del onboarding (con barra) y para el
// modal `PushPrompt` que ven una vez quienes no pasan por el onboarding de
// equipo (jugadores invitados, cuentas que ya existían).

const T_PUSH = 260;
const T_ACTIONS = 760;

const NotificationsPrompt: React.FC<{
  withProgress: boolean;
  onDone: () => void;
}> = ({ withProgress, onDone }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // Si el permiso ya está decidido (concedido o denegado) o no es un
  // dispositivo real, no hay nada que pedir: se termina sin enseñar nada.
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (userId) await markPushPromptSeen(userId);
    onDone();
  };

  useEffect(() => {
    let alive = true;
    getPushPermission()
      .then(async (status) => {
        if (!alive) return;
        if (status === 'undetermined') {
          setChecking(false);
          return;
        }
        // Concedido de antes: refrescamos el token por si acaso (no pregunta).
        if (status === 'granted' && userId) {
          await registerForPushNotifications(userId).catch(() => {});
        }
        if (alive) await finish();
      })
      .catch(() => {
        if (alive) void finish();
      });
    return () => {
      alive = false;
    };
    // Solo al montar: `finish` cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = async () => {
    if (busy) return;
    setBusy(true);
    if (userId) {
      await registerForPushNotifications(userId).catch(() => ({ granted: false }));
    }
    setBusy(false);
    await finish();
  };

  // La notificación baja desde arriba con muelle y, un instante después, se
  // despliegan sus acciones. Una sola vez, sin bucles.
  const drop = useSharedValue(reduced ? 1 : 0);
  const open = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (checking || reduced) return;
    drop.value = withDelay(T_PUSH, withSpring(1, { damping: 15, stiffness: 140 }));
    open.value = withDelay(T_ACTIONS, withSpring(1, { damping: 18, stiffness: 160 }));
  }, [checking, reduced, drop, open]);

  const pushStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 1.4),
    transform: [{ translateY: (1 - drop.value) * -70 }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, open.value),
    transform: [
      { translateY: (1 - open.value) * -14 },
      { scaleY: 0.85 + 0.15 * open.value },
    ],
  }));

  if (checking) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const enter = (delay: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(delay).duration(380).easing(Easing.out(Easing.cubic));

  return (
    <View style={styles.root}>
      <AmbientBackdrop intensity={0.6} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {withProgress ? <OnboardingProgress step={3} /> : null}

        <Animated.View entering={enter(60)} style={styles.intro}>
          <Text style={styles.title}>Que te avisen, no perseguir</Text>
          <Text style={styles.lede}>
            Así llegan las convocatorias. Tus jugadores responden sin abrir la
            app.
          </Text>
        </Animated.View>

        {/* Notificación de ejemplo (datos fijos) */}
        <Animated.View style={[styles.push, pushStyle]}>
          <View style={styles.pushHead}>
            <View style={styles.appIcon}>
              <TactiumMark size={12} />
            </View>
            <Text style={styles.pushApp}>TACTIUM · ahora</Text>
          </View>
          <Text style={styles.pushTitle}>Jornada 6 · sáb 10:00 vs Arenal</Text>
          <Text style={styles.pushBody}>¿Puedes jugar?</Text>
        </Animated.View>

        <Animated.View style={[styles.actions, actionsStyle]}>
          <Text style={[styles.action, { color: c.accent }]}>Voy</Text>
          <Text style={[styles.action, styles.actionDivider, { color: c.warning }]}>
            Duda
          </Text>
          <Text style={[styles.action, styles.actionDivider, { color: c.error }]}>
            No puedo
          </Text>
        </Animated.View>

        <Animated.Text entering={enter(T_ACTIONS + 200)} style={styles.also}>
          También: alineación publicada, recordatorios y resultados.
        </Animated.Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          onPress={activate}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && !busy && { opacity: 0.85 }]}
        >
          {busy ? (
            <ActivityIndicator color={c.textInverse} />
          ) : (
            <Text style={styles.ctaLabel}>Activar avisos</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => void finish()}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.laterLabel}>Ahora no</Text>
        </Pressable>
      </View>
    </View>
  );
};

/** Paso 3 del onboarding (capitán y club). Termina el onboarding. */
export const OnboardingNotificationsScreen = (
  _props: OnboardingStackScreenProps<'OnboardingNotifications'>,
) => {
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);
  return <NotificationsPrompt withProgress onDone={finishOnboarding} />;
};

/** Modal de una sola vez en la app (sin barra). Se cierra al decidir. */
export const PushPromptScreen = ({
  navigation,
}: RootStackScreenProps<'PushPrompt'>) => {
  return (
    <NotificationsPrompt
      withProgress={false}
      onDone={() => {
        if (navigation.canGoBack()) navigation.goBack();
      }}
    />
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      gap: 14,
    },
    intro: {
      marginTop: 10,
      marginBottom: 6,
    },
    title: {
      color: c.text,
      fontSize: 30,
      lineHeight: 33,
      fontWeight: '700',
      letterSpacing: -0.7,
    },
    lede: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 21,
      marginTop: 8,
    },
    push: {
      backgroundColor: c.bgCard2,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    pushHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    appIcon: {
      width: 20,
      height: 20,
      borderRadius: 6,
      backgroundColor: '#030F0F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pushApp: {
      color: c.textMuted,
      fontSize: 12,
    },
    pushTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 6,
    },
    pushBody: {
      color: c.text,
      fontSize: 14,
      marginTop: 2,
      opacity: 0.9,
    },
    actions: {
      backgroundColor: c.bgCard2,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
      marginTop: -6,
    },
    action: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: '600',
    },
    actionDivider: {
      borderTopWidth: 1,
      borderTopColor: c.hairStrong,
    },
    also: {
      color: c.textFaint,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 6,
    },
    cta: {
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaLabel: {
      color: c.textInverse,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    later: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    laterLabel: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
  });

