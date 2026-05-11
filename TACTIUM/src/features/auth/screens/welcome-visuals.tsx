import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { NeonDot, Toggle } from '@components/ui';

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
        fill={Colors.accent}
        opacity={0.15}
      />
      <AnimatedCircle
        animatedProps={animatedProps}
        r={5}
        fill={Colors.accent}
      />
    </>
  );
};

const PLAYER_DOTS: PlayerDotProps[] = [
  { cx: 55, cy: 175, dx: 22, dy: -16, duration: 2400, delay: 0 },
  { cx: 200, cy: 135, dx: -26, dy: -18, duration: 2800, delay: 600 },
  { cx: 80, cy: 80, dx: 28, dy: 14, duration: 3000, delay: 200 },
  { cx: 225, cy: 50, dx: -22, dy: 20, duration: 2600, delay: 900 },
];

export const HeroVisual = () => (
  <Svg width={280} height={220} viewBox="0 0 280 220">
    <Defs>
      <LinearGradient id="court" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.55" />
        <Stop offset="100%" stopColor={Colors.background} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Rect
      x="20"
      y="14"
      width="240"
      height="180"
      rx="6"
      fill="url(#court)"
      stroke={Colors.accent}
      strokeOpacity={0.55}
      strokeWidth="1.2"
    />
    <Line x1="20" y1="104" x2="260" y2="104" stroke={Colors.accent} strokeOpacity={0.7} strokeWidth="1.2" strokeDasharray="4 4" />
    <Line x1="140" y1="14" x2="140" y2="60" stroke={Colors.accent} strokeOpacity={0.25} strokeWidth="1" />
    <Line x1="140" y1="148" x2="140" y2="194" stroke={Colors.accent} strokeOpacity={0.25} strokeWidth="1" />
    <Line x1="20" y1="60" x2="260" y2="60" stroke={Colors.accent} strokeOpacity={0.25} strokeWidth="1" />
    <Line x1="20" y1="148" x2="260" y2="148" stroke={Colors.accent} strokeOpacity={0.25} strokeWidth="1" />
    <Path
      d="M 55 175 Q 140 105 225 50"
      fill="none"
      stroke={Colors.accent}
      strokeWidth="1.2"
      strokeDasharray="3 4"
      opacity={0.35}
    />
    {PLAYER_DOTS.map((dot, i) => (
      <PlayerDot key={i} {...dot} />
    ))}
    <Circle cx={140} cy={104} r="22" fill={Colors.background} stroke={Colors.accent} strokeOpacity={0.6} />
    <SvgText
      x={140}
      y={106}
      textAnchor="middle"
      fill={Colors.accent}
      fontFamily={Fonts.mono}
      fontSize="9"
    >
      PLAN
    </SvgText>
    <SvgText
      x={140}
      y={117}
      textAnchor="middle"
      fill={Colors.text}
      fontFamily={Fonts.mono}
      fontSize="7"
      opacity={0.6}
    >
      ADAPT · WIN
    </SvgText>
  </Svg>
);

export const AvailVisual = () => {
  const rows = [
    { name: 'Jugador 01', pts: '6.2', on: true },
    { name: 'Jugador 02', pts: '5.8', on: true },
    { name: 'Jugador 03', pts: '5.4', on: false },
    { name: 'Jugador 04', pts: '5.1', on: true },
  ];
  return (
    <View style={visualStyles.card}>
      <View style={visualStyles.cardHeader}>
        <Text style={visualStyles.eyebrow}>DISPONIBILIDAD</Text>
        <Text style={visualStyles.eyebrowAccent}>3 / 4</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[
            visualStyles.row,
            i < rows.length - 1 && {
              borderBottomWidth: 1,
              borderColor: Colors.hair,
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
          <Toggle value={r.on} onChange={() => {}} size="sm" />
        </View>
      ))}
    </View>
  );
};

export const LineupVisual = () => {
  const pairs = [
    { a: '01', b: '02', sum: 12.0 },
    { a: '03', b: '04', sum: 10.5 },
    { a: '05', b: '06', sum: 9.2 },
  ];
  return (
    <View style={visualStyles.card}>
      <View style={visualStyles.cardHeader}>
        <Text style={visualStyles.eyebrow}>ALINEACIÓN</Text>
        <View style={visualStyles.validBadge}>
          <NeonDot size={6} />
          <Text style={visualStyles.validBadgeText}>VÁLIDA</Text>
        </View>
      </View>
      {pairs.map((p, i) => (
        <View key={i} style={visualStyles.pairRow}>
          <View style={visualStyles.pairIdx}>
            <Text style={visualStyles.pairIdxText}>{i + 1}</Text>
          </View>
          <View style={visualStyles.pairChips}>
            {[p.a, p.b].map((n, j) => (
              <View key={j} style={visualStyles.pairChip}>
                <Text style={visualStyles.pairChipText}>P{n}</Text>
              </View>
            ))}
          </View>
          <Text style={visualStyles.pairSum}>{p.sum.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  );
};

export const SeasonVisual = () => {
  const journeys = [
    { v: 'V', c: Colors.accent },
    { v: 'V', c: Colors.accent },
    { v: 'D', c: '#FF5C5C' },
    { v: 'V', c: Colors.accent },
    { v: 'E', c: '#FFB547' },
    { v: 'V', c: Colors.accent },
    { v: '·', c: Colors.textFaint },
    { v: '·', c: Colors.textFaint },
  ];
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
          <Text style={visualStyles.winRate}>67%</Text>
          <Text style={visualStyles.winRateLabel}>VICTORIAS</Text>
        </View>
      </View>
      <View style={visualStyles.journeyGrid}>
        {journeys.map((j, i) => (
          <View
            key={i}
            style={[
              visualStyles.journeyCell,
              {
                backgroundColor: j.v === '·' ? 'transparent' : j.c + '22',
                borderColor: j.v === '·' ? Colors.hair : j.c + '70',
              },
            ]}
          >
            <Text style={[visualStyles.journeyText, { color: j.c }]}>{j.v}</Text>
          </View>
        ))}
      </View>
      <View style={visualStyles.statsRow}>
        {[
          ['JUGADAS', '6'],
          ['VICT.', '4'],
          ['EMP.', '1'],
          ['DERR.', '1'],
        ].map(([l, v]) => (
          <View key={l} style={{ flex: 1 }}>
            <Text style={visualStyles.statValue}>{v}</Text>
            <Text style={visualStyles.statLabel}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const visualStyles = StyleSheet.create({
  card: {
    width: 290,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
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
    color: Colors.textFaint,
  },
  eyebrowAccent: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.accent,
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
  name: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  meta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Colors.accent15,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  validBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.accent,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  pairIdx: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
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
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  pairChipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.text,
  },
  pairSum: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  bigTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  winRate: {
    color: Colors.accent,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.mono,
    letterSpacing: -0.5,
  },
  winRateLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textFaint,
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
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.hair,
  },
  statValue: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textFaint,
    letterSpacing: 1,
    marginTop: 2,
  },
});
