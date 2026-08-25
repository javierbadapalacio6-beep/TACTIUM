// Primitivas compartidas del apartado Federación (rediseño "scoreboard").
// Reproducen la escala tipográfica y la densidad del handoff con los tokens del
// tema actual (claro/oscuro) — mint racionado a estado activo / resultado
// positivo. Ver design_handoff_federaciones/README.md.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconChevron } from '@components/ui';

// ─── Caret ▾ (chevron hacia abajo, para chips desplegables) ────────────────────
export const Caret: React.FC<{ size?: number; color?: string }> = ({ size = 12, color }) => {
  const c = useColors();
  return (
    <View style={{ transform: [{ rotate: '90deg' }] }}>
      <IconChevron size={size} color={color ?? c.textFaint} />
    </View>
  );
};

// ─── Segmented control (Todo · Equipos · … / Clasificación · Jornadas) ─────────
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
}: {
  items: [T, string][];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const c = useColors();
  const styles = useMemo(() => makeSeg(c), [c]);
  const pad = size === 'sm' ? 9 : 10;
  const fs = size === 'sm' ? 13 : 14;
  return (
    <View style={styles.wrap}>
      {items.map(([key, label]) => {
        const on = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.item, { paddingVertical: pad }, on && styles.itemOn]}
          >
            <Text style={[styles.text, { fontSize: fs }, on && styles.textOn]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeSeg = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      gap: 2,
      backgroundColor: c.bgCard,
      borderRadius: 999,
      padding: 4,
      borderWidth: 1,
      borderColor: c.hair,
    },
    item: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    itemOn: {
      backgroundColor: c.accent,
      ...Platform.select({
        ios: { shadowColor: c.accent, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
        default: {},
      }),
    },
    text: { color: c.textMuted, fontWeight: '700' },
    textOn: { color: c.textInverse },
  });

// ─── Meta chip (píldora mono: "6 EQUIPOS", "FINALIZADA") ───────────────────────
export const MetaChip: React.FC<{ label: string; tone?: 'neutral' | 'mint' }> = ({
  label,
  tone = 'neutral',
}) => {
  const c = useColors();
  const styles = useMemo(() => makeChip(c), [c]);
  return (
    <View style={[styles.chip, tone === 'mint' && styles.chipMint]}>
      <Text style={[styles.text, tone === 'mint' && styles.textMint]}>{label}</Text>
    </View>
  );
};

const makeChip = (c: Palette) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    chipMint: { backgroundColor: c.accent10, borderColor: c.accent40 },
    text: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: '600',
      color: c.textMuted,
    },
    textMint: { color: c.accent },
  });

// ─── Chip de racha V/D (micro) ─────────────────────────────────────────────────
export const FormChip: React.FC<{ result: 'V' | 'D'; box?: number }> = ({ result, box = 16 }) => {
  const c = useColors();
  const win = result === 'V';
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: win ? c.accent15 : withAlpha(c.error, 0.15),
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: box <= 16 ? 9 : 9.5,
          fontWeight: '700',
          color: win ? c.accent : c.error,
        }}
      >
        {result}
      </Text>
    </View>
  );
};

export const FormChips: React.FC<{ form: ('V' | 'D')[]; box?: number }> = ({ form, box }) => (
  <View style={{ flexDirection: 'row', gap: 4 }}>
    {form.map((r, i) => (
      <FormChip key={i} result={r} box={box} />
    ))}
  </View>
);

// ─── Celda de estadística (valor mono + label mono) ────────────────────────────
export const StatCell: React.FC<{
  label: string;
  value: string;
  color?: string;
  valueSize?: number;
  align?: 'center' | 'flex-start';
}> = ({ label, value, color, valueSize = 15, align = 'center' }) => {
  const c = useColors();
  return (
    <View style={{ alignItems: align, gap: 3, minWidth: 0 }}>
      <Text style={{ fontFamily: Fonts.mono, fontSize: valueSize, fontWeight: '800', color: color ?? c.text }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 9,
          letterSpacing: 1.2,
          fontWeight: '500',
          color: c.textFaint,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

// ─── Cabecera de lista: eyebrow mono + acción opcional, sobre regla inferior ───
export const ListHeader: React.FC<{
  title: string;
  action?: string;
  onAction?: () => void;
  ruled?: boolean;
}> = ({ title, action, onAction, ruled = true }) => {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: ruled ? 1 : 0,
        borderBottomColor: c.hair,
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 11,
          letterSpacing: 2.4,
          fontWeight: '600',
          color: c.textMuted,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} disabled={!onAction}>
          <Text
            style={{
              fontFamily: Fonts.mono,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: '600',
              color: c.accent,
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};
