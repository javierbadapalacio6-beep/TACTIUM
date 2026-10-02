import React from 'react';
import { View, Text, Pressable } from 'react-native';

import type { Palette } from '@core/theme';
import { IconBack } from '@components/ui';
import type { SignupStyles } from './signupStyles';

// Cabecera fija de la inscripción. Sin torneo cargado: «TORNEO · Apuntarme».
// Con torneo: «PASO X DE 3 · nombre», título del paso y barra de 3 segmentos.
export const StepHeader: React.FC<{
  c: Palette;
  styles: SignupStyles;
  topInset: number;
  onExit: () => void;
  step: number | null;
  total?: number;
  tournamentName?: string;
  title: string;
}> = ({ c, styles, topInset, onExit, step, total = 3, tournamentName, title }) => (
  <View style={[styles.headerWrap, { paddingTop: topInset + 12 }]}>
    <View style={styles.header}>
      <Pressable
        onPress={onExit}
        hitSlop={10}
        accessibilityLabel="Salir"
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      >
        <IconBack size={20} color={c.text} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        {step != null ? (
          <Text style={styles.eyebrowStep} numberOfLines={1}>
            PASO {step} DE {total}
            {tournamentName ? ` · ${tournamentName.toUpperCase()}` : ''}
          </Text>
        ) : (
          <Text style={styles.eyebrow}>TORNEO</Text>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
    {step != null ? (
      <View style={styles.progressRow}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.progressSeg, i < step && styles.progressSegOn]} />
        ))}
      </View>
    ) : null}
  </View>
);
