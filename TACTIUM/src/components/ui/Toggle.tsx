import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { Colors } from '@core/theme/colors';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const Toggle: React.FC<Props> = ({
  value,
  onChange,
  size = 'md',
  disabled = false,
}) => {
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
      style={[
        styles.track,
        {
          width: w,
          height: h,
          borderRadius: h / 2,
          backgroundColor: value ? Colors.accent : Colors.bgRaised,
          borderColor: value ? Colors.accent : Colors.hairStrong,
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
          backgroundColor: value ? Colors.textInverse : Colors.text,
        }}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    padding: 3,
    borderWidth: 1,
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
