import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import type { Player } from '@store/teamStore';
import { shortName, initialsOf, photoOf } from '@core/utils/playerName';

import { LineupAvatar } from './LineupCourt';
import { fmtPts, type BenchGroup, type Selection } from './lineupLogic';

/**
 * Banquillo de la convocatoria: primero los que dijeron Voy (punto verde),
 * luego Duda (ámbar) y Sin contestar (discontinuo). Los «No» van plegados al
 * final; se pueden alinear, pero la pantalla avisa antes.
 */
interface Props {
  jornada: number;
  groups: Record<BenchGroup, Player[]>;
  sel: Selection;
  disabled: boolean;
  bottomInset: number;
  onTap: (id: string) => void;
  isAnimating: (id: string) => boolean;
}

export const LineupBench: React.FC<Props> = ({
  jornada,
  groups,
  sel,
  disabled,
  bottomInset,
  onTap,
  isAnimating,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [showNo, setShowNo] = useState(false);
  const slotSelected = sel?.kind === 'slot';
  const main = [
    ...groups.yes.map((p) => ({ p, g: 'yes' as const })),
    ...groups.maybe.map((p) => ({ p, g: 'maybe' as const })),
    ...groups.pending.map((p) => ({ p, g: 'pending' as const })),
  ];
  return (
    <Pressable
      onPress={(e) => e.stopPropagation()}
      style={[
        styles.tray,
        { paddingBottom: 8 + bottomInset },
        slotSelected && { borderTopColor: c.accent40, backgroundColor: c.accent10 },
      ]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, slotSelected && { color: c.accent }]}>
          BANQUILLO · CONVOCATORIA J{jornada}
        </Text>
        <Text style={[styles.title, slotSelected && { color: c.accent }]}>
          {slotSelected ? '↓ Toca uno' : disabled ? '' : 'Toca uno'}
        </Text>
      </View>
      {main.length === 0 ? (
        <Text style={styles.empty}>
          {groups.no.length > 0
            ? 'Los que van ya están en pista.'
            : 'No queda nadie en el banquillo.'}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {main.map(({ p, g }) => (
            <BenchChip
              key={p.id}
              player={p}
              group={g}
              selected={sel?.kind === 'bench' && sel.id === p.id}
              dimmed={sel != null && !(sel.kind === 'bench' && sel.id === p.id)}
              animating={isAnimating(p.id)}
              disabled={disabled}
              onTap={() => onTap(p.id)}
            />
          ))}
        </ScrollView>
      )}
      {groups.no.length > 0 ? (
        <View>
          <Pressable
            onPress={() => setShowNo((v) => !v)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: showNo }}
          >
            <Text style={styles.noToggle}>
              {groups.no.length} {groups.no.length === 1 ? 'no puede' : 'no pueden'} ·{' '}
              <Text style={{ color: c.textMuted }}>{showNo ? 'ocultar' : 'ver'}</Text>
            </Text>
          </Pressable>
          {showNo ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.chips, { paddingTop: 6 }]}
              >
                {groups.no.map((p) => (
                  <BenchChip
                    key={p.id}
                    player={p}
                    group="no"
                    selected={sel?.kind === 'bench' && sel.id === p.id}
                    dimmed
                    animating={isAnimating(p.id)}
                    disabled={disabled}
                    onTap={() => onTap(p.id)}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
};

export const BenchChip: React.FC<{
  player: Player;
  group: BenchGroup;
  selected: boolean;
  dimmed: boolean;
  animating: boolean;
  disabled: boolean;
  onTap: () => void;
}> = ({ player, group, selected, dimmed, animating, disabled, onTap }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const dot =
    group === 'yes'
      ? { backgroundColor: c.accent }
      : group === 'maybe'
        ? { backgroundColor: c.warning }
        : group === 'no'
          ? { backgroundColor: c.error }
          : { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: c.textFaint };
  const groupLabel =
    group === 'yes' ? 'Voy' : group === 'maybe' ? 'Duda' : group === 'no' ? 'No puede' : 'Sin contestar';
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        if (!disabled) onTap();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${player.name}, ${groupLabel}, ${player.pts} puntos`}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSel,
        dimmed && !selected && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={[styles.dot, dot]} />
      <LineupAvatar
        initials={initialsOf(player)}
        selected={selected}
        animating={animating}
        size={22}
        photoUrl={photoOf(player)}
      />
      <View>
        <Text style={styles.chipName} numberOfLines={1}>
          {shortName(player)}
        </Text>
        <Text style={styles.chipMeta}>
          {player.position} · {fmtPts(player.pts)}
        </Text>
      </View>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    tray: {
      borderTopWidth: 1,
      borderTopColor: c.hairStrong,
      backgroundColor: c.bgRaised,
      paddingTop: 10,
      gap: 8,
    },
    head: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    title: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.6,
      color: c.textFaint,
      fontWeight: '500',
    },
    chips: { paddingHorizontal: 16, gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 7,
      paddingRight: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    chipSel: { borderColor: c.accent, backgroundColor: c.accent15 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    chipName: { color: c.text, fontSize: 12.5, fontWeight: '600', maxWidth: 110 },
    chipMeta: { color: c.textFaint, fontSize: 10.5, fontFamily: Fonts.mono },
    empty: { color: c.textFaint, fontSize: 12.5, paddingHorizontal: 16 },
    noToggle: { color: c.textFaint, fontSize: 12, paddingHorizontal: 16 },
  });
