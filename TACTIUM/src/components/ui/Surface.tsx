import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useColors } from '@core/theme';
import { Radius } from '@core/theme/spacing';

interface Props extends ViewProps {
  variant?: 'card' | 'raised' | 'flat';
  style?: ViewStyle | ViewStyle[];
}

export const Surface: React.FC<Props> = ({
  variant = 'card',
  style,
  children,
  ...rest
}) => {
  const c = useColors();
  const base: ViewStyle = {
    backgroundColor: variant === 'flat' ? 'transparent' : c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: variant === 'raised' ? c.hairStrong : c.hair,
  };
  return (
    <View style={[base, style as ViewStyle]} {...rest}>
      {children}
    </View>
  );
};
