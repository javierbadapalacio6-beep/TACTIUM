import React from 'react';

/**
 * Antes constreñía la app a una columna centrada (maxWidth 720) en
 * tablet/iPad. Tras probarlo en iPad real se decidió que la app ocupe
 * TODO el ancho de la pantalla → ahora es un passthrough (full-bleed).
 *
 * Se conserva el componente como único punto de control: si en una Fase 2
 * se quiere volver a la columna centrada o a un layout master-detail,
 * basta con reimplementar aquí sin tocar `App.tsx` ni las pantallas.
 *
 *   import { useWindowDimensions, View, StyleSheet } from 'react-native';
 *   const { width } = useWindowDimensions();
 *   if (width >= 700) return <View style={...centrado, maxWidth:720...}>{children}</View>;
 */
export function ResponsiveFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
