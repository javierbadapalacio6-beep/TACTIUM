import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useLayout, type LayoutMode } from '@components/ui/ResponsiveFrame';

export interface CardGridProps {
  children: React.ReactNode;
  /** Columnas por modo. Por defecto { phone: 1, tabletPortrait: 2, tabletLandscape: 3 }. */
  columns?: Partial<Record<LayoutMode, number>>;
  /** Separación horizontal y vertical (por defecto 12). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_COLUMNS: Record<LayoutMode, number> = {
  phone: 1,
  tabletPortrait: 2,
  tabletLandscape: 3,
};

/**
 * Rejilla de tarjetas de 2 o 3 columnas según el modo (1 en móvil).
 * Cada hijo es una celda; las celdas de una fila miden lo mismo y la
 * última fila se rellena con huecos para no estirar las tarjetas.
 *
 *   <CardGrid gap={14}>
 *     {teams.map((t) => <TeamCard key={t.id} team={t} />)}
 *   </CardGrid>
 *
 *   // Siempre 2 en tablet:
 *   <CardGrid columns={{ tabletLandscape: 2 }}>…</CardGrid>
 */
export const CardGrid: React.FC<CardGridProps> = ({ children, columns, gap = 12, style }) => {
  const { mode } = useLayout();
  const cols = Math.max(1, columns?.[mode] ?? DEFAULT_COLUMNS[mode]);
  const items = React.Children.toArray(children);

  if (cols === 1) {
    return <View style={[{ gap }, style]}>{items}</View>;
  }

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));

  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((child, i) => (
            <View key={i} style={{ flex: 1, minWidth: 0 }}>
              {child}
            </View>
          ))}
          {Array.from({ length: cols - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
};
