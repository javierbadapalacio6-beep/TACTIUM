import React from 'react';
import { View } from 'react-native';

import { useColors } from '@core/theme';

export const NeonDot: React.FC<{ size?: number; color?: string }> = ({
  size = 6,
  color,
}) => {
  const c = useColors();
  const dotColor = color ?? c.accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dotColor,
        shadowColor: dotColor,
        shadowOpacity: 0.95,
        shadowRadius: size * 1.4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      }}
    />
  );
};
