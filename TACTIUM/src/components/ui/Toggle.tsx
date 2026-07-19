import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const Toggle: React.FC<Props> = ({
  value,
  onChange,
  size = 'md',
  disabled = false,
  accessibilityLabel,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const w = size === 'sm' ? 36 : 50;
  const h = size === 'sm' ? 22 : 30;
  const knob = h - 6;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onChange(!value);
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.track,
        {
          width: w,
          height: h,
          borderRadius: h / 2,
          backgroundColor: value ? c.accent : c.bgRaised,
          borderColor: value ? c.accent : c.hairStrong,
          alignItems: value ? 'flex-end' : 'flex-start',
          shadowOpacity: value ? 0.45 : 0,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View
        style={{
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          backgroundColor: value ? c.textInverse : c.text,
        }}
      />
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    track: {
      padding: 3,
      borderWidth: 1,
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
  });
