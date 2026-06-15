import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { AmbientBackdrop } from '@components/ui';
import { TactiumMark } from './TactiumMark';

interface Props {
  /** Se llama cuando la animación de salida termina (para desmontar). */
  onFinish: () => void;
}

const LOGO = 124;
const GLOW = 300;
const HOLD_MS = 1500; // tiempo que el logo permanece quieto antes de salir

/** Glow neón suave (radial) detrás del logo. */
function Glow() {
  return (
    <Svg width={GLOW} height={GLOW}>
      <Defs>
        <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={Colors.accent} stopOpacity={0.55} />
          <Stop offset="55%" stopColor={Colors.accent} stopOpacity={0.16} />
          <Stop offset="100%" stopColor={Colors.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#splashGlow)" />
    </Svg>
  );
}

/**
 * Splash animado de marca. Cubre la pantalla al arrancar: el isotipo entra
 * con un spring + un glow neón que late, el wordmark aparece debajo y todo
 * hace fade-out revelando la app. Es JS puro → se puede iterar por OTA.
 */
export function AnimatedSplash({ onFinish }: Props) {
  const logoScale = useSharedValue(0.66);
  const logoOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.55);
  const glowOpacity = useSharedValue(0);
  const wordOpacity = useSharedValue(0);
  const wordTranslate = useSharedValue(16);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Ocultamos el splash NATIVO ahora que el overlay animado ya pinta
    // (preventAutoHideAsync se llama en App.tsx) → handoff sin parpadeo.
    SplashScreen.hideAsync().catch(() => {});

    // Logo: fade + spring con leve overshoot
    logoOpacity.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 130, mass: 0.9 });

    // Glow: aparece y late suavemente
    glowOpacity.value = withDelay(120, withTiming(1, { duration: 560 }));
    glowScale.value = withDelay(
      120,
      withRepeat(
        withTiming(1.14, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );

    // Wordmark: fade + slide-up
    wordOpacity.value = withDelay(440, withTiming(1, { duration: 520 }));
    wordTranslate.value = withDelay(
      440,
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );

    // Salida: fade-out de todo tras el hold → onFinish
    const exitDelay = 440 + 520 + HOLD_MS;
    containerOpacity.value = withDelay(
      exitDelay,
      withTiming(
        0,
        { duration: 600, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onFinish)();
        },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordTranslate.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, containerStyle]}
    >
      <AmbientBackdrop intensity={1} />
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.glow, glowStyle]}>
            <Glow />
          </Animated.View>
          <Animated.View style={logoStyle}>
            <TactiumMark size={LOGO} gradient />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.word, wordStyle]}>TACTIUM</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: LOGO,
    height: LOGO,
  },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    marginTop: 30,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 11,
    // El letterSpacing añade aire a la derecha; un pequeño margen izq.
    // compensa para que quede ópticamente centrado.
    marginLeft: 11,
  },
});
