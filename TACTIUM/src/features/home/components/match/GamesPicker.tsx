import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';

import { tapLight } from './haptics';
import {
  isPlausibleSet,
  isSetDone,
  summarize,
  thirdSetNeeded,
  setsLine,
  type SetScore,
} from './setsLogic';

/**
 * Botonera de juegos 0-7 por set. Sustituye al teclado numérico en
 * Resultados (liga) y en Amistosos: dos filas (nosotros / rival), un toque
 * por lado, el set se cierra solo y se abre el siguiente. Con 2-0 el tercer
 * set desaparece. Un resultado imposible (7-4, 6-5) avisa en ámbar, sin
 * bloquear.
 */

// ── Fila de botones ────────────────────────────────────────────────
interface GamesPickerProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** Lado que se pinta: el nuestro en verde, el rival en neutro. */
  tone: 'us' | 'them';
  max?: number;
  disabled?: boolean;
}

export const GamesPicker: React.FC<GamesPickerProps> = ({
  label,
  value,
  onChange,
  tone,
  max = 7,
  disabled,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const nums = Array.from({ length: max + 1 }, (_, i) => i);
  // De 8 en 8: con super tie-break (0-15) salen dos filas.
  const rows: number[][] = [];
  for (let i = 0; i < nums.length; i += 8) rows.push(nums.slice(i, i + 8));
  return (
    <View style={styles.pickerRow}>
      <Text style={styles.pickerLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flex: 1, gap: 4 }}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.pickerBtns}>
            {row.map((n) => (
              <GameBtn
                key={n}
                n={n}
                on={value === n}
                tone={tone}
                disabled={disabled}
                label={label}
                onPress={() => {
                  tapLight();
                  onChange(value === n ? null : n);
                }}
              />
            ))}
            {/* Huecos para que la segunda fila no estire los botones. */}
            {row.length < 8
              ? Array.from({ length: 8 - row.length }).map((_, k) => (
                  <View key={`f${k}`} style={{ flex: 1 }} />
                ))
              : null}
          </View>
        ))}
      </View>
    </View>
  );
};

const GameBtn: React.FC<{
  n: number;
  on: boolean;
  tone: 'us' | 'them';
  disabled?: boolean;
  label: string;
  onPress: () => void;
}> = ({ n, on, tone, disabled, label, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (on && !reduced) {
      scale.value = withSequence(
        withTiming(1.18, { duration: 110 }),
        withTiming(1, { duration: 160 }),
      );
    }
  }, [on, reduced, scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ flex: 1 }, aStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${n} juegos`}
        accessibilityState={{ selected: on, disabled: !!disabled }}
        hitSlop={2}
        style={({ pressed }) => [
          styles.gameBtn,
          on && (tone === 'us' ? styles.gameBtnUs : styles.gameBtnThem),
          pressed && !disabled && { opacity: 0.8 },
          disabled && !on && { opacity: 0.45 },
        ]}
      >
        <Text
          style={[
            styles.gameBtnText,
            on && { color: tone === 'us' ? c.textInverse : c.text },
          ]}
        >
          {n}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

// ── Editor de sets ─────────────────────────────────────────────────
interface SetsEditorProps {
  sets: SetScore[];
  onChange: (setIdx: number, side: 'us' | 'them', value: number | null) => void;
  usLabel: string;
  themLabel: string;
  disabled?: boolean;
  /** Tercer set como super tie-break (hasta 15). Solo liga. */
  allowSuperTiebreak?: boolean;
}

export const SetsEditor: React.FC<SetsEditorProps> = ({
  sets,
  onChange,
  usLabel,
  themLabel,
  disabled,
  allowSuperTiebreak,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [manualOpen, setManualOpen] = useState<number | null>(null);
  const third = sets[2];
  const [superTb, setSuperTb] = useState(
    !!third && ((third.us ?? 0) > 7 || (third.them ?? 0) > 7),
  );

  const visible = thirdSetNeeded(sets) ? [0, 1, 2] : [0, 1];
  const current = visible.find((i) => !isSetDone(sets[i] ?? { us: null, them: null }));
  const expanded = disabled ? null : manualOpen ?? current ?? null;
  const sum = summarize(sets);
  const implausible = sets.some(
    (s, i) =>
      visible.includes(i) &&
      isSetDone(s) &&
      !isPlausibleSet(s.us as number, s.them as number),
  );

  const change = (i: number, side: 'us' | 'them', v: number | null) => {
    const next = { ...sets[i], [side]: v };
    // Al cerrar el set que estaba abierto a mano, volvemos al flujo normal
    // (se abre el siguiente pendiente).
    if (isSetDone(next)) setManualOpen(null);
    onChange(i, side, v);
  };

  return (
    <View style={{ gap: 6 }}>
      {visible.map((i) => {
        const s = sets[i] ?? { us: null, them: null };
        const done = isSetDone(s);
        const isOpen = expanded === i;
        const max = i === 2 && superTb ? 15 : 7;
        if (!isOpen) {
          return (
            <Animated.View key={i} layout={LinearTransition.duration(200)}>
              <Pressable
                onPress={() => !disabled && setManualOpen(i)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Set ${i + 1}${done ? `, ${s.us} a ${s.them}` : ', sin marcador'}`}
                style={({ pressed }) => [
                  styles.setCollapsed,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.setHead}>
                  SET {i + 1}
                  {s.us !== null || s.them !== null
                    ? ` · ${s.us ?? '–'}-${s.them ?? '–'}`
                    : ''}
                </Text>
                <Text
                  style={[
                    styles.setHeadRight,
                    done && { color: c.accent },
                  ]}
                >
                  {done ? '✓' : disabled ? '' : 'Apuntar'}
                </Text>
              </Pressable>
            </Animated.View>
          );
        }
        return (
          <Animated.View
            key={i}
            entering={FadeIn.duration(180)}
            layout={LinearTransition.duration(200)}
            style={[styles.setOpen]}
          >
            <View style={styles.setOpenHead}>
              <Text style={styles.setHead}>
                SET {i + 1}
                {i === 2 && superTb ? ' · SUPER TIE-BREAK' : ''}
              </Text>
              <Text style={styles.setHeadRight}>toca los juegos</Text>
            </View>
            <GamesPicker
              label={usLabel}
              tone="us"
              value={s.us}
              max={max}
              onChange={(v) => change(i, 'us', v)}
            />
            <GamesPicker
              label={themLabel}
              tone="them"
              value={s.them}
              max={max}
              onChange={(v) => change(i, 'them', v)}
            />
            {i === 2 && allowSuperTiebreak ? (
              <Pressable
                onPress={() => setSuperTb((v) => !v)}
                hitSlop={6}
                style={{ alignSelf: 'flex-start' }}
              >
                <Text style={styles.linkMuted}>
                  {superTb ? 'Set normal (hasta 7)' : '¿Super tie-break? Apuntar hasta 15'}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        );
      })}

      {implausible ? (
        <Animated.Text entering={FadeIn.duration(160)} style={styles.warn}>
          ¿Seguro? Un set acaba 6-4, 7-5 o 7-6
        </Animated.Text>
      ) : null}

      {sum.decided ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.done,
            !sum.won && {
              backgroundColor: c.bgCard2,
              borderColor: c.hairStrong,
            },
          ]}
        >
          <Text style={[styles.doneText, !sum.won && { color: c.text }]}>
            {sum.won ? 'Ganado' : 'Perdido'} {sum.usSets}-{sum.themSets} · {setsLine(sets)}
          </Text>
          {!thirdSetNeeded(sets) ? (
            <Text style={[styles.doneText, !sum.won && { color: c.textMuted }]}>
              Sin 3.er set
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
};

// ── Tabla de sets (solo lectura) ───────────────────────────────────
export const SetsTable: React.FC<{
  sets: SetScore[];
  usLabel: string;
  themLabel: string;
  columns?: number;
}> = ({ sets, usLabel, themLabel, columns = 3 }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cols = Array.from({ length: Math.max(columns, sets.length) }, (_, i) => i);
  const cell = (i: number, side: 'us' | 'them') => {
    const s = sets[i];
    if (!s || s[side] === null) return { txt: '–', win: false };
    const other = side === 'us' ? s.them : s.us;
    return {
      txt: String(s[side]),
      win: other !== null && (s[side] as number) > (other as number),
    };
  };
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <Text style={[styles.tableName, styles.tableHead]} />
        {cols.map((i) => (
          <Text key={i} style={[styles.tableCell, styles.tableHead]}>
            S{i + 1}
          </Text>
        ))}
      </View>
      {(['us', 'them'] as const).map((side) => (
        <View key={side} style={styles.tableRow}>
          <Text style={styles.tableName} numberOfLines={1}>
            {side === 'us' ? usLabel : themLabel}
          </Text>
          {cols.map((i) => {
            const v = cell(i, side);
            return (
              <Text
                key={i}
                style={[styles.tableCell, v.win && styles.tableWin]}
              >
                {v.txt}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pickerLabel: {
      width: 70,
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    pickerBtns: { flexDirection: 'row', gap: 4 },
    gameBtn: {
      height: 36,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gameBtnUs: { backgroundColor: c.accent, borderColor: c.accent },
    gameBtnThem: { backgroundColor: c.hairStrong, borderColor: c.textFaint },
    gameBtnText: {
      fontFamily: Fonts.mono,
      fontSize: 14,
      fontWeight: '700',
      color: c.textMuted,
    },
    setCollapsed: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    setOpen: {
      gap: 8,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    setOpenHead: { flexDirection: 'row', justifyContent: 'space-between' },
    setHead: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.4,
      color: c.textMuted,
      fontWeight: '600',
    },
    setHeadRight: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 0.8,
      color: c.textFaint,
    },
    linkMuted: { color: c.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
    warn: {
      color: c.warning,
      fontSize: 12.5,
      fontWeight: '600',
      paddingHorizontal: 2,
    },
    done: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    doneText: { color: c.accent, fontSize: 12.5, fontWeight: '700' },
    table: { gap: 2 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
    tableName: { flex: 1, color: c.text, fontSize: 13, fontWeight: '600' },
    tableHead: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      color: c.textFaint,
      fontWeight: '500',
    },
    tableCell: {
      width: 40,
      textAlign: 'center',
      fontFamily: Fonts.mono,
      fontSize: 14,
      color: c.textMuted,
      fontWeight: '600',
    },
    tableWin: { color: c.accent, fontWeight: '800' },
  });
