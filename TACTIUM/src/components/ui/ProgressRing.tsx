import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';

interface Props {
  pct: number;
  size?: number;
  stroke?: number;
}

export const ProgressRing: React.FC<Props> = ({ pct, size = 44, stroke = 4 }) => {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{
          transform: [{ rotate: '-90deg' }],
          position: 'absolute',
        }}
      >
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={Colors.bgRaised}
          strokeWidth={stroke}
          fill={Colors.bgCard}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={Colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          fill="transparent"
        />
      </Svg>
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 11,
          color: Colors.accent,
          fontWeight: '600',
        }}
      >
        {pct}%
      </Text>
    </View>
  );
};
