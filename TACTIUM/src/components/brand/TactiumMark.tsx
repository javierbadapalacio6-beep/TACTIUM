import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Colors } from '@core/theme/colors';

interface Props {
  size?: number;
  gradient?: boolean;
}

export const TactiumMark: React.FC<Props> = ({ size = 28, gradient }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 28 28">
        <Defs>
          <LinearGradient id="tactiumMarkBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={Colors.primary} />
            <Stop offset="100%" stopColor={Colors.bgCard2} />
          </LinearGradient>
        </Defs>
        <Path
          d="M3 3h22a0 0 0 0 1 0 0v22a0 0 0 0 1 0 0H3a0 0 0 0 1 0 0V3z"
          fill={gradient ? 'url(#tactiumMarkBg)' : Colors.bgCard}
          stroke={Colors.accent + '60'}
          strokeWidth={1.2}
        />
        <Path
          d="M8.5 9.5h11M14 9.5v9.5"
          stroke={Colors.accent}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};
