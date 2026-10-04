import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconLink, IconPlus } from '@components/ui';
import { initialsOf } from '@core/utils/format';

/**
 * La pista dibujada con cuatro huecos (amistosos): tu pareja arriba, la red,
 * los rivales abajo. Cada hueco dice si esa persona está en TACTIUM.
 */
export type SlotKey = 'a1' | 'a2' | 'b1' | 'b2';

export interface CourtSlotData {
  key: SlotKey;
  name: string;
  /** 'me' = tu hueco (siempre vinculado a tu cuenta). */
  state: 'me' | 'linked' | 'guest' | 'empty';
  placeholder: string;
}

interface Props {
  slots: CourtSlotData[];
  topLabel: string;
  bottomLabel: string;
  onPress: (key: SlotKey) => void;
}

export const CourtSlots: React.FC<Props> = ({ slots, topLabel, bottomLabel, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const by = (k: SlotKey) => slots.find((s) => s.key === k)!;
  return (
    <View style={styles.court}>
      <LinearGradient
        colors={[c.accent15, c.bgCard]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
      />
      <Text style={styles.side}>{topLabel}</Text>
      <View style={styles.half}>
        <SlotCard data={by('a1')} onPress={() => onPress('a1')} />
        <SlotCard data={by('a2')} onPress={() => onPress('a2')} />
      </View>
      <View style={styles.net} />
      <View style={styles.half}>
        <SlotCard data={by('b1')} onPress={() => onPress('b1')} />
        <SlotCard data={by('b2')} onPress={() => onPress('b2')} />
      </View>
      <Text style={[styles.side, { textAlign: 'right' }]}>{bottomLabel}</Text>
    </View>
  );
};

const SlotCard: React.FC<{ data: CourtSlotData; onPress: () => void }> = ({ data, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const flip = useSharedValue(0);
  const prev = useRef(data.name);
  useEffect(() => {
    // Al elegir a alguien, el hueco gira como un cromo (300 ms).
    if (data.name && data.name !== prev.current && !reduced) {
      flip.value = withSequence(withTiming(90, { duration: 150 }), withTiming(0, { duration: 150 }));
    }
    prev.current = data.name;
  }, [data.name, reduced, flip]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${flip.value}deg` }],
  }));
  const empty = data.state === 'empty';
  return (
    <Animated.View style={[{ flex: 1 }, aStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={empty ? `${data.placeholder}: elegir jugador` : `${data.name}, cambiar`}
        style={({ pressed }) => [
          styles.slot,
          empty && styles.slotEmpty,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View
          style={[
            styles.avatar,
            data.state === 'me' && { borderColor: c.accent },
            empty && { backgroundColor: c.accent10, borderColor: c.accent40 },
          ]}
        >
          {empty ? (
            <IconPlus size={14} color={c.accent} />
          ) : (
            <Text style={[styles.avatarText, data.state === 'me' && { color: c.accent }]}>
              {initialsOf(data.name)}
            </Text>
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {data.state === 'me' ? 'Tú' : empty ? data.placeholder : data.name}
        </Text>
        {data.state === 'me' ? (
          <Text style={styles.sub} numberOfLines={1}>
            {data.name}
          </Text>
        ) : data.state === 'linked' ? (
          <View style={styles.linkRow}>
            <IconLink size={10} color={c.accent} />
            <Text style={[styles.sub, { color: c.accent }]}>en TACTIUM</Text>
          </View>
        ) : data.state === 'guest' ? (
          <Text style={styles.sub}>sin cuenta</Text>
        ) : (
          <Text style={styles.sub}>Toca para elegir</Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    court: {
      borderRadius: Radius.lg,
      padding: 10,
      gap: 7,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    side: {
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.6,
      color: c.textFaint,
    },
    half: { flexDirection: 'row', gap: 7 },
    net: {
      height: 0,
      borderStyle: 'dashed',
      borderTopWidth: 2,
      borderColor: c.textFaint,
      marginVertical: 2,
    },
    slot: {
      borderRadius: 13,
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      gap: 3,
    },
    slotEmpty: { borderStyle: 'dashed', borderColor: c.accent40 },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: Fonts.mono, fontSize: 11.5, fontWeight: '800', color: c.text },
    name: { color: c.text, fontSize: 13, fontWeight: '700', maxWidth: '100%' },
    sub: { color: c.textFaint, fontSize: 10.5 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  });
