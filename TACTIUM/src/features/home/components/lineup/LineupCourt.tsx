import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconTrash } from '@components/ui';
import type { Player } from '@store/teamStore';
import { shortName, initialsOf, photoOf } from '@core/utils/playerName';

import type { Selection, SlotIdx, Validation } from './lineupLogic';
import { fmtPts } from './lineupLogic';

// ── Avatar ─────────────────────────────────────────────────────────
export const LineupAvatar: React.FC<{
  initials: string;
  selected?: boolean;
  animating?: boolean;
  size?: number;
  photoUrl?: string | null;
  ring?: string | null;
}> = ({ initials, selected, animating, size = 22, photoUrl, ring }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (animating && !reduced) {
      // Rebote corto al llegar del banquillo (≈250 ms).
      scale.value = withSequence(
        withTiming(1.2, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 260 }),
      );
    }
  }, [animating, reduced, scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const on = selected || animating;
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? c.accent : c.bgCard2,
          borderWidth: 1,
          borderColor: ring ?? (on ? c.accent : c.hairStrong),
          overflow: 'hidden',
        },
        aStyle,
      ]}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: size, height: size }} />
      ) : (
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: Math.max(8, size * 0.36),
            fontWeight: '700',
            color: on ? c.textInverse : c.textMuted,
          }}
        >
          {initials}
        </Text>
      )}
    </Animated.View>
  );
};

// ── Hueco ──────────────────────────────────────────────────────────
interface SlotProps {
  player: Player | null;
  fallbackName?: string | null;
  selected: boolean;
  /** Hay un jugador del banquillo elegido: el hueco vacío late. */
  target: string | null;
  disabled: boolean;
  animating: boolean;
  me?: boolean;
  onTap: () => void;
  onRemove?: () => void;
}

const Slot: React.FC<SlotProps> = ({
  player,
  fallbackName,
  selected,
  target,
  disabled,
  animating,
  me,
  onTap,
  onRemove,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const empty = !player && !fallbackName;
  useEffect(() => {
    if (empty && target && !reduced) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [empty, target, reduced, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.02 }],
  }));

  if (empty) {
    return (
      <Animated.View style={[{ flex: 1, minWidth: 0 }, target ? pulseStyle : null]}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            if (!disabled) onTap();
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={target ? `Colocar a ${target} aquí` : 'Hueco vacío'}
          style={({ pressed }) => [
            styles.slot,
            styles.slotEmpty,
            target ? styles.slotEmptyTarget : null,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[styles.slotEmptyText, target ? { color: c.accent } : null]}
            numberOfLines={1}
          >
            {target ? `Colocar a ${target}` : 'Vacío'}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  const name = me ? 'Tú' : player ? shortName(player) : fallbackName ?? '—';
  const initials = player ? initialsOf(player) : (fallbackName ?? '?').slice(0, 2).toUpperCase();
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        if (!disabled) onTap();
      }}
      onLongPress={() => {
        if (!disabled && onRemove) onRemove();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}${player ? `, ${player.position}, ${player.pts} puntos` : ''}`}
      style={({ pressed }) => [
        styles.slot,
        selected && styles.slotSelected,
        pressed && !disabled && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LineupAvatar
        initials={initials}
        selected={selected}
        animating={animating}
        photoUrl={player ? photoOf(player) : null}
      />
      <Text style={[styles.slotName, me && { color: c.accent }]} numberOfLines={1}>
        {name}
      </Text>
      {selected && onRemove ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          hitSlop={8}
          accessibilityLabel="Quitar de la pista"
          style={styles.removeChip}
        >
          <IconTrash size={11} color={c.error} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

// ── Pista ──────────────────────────────────────────────────────────
interface CourtProps {
  court: number;
  p1: Player | null;
  p2: Player | null;
  fallback?: { a: string | null; b: string | null } | null;
  total: number;
  filled: boolean;
  validation: Validation;
  sel: Selection;
  /** Nombre corto del jugador del banquillo elegido (para «Colocar a X»). */
  benchTarget: string | null;
  disabled: boolean;
  highlight?: boolean;
  myPlayerId?: string | null;
  onSlotTap: (slot: SlotIdx) => void;
  onRemove: (slot: SlotIdx) => void;
  isAnimating: (id: string) => boolean;
}

export const LineupCourt: React.FC<CourtProps> = ({
  court,
  p1,
  p2,
  fallback,
  total,
  filled,
  validation,
  sel,
  benchTarget,
  disabled,
  highlight,
  myPlayerId,
  onSlotTap,
  onRemove,
  isAnimating,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const err = validation.state === 'err';
  return (
    <View
      style={[
        styles.court,
        err && { borderColor: c.warning },
        highlight && styles.courtMe,
      ]}
    >
      <Text style={[styles.courtN, err && { color: c.warning }]}>P{court}</Text>
      <View style={styles.pair}>
        {([0, 1] as SlotIdx[]).map((slot) => {
          const p = slot === 0 ? p1 : p2;
          return (
            <Slot
              key={slot}
              player={p}
              fallbackName={!p ? (slot === 0 ? fallback?.a : fallback?.b) ?? null : null}
              selected={sel?.kind === 'slot' && sel.court === court && sel.slot === slot}
              target={!p && sel?.kind === 'bench' ? benchTarget : null}
              disabled={disabled}
              animating={p ? isAnimating(p.id) : false}
              me={!!p && !!myPlayerId && p.id === myPlayerId}
              onTap={() => onSlotTap(slot)}
              onRemove={p && !disabled ? () => onRemove(slot) : undefined}
            />
          );
        })}
      </View>
      <View style={styles.ptsWrap}>
        <Text style={[styles.pts, !filled && { color: c.textFaint }, err && { color: c.warning }]}>
          {filled ? fmtPts(total) : total > 0 ? fmtPts(total) : '—'}
        </Text>
        {filled && p1 && p2 ? (
          <Text style={styles.ptsSub}>
            {fmtPts(p1.pts)}·{fmtPts(p2.pts)}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

/** «≥» entre pistas; ámbar «‹» si la de abajo suma más que la de arriba. */
export const CourtGap: React.FC<{ broken: boolean; strict: boolean }> = ({ broken, strict }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Text
      style={[styles.gap, broken && strict && { color: c.warning, fontWeight: '700' }]}
      accessibilityLabel={broken ? 'Esta pareja suma más que la de arriba' : undefined}
    >
      {broken ? '‹' : '≥'}
    </Text>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    court: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderRadius: 13,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    courtMe: { borderColor: c.accent, borderWidth: 1.5 },
    courtN: {
      width: 26,
      textAlign: 'center',
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      color: c.accent,
    },
    pair: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 6 },
    slot: {
      flex: 1,
      minWidth: 0,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 7,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hair,
    },
    slotSelected: { borderColor: c.accent, backgroundColor: c.accent15 },
    slotEmpty: {
      justifyContent: 'center',
      borderStyle: 'dashed',
      borderColor: c.hairStrong,
      backgroundColor: 'transparent',
    },
    slotEmptyTarget: { borderColor: c.accent40, backgroundColor: c.accent10 },
    slotEmptyText: { color: c.textFaint, fontSize: 12, fontWeight: '700' },
    slotName: { flex: 1, minWidth: 0, color: c.text, fontSize: 12.5, fontWeight: '600' },
    removeChip: {
      width: 20,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,107,107,0.14)',
    },
    ptsWrap: { minWidth: 46, alignItems: 'flex-end' },
    pts: { fontFamily: Fonts.mono, fontSize: 12.5, fontWeight: '700', color: c.text },
    ptsSub: { fontFamily: Fonts.mono, fontSize: 9, color: c.textFaint, marginTop: 1 },
    gap: {
      alignSelf: 'center',
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: c.textFaint,
      marginVertical: -4,
      lineHeight: 14,
    },
  });
