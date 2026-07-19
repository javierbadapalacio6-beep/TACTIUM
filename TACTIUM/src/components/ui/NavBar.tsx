import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useColors, useTypography, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';

import { IconBack } from './Icon';

interface Props {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
}

export const NavBar: React.FC<Props> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Atrás',
  rightSlot,
}) => {
  const c = useColors();
  const t = useTypography();
  const styles = useMemo(() => makeStyles(c, t), [c, t]);
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 36 }} />
      )}
      <View style={styles.center}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      <View style={styles.right}>{rightSlot ?? <View style={{ width: 36 }} />}</View>
    </View>
  );
};

const makeStyles = (c: Palette, t: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 8,
    },
    backBtn: {
      height: 36,
      paddingHorizontal: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backLabel: {
      ...t.body,
      fontSize: 14,
      fontWeight: '500',
      color: c.text,
    },
    center: {
      alignItems: 'center',
      flex: 1,
    },
    subtitle: {
      ...t.eyebrowFaint,
      marginBottom: 2,
    },
    title: {
      ...t.title,
      color: c.text,
    },
    right: {
      minWidth: 36,
      alignItems: 'flex-end',
    },
  });
