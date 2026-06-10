import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Colors } from '../../core/theme/colors';

/** Ancho (en pt) a partir del cual tratamos la pantalla como "grande"
 *  (tablet / iPad). Los teléfonos —incluido el Pro Max (~430pt)— quedan
 *  por debajo; los iPad en vertical (≥744pt) por encima. */
export const LARGE_SCREEN_MIN = 700;

/** Ancho máximo de la columna de contenido en pantallas grandes. */
const CONTENT_MAX_WIDTH = 720;

/**
 * En teléfonos no hace nada (devuelve los hijos tal cual).
 *
 * En tablets/iPad centra TODA la app en una columna de ancho máximo sobre
 * el fondo de marca, evitando que los layouts flex se estiren de borde a
 * borde. Es la solución "phone-app en tablet" hecha a propósito: un único
 * punto de control en vez de retocar las ~24 pantallas. Se puede sustituir
 * por layouts master-detail en una Fase 2 sin tocar este contrato.
 */
export function ResponsiveFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (width < LARGE_SCREEN_MIN) return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
});
