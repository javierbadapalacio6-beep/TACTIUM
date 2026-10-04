import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { LayoutMetrics } from '@components/ui/ResponsiveFrame';

export interface ContentColumnProps {
  children: React.ReactNode;
  /** Ancho máximo (por defecto 720). */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Columna centrada de máx. 720 px (Inicio en vertical, formularios, ajustes).
 * En móvil no hace nada visible: el teléfono es más estrecho que 720.
 * Úsala DENTRO del ScrollView para que el scroll siga ocupando toda la
 * pantalla:
 *
 *   <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
 *     <ContentColumn style={{ gap: 14, paddingHorizontal: 16 }}>…</ContentColumn>
 *   </ScrollView>
 */
export const ContentColumn: React.FC<ContentColumnProps> = ({
  children,
  maxWidth = LayoutMetrics.contentMax,
  style,
}) => (
  <View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, style]}>{children}</View>
);
