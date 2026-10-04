import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@core/theme/useColors';
import type { Palette } from '@core/theme/colors';
import { LayoutMetrics, useLayout } from '@components/ui/ResponsiveFrame';

/** Ancho mínimo que debe quedar para el detalle para partir en dos. */
const DEFAULT_MIN_DETAIL = 420;

/**
 * true si la pantalla debe pintarse partida (lista + detalle). Úsalo para
 * decidir qué hace un toque en la lista: en split se SELECCIONA (estado
 * local), en stack se NAVEGA como en el móvil.
 */
export function useIsSplit(
  listWidth: number = LayoutMetrics.splitList,
  minDetailWidth: number = DEFAULT_MIN_DETAIL,
): boolean {
  const { isTablet, contentWidth } = useLayout();
  return isTablet && contentWidth >= listWidth + minDetailWidth;
}

export interface SplitViewProps {
  /** Columna izquierda (lista). Ocupa todo el alto: que haga su propio scroll. */
  list: React.ReactNode;
  /** Detalle del elemento seleccionado. null → se pinta `emptyDetail`. */
  detail: React.ReactNode | null;
  /** Qué enseñar a la derecha si no hay nada seleccionado. */
  emptyDetail?: React.ReactNode;
  /**
   * Qué pintar cuando NO cabe partido (móvil o tablet vertical estrecha).
   * Por defecto, la propia `list`: la pantalla navega al detalle como hoy.
   */
  stack?: React.ReactNode;
  /** Ancho de la lista (por defecto 360). */
  listWidth?: number;
  /** Ancho mínimo del detalle para partir (por defecto 420). */
  minDetailWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Lista (360) + detalle. En móvil o tablet vertical estrecha cae a `stack`.
 *
 *   function JornadasScreen({ navigation }) {
 *     const split = useIsSplit();
 *     const [selId, setSelId] = useState<string | null>(null);
 *     const onPick = (id: string) =>
 *       split ? setSelId(id) : navigation.navigate('Jornada', { id });
 *     return (
 *       <SplitView
 *         list={<JornadaList selectedId={split ? selId : null} onPick={onPick} />}
 *         detail={selId ? <JornadaBody id={selId} /> : null}
 *         emptyDetail={<EmptyHint text="Elige una jornada" />}
 *       />
 *     );
 *   }
 *
 * En split conviene preseleccionar el primer elemento (p. ej. la próxima
 * jornada) para que el detalle no salga vacío.
 */
export const SplitView: React.FC<SplitViewProps> = ({
  list,
  detail,
  emptyDetail = null,
  stack,
  listWidth = LayoutMetrics.splitList,
  minDetailWidth = DEFAULT_MIN_DETAIL,
  style,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const split = useIsSplit(listWidth, minDetailWidth);

  if (!split) return <>{stack ?? list}</>;

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.list, { width: listWidth }]}>{list}</View>
      <View style={styles.detail}>{detail ?? emptyDetail}</View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: { flex: 1, flexDirection: 'row', backgroundColor: c.background },
    list: {
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.hairStrong,
      backgroundColor: c.background,
    },
    detail: { flex: 1, minWidth: 0 },
  });
