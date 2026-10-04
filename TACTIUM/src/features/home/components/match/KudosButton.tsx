import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import { supabase } from '@core/supabase/client';
import { toggleActivityKudos, type KudosKind } from '@core/services/social';
import { useToastStore } from '@store/toastStore';

import { tapLight } from './haptics';

/**
 * Recuento de kudos de un resultado.
 *
 * Orden de fuentes:
 *  1. Lo que ya traiga el detalle (`kudos_count`/`i_gave_kudos`, migración
 *     20261004_partido_kudos_detalle.sql, sin aplicar todavía).
 *  2. Lectura directa de `activity_kudos` (la RLS deja leer a cualquier
 *     usuario con sesión).
 *  3. Si nada responde, el contador se oculta y el botón sigue funcionando.
 */
export async function fetchKudosSummary(
  kind: KudosKind,
  targetId: string,
  userId: string | null,
): Promise<{ count: number; given: boolean } | null> {
  try {
    const from = supabase.from.bind(supabase) as unknown as (t: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => {
          eq: (
            c: string,
            v: string,
          ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await from('activity_kudos')
      .select('user_id')
      .eq('target_kind', kind)
      .eq('target_id', targetId);
    if (error) return null;
    const rows = (data ?? []) as { user_id: string }[];
    return {
      count: rows.length,
      given: !!userId && rows.some((r) => r.user_id === userId),
    };
  } catch {
    return null;
  }
}

interface Props {
  kind: KudosKind;
  targetId: string;
  /** En amistosos, a quién le llega el aviso (el creador). */
  targetUserId?: string | null;
  userId: string | null;
  initialCount?: number | null;
  initialGiven?: boolean | null;
}

export const KudosButton: React.FC<Props> = ({
  kind,
  targetId,
  targetUserId,
  userId,
  initialCount,
  initialGiven,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const [count, setCount] = useState<number | null>(
    initialCount != null ? initialCount : null,
  );
  const [given, setGiven] = useState<boolean>(!!initialGiven);
  const busy = useRef(false);

  useEffect(() => {
    if (initialCount != null) return; // ya viene del servidor
    let cancelled = false;
    fetchKudosSummary(kind, targetId, userId).then((r) => {
      if (cancelled || !r) return;
      setCount(r.count);
      setGiven(r.given);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, targetId, userId, initialCount]);

  // La mano late hasta que la pulsas.
  const scale = useSharedValue(1);
  useEffect(() => {
    if (given || reduced) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.22, { duration: 360 }),
        withTiming(1, { duration: 1100 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(scale);
  }, [given, reduced, scale]);
  const handStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    tapLight();
    const prevGiven = given;
    const prevCount = count;
    setGiven(!prevGiven);
    if (prevCount != null) setCount(Math.max(0, prevCount + (prevGiven ? -1 : 1)));
    try {
      const r = await toggleActivityKudos(kind, targetId, targetUserId ?? null);
      setGiven(r.given);
      setCount(r.count);
    } catch (e) {
      console.warn('kudos detalle', e);
      setGiven(prevGiven);
      setCount(prevCount);
      useToastStore
        .getState()
        .error('No se pudo dar kudos', 'Inténtalo de nuevo en un momento.');
    } finally {
      busy.current = false;
    }
  };

  if (!userId) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: given }}
      accessibilityLabel={given ? 'Quitar tu kudos' : 'Dar kudos'}
      style={({ pressed }) => [
        styles.bar,
        given && { borderColor: c.accent40, backgroundColor: c.accent10 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.left}>
        <Animated.Text style={[styles.hand, handStyle]}>👏</Animated.Text>
        <Text style={styles.label}>{given ? 'Kudos dado' : 'Dar kudos'}</Text>
      </View>
      {count != null ? (
        <Text style={styles.count}>
          {count} {count === 1 ? 'kudos' : 'kudos'}
          {given ? ' · incluido el tuyo' : ''}
        </Text>
      ) : null}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hand: { fontSize: 16 },
    label: { color: c.accent, fontSize: 14, fontWeight: '700' },
    count: { color: c.textFaint, fontSize: 12.5 },
  });
