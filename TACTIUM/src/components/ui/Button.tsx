import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Typography } from '@core/theme/typography';
import { Radius } from '@core/theme/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'subtle';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
}) => {
  const isDisabled = disabled || isLoading;
  const labelColor =
    variant === 'primary'
      ? Colors.textInverse
      : variant === 'destructive'
      ? Colors.error
      : variant === 'secondary'
      ? Colors.accent
      : variant === 'subtle'
      ? Colors.text
      : Colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <View style={styles.content}>
          {iconLeft}
          <Text style={[styles.label, { color: labelColor } as TextStyle]}>
            {label}
          </Text>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primary: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  secondary: {
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  subtle: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...Typography.headline,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
