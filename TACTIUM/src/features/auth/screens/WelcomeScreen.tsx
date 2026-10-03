import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, IconGoogle, IconMail } from '@components/ui';
import { useAuthStore } from '@store/authStore';

import { useOAuthSignIn } from '../hooks/useOAuthSignIn';
import { AppleSignInButton } from '../components/AppleSignInButton';
import { LegalNote } from '../components/LegalNote';

import type { AuthStackScreenProps } from '@navigation/types';

// Bienvenida (primera vez sin sesión). Sustituye al carrusel de 5 diapositivas:
// el producto se enseña con una jornada dibujada (no una imagen) y los botones
// para entrar están en la misma pantalla. Quien no quiere cuenta tiene
// «Explorar torneos sin cuenta», y quien vuelve sin sesión ya no pasa por aquí
// (`hasSeenWelcome` → PublicHome).

// Datos de ejemplo FIJOS de la tarjeta. No salen de la BD.
const PAIRS: { label: string; pts: string }[] = [
  { label: 'Pareja 1 · Gómez / Ruiz', pts: '1.240' },
  { label: 'Pareja 2 · Sainz / Díaz', pts: '1.105' },
  { label: 'Pareja 3 · Pérez / Lago', pts: '980' },
];

// Ritmo de la entrada: tarjeta → título → botones. Sutil y una sola vez.
const T_CARD = 80;
const T_TITLE = 260;
const T_BUTTONS = 420;
// Dentro de la tarjeta: «Voy» se enciende, el contador sube a 8/10 y luego
// entran las parejas una a una.
const T_VOY = 900;
const T_PAIRS = 1150;
const PAIR_STEP = 110;

const fadeDown = (delay: number) =>
  FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic));

export const WelcomeScreen = ({
  navigation,
}: AuthStackScreenProps<'Welcome'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const markWelcomeSeen = useAuthStore((s) => s.markWelcomeSeen);
  const { busy, handleApple, handleGoogle } = useOAuthSignIn();

  // Cualquier salida de la bienvenida la da por vista: la próxima vez sin
  // sesión se entra directo a Explorar, como antes con el carrusel.
  const leave = (fn: () => void) => () => {
    markWelcomeSeen();
    fn();
  };

  const enter = (delay: number) => (reduced ? undefined : fadeDown(delay));

  return (
    <View style={styles.root}>
      <AmbientBackdrop intensity={0.6} />

      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brand}>
          <TactiumMark size={22} gradient />
          <Text style={styles.wordmark}>TACTIUM</Text>
        </View>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          onPress={leave(() =>
            navigation.navigate('Login', { mode: 'email', tab: 'signin' }),
          )}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={styles.haveAccount}>Ya tengo cuenta</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(T_CARD)}>
          <MatchdayPreview reduced={reduced} />
        </Animated.View>

        <Animated.View entering={enter(T_TITLE)} style={styles.copy}>
          <Text style={styles.title}>Convoca, alinea y cierra la jornada.</Text>
          <Text style={styles.lede}>
            Tu equipo de pádel, sin Excel ni grupos de 80 mensajes.
          </Text>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={enter(T_BUTTONS)}
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        {Platform.OS === 'ios' ? (
          <AppleSignInButton
            onPress={leave(handleApple)}
            loading={busy === 'apple'}
            disabled={!!busy}
          />
        ) : null}

        <Pressable
          onPress={leave(handleGoogle)}
          disabled={!!busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.ghostBtn,
            pressed && { opacity: 0.85 },
            !!busy && busy !== 'google' && { opacity: 0.6 },
          ]}
        >
          {busy === 'google' ? (
            <ActivityIndicator size="small" color={c.text} />
          ) : (
            <>
              <IconGoogle size={18} />
              <Text style={styles.ghostLabel}>Continuar con Google</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={leave(() =>
            navigation.navigate('Login', { mode: 'email', tab: 'signup' }),
          )}
          disabled={!!busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}
        >
          <IconMail size={18} color={c.text} />
          <Text style={styles.ghostLabel}>Continuar con email</Text>
        </Pressable>

        <Pressable
          onPress={leave(() => navigation.replace('PublicHome'))}
          hitSlop={8}
          accessibilityRole="link"
          style={({ pressed }) => [styles.exploreBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.exploreText}>Explorar torneos sin cuenta →</Text>
        </Pressable>

        <LegalNote />
      </Animated.View>
    </View>
  );
};

/**
 * Tarjeta de una jornada de ejemplo dibujada con componentes. Cuenta la
 * historia del producto en un segundo: alguien dice «Voy», el contador pasa
 * de 7/10 a 8/10 y aparecen las parejas por puntos.
 */
const MatchdayPreview: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [going, setGoing] = useState(reduced ? 8 : 7);
  const voy = useSharedValue(reduced ? 1 : 0);
  const pill = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    voy.value = withDelay(
      T_VOY,
      withSpring(1, { damping: 14, stiffness: 180, mass: 0.8 }),
    );
    // El contador sube justo después del toque en «Voy».
    const id = setTimeout(() => {
      setGoing(8);
      pill.value = withSequence(
        withTiming(1.08, { duration: 140 }),
        withSpring(1, { damping: 12, stiffness: 220 }),
      );
    }, T_VOY + 160);
    return () => clearTimeout(id);
  }, [reduced, voy, pill]);

  const voyStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      voy.value,
      [0, 1],
      ['transparent', c.accent],
    ),
    borderColor: interpolateColor(voy.value, [0, 1], [c.hairStrong, c.accent]),
    // Pequeño «clic»: se encoge un poco y vuelve con el muelle (el rebote
    // del spring pasa de 1 y da el golpecito final).
    transform: [{ scale: interpolate(voy.value, [0, 0.4, 1], [1, 0.9, 1]) }],
  }));
  const voyLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(voy.value, [0, 1], [c.textMuted, c.textInverse]),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pill.value }],
  }));

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardEyebrow}>JORNADA 6 · SÁB 10:00</Text>
        <Animated.View style={[styles.pill, pillStyle]}>
          <Text style={styles.pillText}>{going}/10 van</Text>
        </Animated.View>
      </View>

      <View style={styles.vs}>
        <View style={[styles.crest, styles.crestUs]}>
          <Text style={[styles.crestText, { color: c.accent }]}>SMA</Text>
        </View>
        <Text style={styles.teamName}>Smash A</Text>
        <Text style={styles.vsText}>vs</Text>
        <View style={[styles.crest, styles.crestThem]}>
          <Text style={[styles.crestText, { color: c.textMuted }]}>ARN</Text>
        </View>
        <Text style={styles.teamName}>Arenal</Text>
      </View>

      <View style={styles.rsvp}>
        <Animated.View style={[styles.rsvpBtn, voyStyle]}>
          <Animated.Text style={[styles.rsvpText, voyLabelStyle]}>Voy</Animated.Text>
        </Animated.View>
        <View style={styles.rsvpBtn}>
          <Text style={styles.rsvpText}>Duda</Text>
        </View>
        <View style={styles.rsvpBtn}>
          <Text style={styles.rsvpText}>No</Text>
        </View>
      </View>

      <View style={styles.pairs}>
        {PAIRS.map((p, i) => (
          <Animated.View
            key={p.label}
            entering={
              reduced
                ? undefined
                : FadeIn.delay(T_PAIRS + i * PAIR_STEP).duration(320)
            }
            style={styles.pairRow}
          >
            <Text style={styles.pairLabel} numberOfLines={1}>
              {p.label}
            </Text>
            <Text style={styles.pairPts}>{p.pts}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    wordmark: {
      color: c.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 3,
      fontFamily: Fonts.sans,
    },
    haveAccount: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    body: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    copy: {
      marginTop: 26,
    },
    title: {
      color: c.text,
      fontSize: 30,
      lineHeight: 33,
      fontWeight: '700',
      letterSpacing: -0.8,
    },
    lede: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 21,
      marginTop: 10,
    },

    // ── Tarjeta de jornada ──────────────────────────────────────────
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 14,
      gap: 12,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '500',
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
    },
    pillText: {
      color: c.accent,
      fontSize: 11.5,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    vs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    crest: {
      width: 32,
      height: 32,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crestUs: {
      backgroundColor: c.accent15,
      borderColor: c.accent40,
    },
    crestThem: {
      backgroundColor: c.bgCard2,
      borderColor: c.hairStrong,
    },
    crestText: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      fontWeight: '800',
    },
    teamName: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    vsText: {
      color: c.textFaint,
      fontSize: 12,
      marginHorizontal: 2,
    },
    rsvp: {
      flexDirection: 'row',
      gap: 6,
    },
    rsvpBtn: {
      flex: 1,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rsvpText: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    pairs: {
      gap: 5,
    },
    pairRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: c.bgCard2,
    },
    pairLabel: {
      flex: 1,
      minWidth: 0,
      color: c.text,
      fontSize: 12.5,
    },
    pairPts: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },

    // ── Botones ─────────────────────────────────────────────────────
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 10,
    },
    ghostBtn: {
      height: 52,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    ghostLabel: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    exploreBtn: {
      alignSelf: 'center',
      paddingVertical: 6,
    },
    exploreText: {
      color: c.accent,
      fontSize: 14,
      fontWeight: '600',
    },
  });
