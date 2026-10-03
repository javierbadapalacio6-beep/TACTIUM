import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useReducedMotion,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Line } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { MARK_PATHS } from './TactiumMark';

interface Props {
  /** Se llama cuando la animación de salida termina (para desmontar). */
  onFinish: () => void;
  /**
   * La app ya puede enseñarse (sesión hidratada). La salida espera a que
   * sea true para no descubrir la app a medio pintar. Por defecto, true.
   */
  ready?: boolean;
}

type Mode = 'full' | 'short' | 'reduced';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const LOGO = 150;
const GLOW = 320;
const BALL = 12;
const VERSION_KEY = 'splash:fullVersion';

// Momentos clave (ms). La versión entera dura ≈2,5 s; la corta, ≈0,9 s.
const FULL = { impact: 1020, word: 1400, tag: 1700, exit: 2150 };
const SHORT = { impact: 60, word: 0, tag: 0, exit: 520 };
const EXIT_MS = 620;

// Desde dónde llega cada pieza del isotipo (en múltiplos del tamaño del
// logo). Mismo orden que MARK_PATHS: alas, detalles bajos, detalles medios
// y barra superior.
const FROM: [number, number][] = [
  [-0.55, 0.15],
  [0.55, 0.15],
  [-0.7, 0.3],
  [0.7, 0.3],
  [-0.8, 0],
  [0.8, 0],
  [0, -0.6],
];

/** Versión de la app: la animación entera sale una vez por versión. */
function appVersion(): string {
  return Constants.expoConfig?.version ?? 'dev';
}

/** Vibración ligera; si el módulo nativo no está (dev client viejo), nada. */
function tap(style: Haptics.ImpactFeedbackStyle) {
  try {
    Haptics.impactAsync(style).catch(() => {});
  } catch {
    // Sin módulo nativo: no vibra.
  }
}

function Glow() {
  return (
    <Svg width={GLOW} height={GLOW}>
      <Defs>
        <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={Colors.accent} stopOpacity={0.45} />
          <Stop offset="45%" stopColor={Colors.accent} stopOpacity={0.12} />
          <Stop offset="70%" stopColor={Colors.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#splashGlow)" />
    </Svg>
  );
}

/** Una línea de la pista que se dibuja de un extremo a otro. */
const CourtStroke: React.FC<{
  d?: string;
  line?: [number, number, number, number];
  length: number;
  delay: number;
  width: number;
  opacity: number;
}> = ({ d, line, length, delay, width, opacity }) => {
  const off = useSharedValue(length);
  useEffect(() => {
    off.value = withDelay(
      delay,
      withTiming(0, { duration: 650, easing: Easing.bezier(0.5, 0, 0.2, 1) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const props = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  const common = {
    stroke: Colors.accent,
    strokeWidth: width,
    strokeOpacity: opacity,
    strokeLinecap: 'round' as const,
    strokeDasharray: [length, length],
    fill: 'none',
    animatedProps: props,
  };
  return line ? (
    <AnimatedLine x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} {...common} />
  ) : (
    <AnimatedPath d={d} {...common} />
  );
};

/** Una pieza del isotipo que entra desde fuera y encaja con rebote. */
const MarkPiece: React.FC<{ d: string; index: number; delay: number; quick: boolean }> = ({
  d,
  index,
  delay,
  quick,
}) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      quick
        ? withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.6)) })
        : withSpring(1, { damping: 9, stiffness: 170, mass: 0.7 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [fx, fy] = FROM[index];
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.6),
    transform: [
      { translateX: (1 - p.value) * fx * LOGO * (quick ? 0.4 : 1) },
      { translateY: (1 - p.value) * fy * LOGO * (quick ? 0.4 : 1) },
      { scale: 0.6 + 0.4 * p.value },
    ],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={LOGO} height={LOGO} viewBox="0 0 1254 1254">
        <Path d={d} fill={Colors.accent} />
      </Svg>
    </Animated.View>
  );
};

const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&';

/** «TACTIUM» que se descifra letra a letra (mismo efecto que los reels). */
function useScramble(target: string, start: number | null, duration: number) {
  const [text, setText] = useState(start === null ? target : '');
  useEffect(() => {
    if (start === null) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      const t0 = Date.now();
      iv = setInterval(() => {
        const p = (Date.now() - t0) / duration;
        const n = Math.min(target.length, Math.floor(p * target.length * 1.15));
        let s = target.slice(0, n);
        for (let i = n; i < target.length; i++) {
          s += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
        }
        setText(p >= 1 ? target : s);
        if (p >= 1 && iv) clearInterval(iv);
      }, 40);
    }, start);
    return () => {
      clearTimeout(t);
      if (iv) clearInterval(iv);
    };
  }, [target, start, duration]);
  return text;
}

/**
 * Splash de marca, «la pista se enciende». Cubre la pantalla al arrancar:
 * se dibuja una pista en neón, entra una bola con estela y, donde golpea,
 * encajan las 7 piezas del isotipo (con vibración). TACTIUM se descifra y
 * la T crece hasta atravesar la pantalla, descubriendo la app que ya está
 * montada debajo.
 *
 * - Entera (≈2,5 s) en el primer arranque de cada versión; corta (≈0,9 s)
 *   el resto de veces. Un toque la salta.
 * - Con «Reducir movimiento», solo un fundido.
 * - JS puro (Reanimated + SVG): se puede iterar por OTA.
 */
export function AnimatedSplash({ onFinish, ready = true }: Props) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode | null>(null);

  // Decide el modo antes de pintar nada: mientras tanto sigue el splash
  // nativo (mismo fondo liso), así que no hay parpadeo.
  useEffect(() => {
    if (reduced) {
      setMode('reduced');
      return;
    }
    // En desarrollo, siempre entera: así se ve en cada recarga.
    if (__DEV__) {
      setMode('full');
      return;
    }
    let done = false;
    const v = appVersion();
    AsyncStorage.getItem(VERSION_KEY)
      .then((seen) => {
        if (done) return;
        setMode(seen === v ? 'short' : 'full');
        if (seen !== v) AsyncStorage.setItem(VERSION_KEY, v).catch(() => {});
      })
      .catch(() => !done && setMode('short'));
    return () => {
      done = true;
    };
  }, [reduced]);

  if (!mode) return <View style={[StyleSheet.absoluteFill, styles.root]} />;
  return <SplashTimeline mode={mode} ready={ready} onFinish={onFinish} />;
}

const SplashTimeline: React.FC<{ mode: Mode; ready: boolean; onFinish: () => void }> = ({
  mode,
  ready,
  onFinish,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const full = mode === 'full';
  const T = full ? FULL : SHORT;

  // ── Geometría de la pista (diseñada sobre 300×620, escalada a pantalla) ──
  const geo = useMemo(() => {
    const X = (f: number) => (f / 300) * W;
    const Y = (f: number) => (f / 620) * H;
    const quad = [X(70), Y(140), X(230), Y(140), X(290), Y(560), X(10), Y(560)];
    const outline = `M${quad[0]} ${quad[1]} L${quad[2]} ${quad[3]} L${quad[4]} ${quad[5]} L${quad[6]} ${quad[7]} Z`;
    const dist = (a: number, b: number, c: number, d: number) => Math.hypot(c - a, d - b);
    const outlineLen =
      dist(quad[0], quad[1], quad[2], quad[3]) +
      dist(quad[2], quad[3], quad[4], quad[5]) +
      dist(quad[4], quad[5], quad[6], quad[7]) +
      dist(quad[6], quad[7], quad[0], quad[1]);
    const lines: { l: [number, number, number, number]; w: number; o: number }[] = [
      { l: [X(27), H / 2, X(273), H / 2], w: 2.5, o: 0.75 }, // red
      { l: [X(52), Y(205), X(248), Y(205)], w: 1, o: 0.35 },
      { l: [X(2), Y(440), X(298), Y(440)], w: 1, o: 0.35 },
      { l: [W / 2, Y(205), W / 2, Y(440)], w: 1, o: 0.35 },
    ];
    // Trayectoria de la bola: curva desde abajo a la izquierda al centro.
    const b = { x0: X(30), y0: Y(600), cx: X(60), cy: Y(250), x1: W / 2, y1: H / 2 };
    const ballPath = `M${b.x0} ${b.y0} Q ${b.cx} ${b.cy} ${b.x1} ${b.y1}`;
    let ballLen = 0;
    let px = b.x0;
    let py = b.y0;
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const x = (1 - t) * (1 - t) * b.x0 + 2 * (1 - t) * t * b.cx + t * t * b.x1;
      const y = (1 - t) * (1 - t) * b.y0 + 2 * (1 - t) * t * b.cy + t * t * b.y1;
      ballLen += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    return { outline, outlineLen, lines, b, ballPath, ballLen };
  }, [W, H]);

  // ── Valores animados ──
  const court = useSharedValue(full ? 1 : 0);
  const ball = useSharedValue(0);
  const trail = useSharedValue(0);
  const ring = useSharedValue(0);
  const glow = useSharedValue(0);
  const bump = useSharedValue(1);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const exitP = useSharedValue(0);
  const root = useSharedValue(mode === 'reduced' ? 1 : 1);

  const [introDone, setIntroDone] = useState(false);
  const exiting = useRef(false);
  const word$ = useScramble('TACTIUM', full ? T.word : null, 520);

  const finish = useCallback(() => onFinish(), [onFinish]);

  const startExit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    if (mode === 'reduced') {
      root.value = withTiming(0, { duration: 450 }, (f) => {
        if (f) runOnJS(finish)();
      });
      return;
    }
    word.value = withTiming(0, { duration: 180 });
    tag.value = withTiming(0, { duration: 180 });
    glow.value = withTiming(0, { duration: 250 });
    exitP.value = withTiming(1, { duration: EXIT_MS, easing: Easing.bezier(0.6, 0, 0.3, 1) }, (f) => {
      if (f) runOnJS(finish)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, finish]);

  useEffect(() => {
    // Handoff con el splash nativo: este overlay ya pinta el mismo fondo.
    SplashScreen.hideAsync().catch(() => {});

    if (mode === 'reduced') {
      glow.value = 1;
      word.value = 1;
      const t = setTimeout(() => setIntroDone(true), 500);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    if (full) {
      // Bola con estela (0,48 s → impacto).
      const shot = { duration: 560, easing: Easing.bezier(0.45, 0, 0.7, 1) };
      ball.value = withDelay(480, withTiming(1, shot));
      trail.value = withDelay(480, withTiming(1, shot));
      // La pista se apaga a un 18 % tras el impacto.
      court.value = withDelay(825, withTiming(0.18, { duration: 675 }));
      word.value = withDelay(T.word, withTiming(1, { duration: 300 }));
      tag.value = withDelay(T.tag, withTiming(1, { duration: 500 }));
    } else {
      word.value = withTiming(1, { duration: 260 });
    }
    // Impacto: onda, glow y un pequeño golpe de escala en la T.
    ring.value = withDelay(T.impact, withTiming(1, { duration: 700, easing: Easing.bezier(0.1, 0.7, 0.3, 1) }));
    glow.value = withDelay(
      T.impact,
      withSequence(withTiming(1.3, { duration: 300 }), withTiming(1, { duration: 700 })),
    );
    bump.value = withDelay(
      T.impact + 30,
      withSequence(withTiming(1.06, { duration: 190 }), withTiming(1, { duration: 190 })),
    );
    timers.push(
      setTimeout(
        () => tap(full ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light),
        T.impact + 60,
      ),
    );
    timers.push(setTimeout(() => setIntroDone(true), T.exit));
    return () => {
      timers.forEach(clearTimeout);
      [court, ball, trail, ring, glow, bump, word, tag].forEach((v) => cancelAnimation(v));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La salida espera a la intro Y a que la app esté lista.
  useEffect(() => {
    if (introDone && ready) startExit();
  }, [introDone, ready, startExit]);

  // Un toque la salta (si la app ya está lista; si no, adelanta la intro).
  const skip = useCallback(() => {
    if (ready) startExit();
    else setIntroDone(true);
  }, [ready, startExit]);

  // ── Estilos animados ──
  const rootStyle = useAnimatedStyle(() => ({
    opacity:
      mode === 'reduced'
        ? root.value
        : exitP.value < 0.55
          ? 1
          : 1 - (exitP.value - 0.55) / 0.45,
  }));
  const courtStyle = useAnimatedStyle(() => ({ opacity: court.value }));
  const { b, ballLen } = geo;
  const ballStyle = useAnimatedStyle(() => {
    const t = ball.value;
    const x = (1 - t) * (1 - t) * b.x0 + 2 * (1 - t) * t * b.cx + t * t * b.x1;
    const y = (1 - t) * (1 - t) * b.y0 + 2 * (1 - t) * t * b.cy + t * t * b.y1;
    return {
      opacity: t > 0 && t < 1 ? 1 : 0,
      transform: [
        { translateX: x - BALL / 2 },
        { translateY: y - BALL / 2 },
        { scale: 1.4 - 0.6 * t },
      ],
    };
  });
  const trailProps = useAnimatedProps(() => ({
    strokeDashoffset: 0.35 * ballLen - trail.value * ballLen,
    strokeOpacity: trail.value > 0 && trail.value < 1 ? 1 : 0,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 ? 0.9 * (1 - ring.value) : 0,
    transform: [{ scale: 0.3 + 8.7 * ring.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, glow.value) * 0.85,
    transform: [{ scale: 0.4 + 0.75 * glow.value }],
  }));
  const markStyle = useAnimatedStyle(() => {
    // Salida: un leve retroceso (0,9) y después atraviesa la pantalla (×22).
    const e = exitP.value;
    const s = e < 0.18 ? 1 - (0.1 * e) / 0.18 : 0.9 + ((e - 0.18) / 0.82) * 21.1;
    return { transform: [{ scale: s * bump.value }] };
  });
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 10 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: (1 - tag.value) * 6 }],
  }));

  const pieceDelay = (i: number) => (full ? T.impact + (i === 6 ? 0 : 40 * i) : 30 * i);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Saltar animación"
      >
        {full && (
          <Animated.View style={[StyleSheet.absoluteFill, courtStyle]} pointerEvents="none">
            <Svg width={W} height={H}>
              <CourtStroke d={geo.outline} length={geo.outlineLen} delay={0} width={1.5} opacity={0.5} />
              {geo.lines.map((ln, i) => (
                <CourtStroke
                  key={i}
                  line={ln.l}
                  length={Math.hypot(ln.l[2] - ln.l[0], ln.l[3] - ln.l[1])}
                  delay={(i + 1) * 90}
                  width={ln.w}
                  opacity={ln.o}
                />
              ))}
            </Svg>
          </Animated.View>
        )}
        {full && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={W} height={H}>
              <AnimatedPath
                d={geo.ballPath}
                stroke="#eaffb0"
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={[0.35 * ballLen, ballLen]}
                animatedProps={trailProps}
              />
            </Svg>
            <Animated.View style={[styles.ball, ballStyle]} />
          </View>
        )}

        <View style={styles.center} pointerEvents="none">
          <Animated.View style={[styles.glow, glowStyle]}>
            <Glow />
          </Animated.View>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.mark, markStyle]}>
            {MARK_PATHS.map((d, i) =>
              mode === 'reduced' ? (
                <View key={i} style={StyleSheet.absoluteFill}>
                  <Svg width={LOGO} height={LOGO} viewBox="0 0 1254 1254">
                    <Path d={d} fill={Colors.accent} />
                  </Svg>
                </View>
              ) : (
                <MarkPiece key={i} d={d} index={i} delay={pieceDelay(i)} quick={!full} />
              ),
            )}
          </Animated.View>
          <Animated.View style={[styles.wordWrap, wordStyle]}>
            <Text style={styles.word}>{full ? word$ : 'TACTIUM'}</Text>
          </Animated.View>
          {full && (
            <Animated.View style={[styles.tagWrap, tagStyle]}>
              <Text style={styles.tag}>CREATE · ANALYZE · ELEVATE</Text>
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.background,
    zIndex: 100,
    elevation: 100,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: LOGO, height: LOGO },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
  },
  ring: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  ball: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    backgroundColor: '#eaffb0',
    shadowColor: '#d6ff78',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  // Texto colocado bajo la T sin mover el centro óptico del logo.
  wordWrap: { position: 'absolute', top: '50%', marginTop: LOGO / 2 + 26 },
  word: {
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 11,
    // El letterSpacing añade aire a la derecha; el margen lo compensa.
    marginLeft: 11,
  },
  tagWrap: { position: 'absolute', top: '50%', marginTop: LOGO / 2 + 64 },
  tag: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    letterSpacing: 3.5,
    marginLeft: 3.5,
  },
});
