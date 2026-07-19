import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { NeonDot, Toggle } from '@components/ui';
import { TactiumMark } from '@components/brand/TactiumMark';

// Hook que anima un contador entero de 0 a `target` durante `duration`ms.
// Lo usamos para los stats de SeasonVisual (winRate %, jugadas, vict., etc.).
const useAnimatedCounter = (
  target: number,
  duration: number,
  delay = 0,
) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    let raf: number;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start - delay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic, sigue la regla del UX guide.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PlayerDotProps {
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
}

const PlayerDot: React.FC<PlayerDotProps> = ({
  cx,
  cy,
  dx,
  dy,
  duration,
  delay,
}) => {
  const c = useColors();
  const px = useSharedValue(cx);
  const py = useSharedValue(cy);

  useEffect(() => {
    px.value = withDelay(
      delay,
      withRepeat(
        withTiming(cx + dx, {
          duration,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
    py.value = withDelay(
      delay,
      withRepeat(
        withTiming(cy + dy, {
          duration: Math.round(duration * 0.85),
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
  }, [cx, cy, dx, dy, duration, delay, px, py]);

  const animatedProps = useAnimatedProps(() => ({
    cx: px.value,
    cy: py.value,
  }));

  return (
    <>
      <AnimatedCircle
        animatedProps={animatedProps}
        r={14}
        fill={c.accent}
        opacity={0.15}
      />
      <AnimatedCircle
        animatedProps={animatedProps}
        r={5}
        fill={c.accent}
      />
    </>
  );
};

const PLAYER_DOTS: PlayerDotProps[] = [
  { cx: 55, cy: 175, dx: 16, dy: -12, duration: 2600, delay: 0 },
  { cx: 235, cy: 175, dx: -16, dy: -12, duration: 2600, delay: 600 },
  { cx: 45, cy: 45, dx: 16, dy: 12, duration: 2600, delay: 200 },
  { cx: 225, cy: 50, dx: -16, dy: 12, duration: 2600, delay: 900 },
];

export const HeroVisual = () => {
  const c = useColors();
  const visualStyles = useMemo(() => makeVisualStyles(c), [c]);
  return (
  // Visual del slide 1. Pista de pádel con los 4 jugadores en movimiento
  // y el logo TACTIUM en el centro (donde antes ponía PLAN · ADAPT · WIN).
  <View style={{ width: 340, height: 268, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={340} height={268} viewBox="0 0 280 220">
      <Defs>
        <LinearGradient id="court" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={c.primary} stopOpacity="0.55" />
          <Stop offset="100%" stopColor={c.background} stopOpacity="0.3" />
        </LinearGradient>
      </Defs>
      <Rect
        x="20"
        y="14"
        width="240"
        height="180"
        rx="6"
        fill="url(#court)"
        stroke={c.accent}
        strokeOpacity={0.55}
        strokeWidth="1.2"
      />
      <Line x1="20" y1="104" x2="260" y2="104" stroke={c.accent} strokeOpacity={0.7} strokeWidth="1.2" strokeDasharray="4 4" />
      <Line x1="140" y1="60" x2="140" y2="104" stroke={c.accent} strokeOpacity={0.25} strokeWidth="1" />
      <Line x1="140" y1="104" x2="140" y2="148" stroke={c.accent} strokeOpacity={0.25} strokeWidth="1" />
      <Line x1="20" y1="60" x2="260" y2="60" stroke={c.accent} strokeOpacity={0.25} strokeWidth="1" />
      <Line x1="20" y1="148" x2="260" y2="148" stroke={c.accent} strokeOpacity={0.25} strokeWidth="1" />
      {PLAYER_DOTS.map((dot, i) => (
        <PlayerDot key={i} {...dot} />
      ))}
    </Svg>
    {/* Logo TACTIUM superpuesto en el centro de la pista. */}
    <View style={visualStyles.heroLogo} pointerEvents="none">
      <TactiumMark size={56} gradient />
    </View>
  </View>
  );
};

export const AvailVisual = () => {
  const c = useColors();
  const visualStyles = useMemo(() => makeVisualStyles(c), [c]);
  // Estado final: 3/4 disponibles. Los toggles parten todos en false y
  // van encendiéndose secuencialmente para simular que el capitán los
  // está pulsando uno a uno. El que termina en false (jugador 03) NO se
  // enciende — se queda apagado.
  const targets = [true, true, false, true];
  const [states, setStates] = useState<boolean[]>([false, false, false, false]);

  // Tras el mount, encendemos en orden los que SÍ deben quedar en true.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stepDelay = 500;
    const STEP_GAP = 320;
    targets.forEach((wantOn, i) => {
      if (!wantOn) return;
      timers.push(
        setTimeout(() => {
          setStates((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, stepDelay),
      );
      stepDelay += STEP_GAP;
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCount = states.filter(Boolean).length;
  const rows = [
    { name: 'Jugador 01', pts: '6.2' },
    { name: 'Jugador 02', pts: '5.8' },
    { name: 'Jugador 03', pts: '5.4' },
    { name: 'Jugador 04', pts: '5.1' },
  ];
  return (
    <View style={visualStyles.card}>
      <View style={visualStyles.cardHeader}>
        <Text style={visualStyles.eyebrow}>DISPONIBILIDAD</Text>
        <Text style={visualStyles.eyebrowAccent}>{onCount} / 4</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[
            visualStyles.row,
            i < rows.length - 1 && {
              borderBottomWidth: 1,
              borderColor: c.hair,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={visualStyles.numChip}>
              <Text style={visualStyles.numText}>
                {String(i + 1).padStart(2, '0')}
              </Text>
            </View>
            <View>
              <Text style={visualStyles.name}>{r.name}</Text>
              <Text style={visualStyles.meta}>{r.pts} PTS</Text>
            </View>
          </View>
          <Toggle value={states[i]} onChange={() => {}} size="sm" />
        </View>
      ))}
    </View>
  );
};

export const LineupVisual = () => {
  const c = useColors();
  const visualStyles = useMemo(() => makeVisualStyles(c), [c]);
  const pairs = [
    { a: '01', b: '02', sum: 12.0 },
    { a: '03', b: '04', sum: 10.5 },
    { a: '05', b: '06', sum: 9.2 },
    { a: '07', b: '08', sum: 8.4 },
    { a: '09', b: '10', sum: 7.1 },
  ];

  // Cada pareja se revela en orden. Dentro de cada pareja, el chip A,
  // luego el chip B, y por último la puntuación combinada — sensación
  // de "estamos seleccionando y calculando". Con 5 parejas reducimos el
  // step a 550ms para que la secuencia completa quede en ~2.6s.
  const REVEAL_DELAY = 400;
  const REVEAL_STEP = 550;
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    pairs.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => setRevealedCount(i + 1),
          REVEAL_DELAY + i * REVEAL_STEP,
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={visualStyles.card}>
      <View style={visualStyles.cardHeader}>
        <Text style={visualStyles.eyebrow}>ALINEACIÓN</Text>
        <View style={visualStyles.validBadge}>
          <NeonDot size={6} />
          <Text style={visualStyles.validBadgeText}>VÁLIDA</Text>
        </View>
      </View>
      {pairs.map((p, i) => {
        if (i >= revealedCount) return null;
        return (
          <Animated.View
            key={i}
            entering={FadeIn.duration(300).easing(Easing.out(Easing.cubic))}
            style={visualStyles.pairRow}
          >
            <View style={visualStyles.pairIdx}>
              <Text style={visualStyles.pairIdxText}>{i + 1}</Text>
            </View>
            <View style={visualStyles.pairChips}>
              <Animated.View
                entering={FadeIn.duration(220)
                  .delay(120)
                  .easing(Easing.out(Easing.cubic))}
                style={visualStyles.pairChip}
              >
                <Text style={visualStyles.pairChipText}>P{p.a}</Text>
              </Animated.View>
              <Animated.View
                entering={FadeIn.duration(220)
                  .delay(220)
                  .easing(Easing.out(Easing.cubic))}
                style={visualStyles.pairChip}
              >
                <Text style={visualStyles.pairChipText}>P{p.b}</Text>
              </Animated.View>
            </View>
            <Animated.Text
              entering={FadeIn.duration(260)
                .delay(380)
                .easing(Easing.out(Easing.cubic))}
              style={visualStyles.pairSum}
            >
              {p.sum.toFixed(1)}
            </Animated.Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

export const SeasonVisual = () => {
  const c = useColors();
  const visualStyles = useMemo(() => makeVisualStyles(c), [c]);
  const journeys = [
    { v: 'V', c: c.accent },
    { v: 'V', c: c.accent },
    { v: 'D', c: '#FF5C5C' },
    { v: 'V', c: c.accent },
    { v: 'E', c: '#FFB547' },
    { v: 'V', c: c.accent },
    { v: '·', c: c.textFaint },
    { v: '·', c: c.textFaint },
  ];

  // Cuenta cuántas jornadas se "han revelado" hasta el momento. Los stats
  // de abajo se calculan en base a las jornadas reveladas → la barra de
  // V/E/D y los contadores suben sincronizados con la aparición.
  const REVEAL_DELAY = 500;
  const REVEAL_STEP = 140;
  const [revealedCount, setRevealedCount] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    journeys.forEach((_, i) => {
      timers.push(
        setTimeout(() => setRevealedCount(i + 1), REVEAL_DELAY + i * REVEAL_STEP),
      );
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats por jornadas reveladas (saltan según se van encendiendo celdas).
  const revealedPlayed = Math.max(
    0,
    journeys.slice(0, revealedCount).filter((j) => j.v !== '·').length,
  );
  const revealedWins = journeys
    .slice(0, revealedCount)
    .filter((j) => j.v === 'V').length;
  const revealedDraws = journeys
    .slice(0, revealedCount)
    .filter((j) => j.v === 'E').length;
  const revealedLosses = journeys
    .slice(0, revealedCount)
    .filter((j) => j.v === 'D').length;

  // Win-rate (%) sube de 0 a 67 pasando por todos los enteros intermedios.
  // Duración generosa para que sea claramente perceptible. Empieza con el
  // primer reveal (delay 500ms).
  const finalWinRate = 67; // 4 victorias / 6 jugadas
  const winRate = useAnimatedCounter(finalWinRate, 1600, REVEAL_DELAY);

  return (
    <View style={visualStyles.card}>
      <View
        style={[
          visualStyles.cardHeader,
          { alignItems: 'flex-start' },
        ]}
      >
        <View>
          <Text style={visualStyles.eyebrow}>TEMPORADA 25/26</Text>
          <Text style={visualStyles.bigTitle}>2ª Categoría</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={visualStyles.winRate}>{winRate}%</Text>
          <Text style={visualStyles.winRateLabel}>VICTORIAS</Text>
        </View>
      </View>
      <View style={visualStyles.journeyGrid}>
        {journeys.map((j, i) =>
          i < revealedCount ? (
            <Animated.View
              key={i}
              entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))}
              style={[
                visualStyles.journeyCell,
                {
                  backgroundColor: j.v === '·' ? 'transparent' : j.c + '22',
                  borderColor: j.v === '·' ? c.hair : j.c + '70',
                },
              ]}
            >
              <Text style={[visualStyles.journeyText, { color: j.c }]}>
                {j.v}
              </Text>
            </Animated.View>
          ) : (
            // Placeholder vacío para que el grid no salte de tamaño mientras
            // se revelan las celdas.
            <View
              key={i}
              style={[
                visualStyles.journeyCell,
                {
                  backgroundColor: 'transparent',
                  borderColor: 'transparent',
                },
              ]}
            />
          ),
        )}
      </View>
      <View style={visualStyles.statsRow}>
        {[
          ['JUGADAS', revealedPlayed],
          ['VICT.', revealedWins],
          ['EMP.', revealedDraws],
          ['DERR.', revealedLosses],
        ].map(([l, v]) => (
          <View key={l as string} style={{ flex: 1 }}>
            <Text style={visualStyles.statValue}>{v}</Text>
            <Text style={visualStyles.statLabel}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Visual del slide del JUGADOR (F8): tarjeta de stats personales con el
// % de victorias animado y un resultado de amistoso debajo. Mismo
// lenguaje visual que MyStats — lo que verá de verdad dentro de la app.
export const CasualVisual = () => {
  const c = useColors();
  const visualStyles = useMemo(() => makeVisualStyles(c), [c]);
  const pct = useAnimatedCounter(71, 1000, 400);
  const dots: boolean[] = [true, true, false, true, true];
  return (
    <View style={visualStyles.casualWrap}>
      <View style={visualStyles.casualHero}>
        <View style={{ flex: 1 }}>
          <Text style={visualStyles.casualPct}>{pct}%</Text>
          <Text style={visualStyles.casualLabel}>DE VICTORIAS</Text>
        </View>
        <View style={visualStyles.casualDots}>
          {dots.map((w, i) => (
            <View
              key={i}
              style={[
                visualStyles.casualDot,
                { backgroundColor: w ? c.accent : '#ff6b6b' },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={visualStyles.casualRow}>
        <View style={visualStyles.casualBadge}>
          <Text style={visualStyles.casualBadgeTxt}>V</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={visualStyles.casualName}>vs Ruiz / Sanz</Text>
          <Text style={visualStyles.casualMeta}>con Marco · amistoso</Text>
        </View>
        <Text style={visualStyles.casualSets}>6-4 6-3</Text>
      </View>
      <View style={visualStyles.casualPill}>
        <Text style={visualStyles.casualPillTxt}>GRATIS PARA JUGADORES</Text>
      </View>
    </View>
  );
};

const makeVisualStyles = (c: Palette) => StyleSheet.create({
  casualWrap: {
    width: 300,
    alignSelf: 'center',
  },
  casualHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hairStrong,
    padding: 18,
  },
  casualPct: {
    color: c.accent,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  casualLabel: {
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 2,
  },
  casualDots: { flexDirection: 'row', gap: 5 },
  casualDot: { width: 9, height: 9, borderRadius: 5 },
  casualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.hair,
    padding: 12,
    marginTop: 10,
  },
  casualBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(0,255,170,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  casualBadgeTxt: { color: c.accent, fontSize: 12, fontWeight: '800' },
  casualName: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  casualMeta: { color: c.textFaint, fontSize: 11.5, marginTop: 1 },
  casualSets: { color: c.text, fontSize: 12.5, fontWeight: '700' },
  casualPill: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.accent10,
  },
  casualPillTxt: {
    color: c.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heroLogo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // El centro del campo (donde está la red) queda ~14px por encima del
    // centro geométrico del contenedor. Subimos el logo con paddingBottom
    // para que aterrice justo sobre la red.
    paddingBottom: 14,
  },
  card: {
    width: 290,
    padding: 16,
    borderRadius: 18,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 30 },
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: c.textFaint,
  },
  eyebrowAccent: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: c.accent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  numChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textMuted,
  },
  name: {
    color: c.text,
    fontSize: 13,
    fontWeight: '500',
  },
  meta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: c.accent15,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  validBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: c.accent,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.hair,
  },
  pairIdx: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairIdxText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  pairChips: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  pairChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  pairChipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.text,
  },
  pairSum: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: c.accent,
  },
  bigTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  winRate: {
    color: c.accent,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.mono,
    letterSpacing: -0.5,
  },
  winRateLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: c.textFaint,
    letterSpacing: 1,
  },
  journeyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  journeyCell: {
    width: (290 - 16 * 2 - 6 * 7) / 8,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 11,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: c.hair,
  },
  statValue: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: c.textFaint,
    letterSpacing: 1,
    marginTop: 2,
  },
});
