import React from 'react';
import { View } from 'react-native';

import { Colors } from '@core/theme/colors';

export const NeonDot: React.FC<{ size?: number; color?: string }> = ({
  size = 6,
  color = Colors.accent,
}) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.95,
        shadowRadius: size * 1.4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      }}
    />
  );
};
