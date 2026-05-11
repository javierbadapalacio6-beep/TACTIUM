import React from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';

interface Props extends PressableProps {
  style?: ViewStyle | ViewStyle[];
  pressedOpacity?: number;
}

export const Pressed: React.FC<Props> = ({
  style,
  pressedOpacity = 0.7,
  children,
  ...rest
}) => {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        Array.isArray(style) ? style : [style],
        pressed && { opacity: pressedOpacity },
      ]}
    >
      {children}
    </Pressable>
  );
};
