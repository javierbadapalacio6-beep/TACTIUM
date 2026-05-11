import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Typography } from '@core/theme/typography';
import { Radius } from '@core/theme/spacing';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: React.ReactNode;
  rightSlot?: React.ReactNode;
  leftAccent?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<Props> = ({
  label,
  hint,
  rightSlot,
  leftAccent,
  containerStyle,
  ...inputProps
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, containerStyle]}>
      {(label || hint) && (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {hint}
        </View>
      )}
      <View
        style={[
          styles.input,
          focused && {
            borderColor: Colors.accent40,
            backgroundColor: Colors.bgCard2,
          },
        ]}
      >
        {leftAccent ? <View style={styles.accentBar} /> : null}
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={Colors.textFaint}
          style={styles.field}
        />
        {rightSlot}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  label: {
    ...Typography.meta,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accentBar: {
    width: 5,
    height: 20,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  field: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Typography.body.fontFamily,
    paddingVertical: 0,
  },
});
