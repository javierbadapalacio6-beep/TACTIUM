import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import type { Player } from '@store/teamStore';

import { BenchChip } from './LineupBench';
import { DraggableBenchItem } from './LineupDrag';
import type { BenchGroup, Selection } from './lineupLogic';

/**
 * TABLET · banquillo siempre a la vista, agrupado como la convocatoria.
 *
 *  · `column` (horizontal): columna fija a la derecha de las pistas, con
 *    Voy · Duda · Sin contestar · No uno debajo de otro.
 *  · `grid` (vertical): panel anclado abajo, una columna por grupo y sin
 *    desplazamiento horizontal. Los «Voy» solo salen si queda alguno.
 *
 * Se toca un jugador y luego un hueco (igual que en el móvil) o se arrastra
 * a la pista (`DraggableBenchItem`, solo si hay `LineupDragLayer`).
 */
interface Props {
  layout: 'column' | 'grid';
  jornada: number;
  groups: Record<BenchGroup, Player[]>;
  /** Cuántos «Voy» ya están en pista (para «9 en pista»). */
  yesPlaced: number;
  sel: Selection;
  disabled: boolean;
  draggable: boolean;
  onTap: (id: string) => void;
  isAnimating: (id: string) => boolean;
}

const LABEL: Record<BenchGroup, string> = {
  yes: 'VOY',
  maybe: 'DUDA',
  pending: 'SIN CONTESTAR',
  no: 'NO PUEDEN',
};

export const LineupBenchPanel: React.FC<Props> = ({
  layout,
  jornada,
  groups,
  yesPlaced,
  sel,
  disabled,
  draggable,
  onTap,
  isAnimating,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const slotSelected = sel?.kind === 'slot';
  const tint: Record<BenchGroup, string> = {
    yes: c.accent,
    maybe: c.warning,
    pending: c.textFaint,
    no: c.error,
  };

  const chip = (p: Player, g: BenchGroup) => {
    const selected = sel?.kind === 'bench' && sel.id === p.id;
    const node = (
      <BenchChip
        player={p}
        group={g}
        selected={selected}
        dimmed={g === 'no' || (sel != null && !selected)}
        animating={isAnimating(p.id)}
        disabled={disabled}
        onTap={() => onTap(p.id)}
      />
    );
    if (!draggable || disabled) return <View key={p.id}>{node}</View>;
    return (
      <DraggableBenchItem
        key={p.id}
        id={p.id}
        ghost={
          <BenchChip
            player={p}
            group={g}
            selected
            dimmed={false}
            animating={false}
            disabled
            onTap={() => {}}
          />
        }
      >
        {node}
      </DraggableBenchItem>
    );
  };

  const section = (g: BenchGroup, compact: boolean) => {
    const list = groups[g];
    if (g === 'yes' && list.length === 0) {
      if (compact || yesPlaced === 0) return null;
      return (
        <View key={g} style={styles.group}>
          <Text style={[styles.groupTitle, { color: tint.yes }]}>
            VOY · {yesPlaced} · todos colocados
          </Text>
        </View>
      );
    }
    if (list.length === 0 && compact) return null;
    return (
      <View key={g} style={[styles.group, compact && styles.gridCol]}>
        <Text style={[styles.groupTitle, { color: tint[g] }]}>
          {LABEL[g]} · {list.length}
        </Text>
        {list.length === 0 ? (
          <Text style={styles.empty}>Nadie</Text>
        ) : (
          list.map((p) => chip(p, g))
        )}
      </View>
    );
  };

  const head = (
    <View style={styles.head}>
      <Text style={[styles.title, slotSelected && { color: c.accent }]}>
        BANQUILLO · J{String(jornada).padStart(2, '0')}
      </Text>
      <Text style={[styles.title, slotSelected && { color: c.accent }]}>
        {disabled ? '' : slotSelected ? '↓ Toca uno' : draggable ? 'toca o arrastra' : 'toca uno'}
      </Text>
    </View>
  );

  const order: BenchGroup[] = ['yes', 'maybe', 'pending', 'no'];
  const nobody = order.every((g) => groups[g].length === 0);

  if (layout === 'column') {
    return (
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={[styles.column, slotSelected && { backgroundColor: c.accent10 }]}
      >
        {head}
        <ScrollView
          contentContainerStyle={styles.columnScroll}
          showsVerticalScrollIndicator={false}
        >
          {nobody ? (
            <Text style={styles.empty}>No queda nadie en el banquillo.</Text>
          ) : (
            order.map((g) => section(g, false))
          )}
        </ScrollView>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={(e) => e.stopPropagation()}
      style={[
        styles.grid,
        slotSelected && { borderTopColor: c.accent40, backgroundColor: c.accent10 },
      ]}
    >
      {head}
      {nobody ? (
        <Text style={[styles.empty, { paddingHorizontal: 16 }]}>
          No queda nadie en el banquillo.
        </Text>
      ) : (
        <ScrollView
          style={{ maxHeight: 220 }}
          contentContainerStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        >
          {order.map((g) => section(g, true))}
        </ScrollView>
      )}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    title: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.6,
      color: c.textFaint,
      fontWeight: '500',
    },
    column: {
      width: 272,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: c.hairStrong,
      backgroundColor: c.bgRaised,
      paddingTop: 14,
    },
    columnScroll: { paddingHorizontal: 12, paddingBottom: 24, gap: 14, paddingTop: 6 },
    group: { gap: 6 },
    groupTitle: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: '600',
    },
    empty: { color: c.textFaint, fontSize: 12 },
    grid: {
      borderTopWidth: 1,
      borderTopColor: c.hairStrong,
      backgroundColor: c.bgRaised,
      paddingTop: 10,
      gap: 6,
    },
    gridRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 6,
      alignItems: 'flex-start',
    },
    gridCol: { flex: 1, minWidth: 0 },
  });
