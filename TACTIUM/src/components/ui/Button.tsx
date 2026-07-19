import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { useColors, useTypography, type Palette } from '@core/theme';
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
  const c = useColors();
  const t = useTypography();
  const styles = useMemo(() => makeStyles(c, t), [c, t]);

  const isDisabled = disabled || isLoading;
  const labelColor =
    variant === 'primary'
      ? c.textInverse
      : variant === 'destructive'
      ? c.error
      : variant === 'secondary'
      ? c.accent
      : variant === 'subtle'
      ? c.text
      : c.text;

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

const makeStyles = (c: Palette, t: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
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
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    secondary: {
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    destructive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(255,107,107,0.4)',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    subtle: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    disabled: {
      opacity: 0.4,
    },
    label: {
      ...t.headline,
      fontSize: 16,
      letterSpacing: -0.2,
    },
  });
