import React, { useMemo, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useColors, useTypography, type Palette } from '@core/theme';
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
  const c = useColors();
  const t = useTypography();
  const styles = useMemo(() => makeStyles(c, t), [c, t]);
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
            borderColor: c.accent40,
            backgroundColor: c.bgCard2,
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
          placeholderTextColor={c.textFaint}
          style={styles.field}
        />
        {rightSlot}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette, t: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    label: {
      ...t.meta,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    input: {
      minHeight: 50,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    accentBar: {
      width: 5,
      height: 20,
      borderRadius: 3,
      backgroundColor: c.accent,
    },
    field: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontWeight: '500',
      fontFamily: t.body.fontFamily,
      paddingVertical: 0,
    },
  });
