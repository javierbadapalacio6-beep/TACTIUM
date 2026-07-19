import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useColors } from '@core/theme';

interface Props {
  intensity?: number;
}

export const AmbientBackdrop: React.FC<Props> = ({ intensity = 1 }) => {
  const c = useColors();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 800">
        <Defs>
          <RadialGradient id="g1" cx="50%" cy="22%" r="60%">
            <Stop
              offset="0%"
              stopColor={c.primary}
              stopOpacity={0.55 * intensity}
            />
            <Stop offset="100%" stopColor={c.background} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="g2" cx="22%" cy="86%" r="55%">
            <Stop
              offset="0%"
              stopColor={c.accent}
              stopOpacity={0.18 * intensity}
            />
            <Stop offset="100%" stopColor={c.background} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="800" fill="url(#g1)" />
        <Rect x="0" y="0" width="400" height="800" fill="url(#g2)" />
      </Svg>
    </View>
  );
};
