import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import type { RecordBestPartner } from '@core/hooks/useMyRecord';

// Bloque de récord del perfil (mejora n.º 10): RÉCORD (V · D · %), racha con
// los últimos 5 y MEJOR PAREJA. Lo usan el perfil propio (completo) y el
// público (solo RÉCORD de amistosos).

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Tarjeta RÉCORD: tres cifras grandes. */
export const RecordCard: React.FC<{
  won: number;
  lost: number;
  winRate: number | null;
  eyebrow?: string;
  onPress?: () => void;
}> = ({ won, lost, winRate, eyebrow = 'RÉCORD', onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Récord: ${won} victorias, ${lost} derrotas, ${
        winRate ?? 0
      } por ciento ganados`}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <View style={styles.figures}>
        <Figure value={String(won)} label="VICTORIAS" accent />
        <View style={styles.divider} />
        <Figure value={String(lost)} label="DERROTAS" />
        <View style={styles.divider} />
        <Figure
          value={winRate != null ? `${winRate}%` : '—'}
          label="% GANADOS"
        />
      </View>
    </Pressable>
  );
};

const Figure: React.FC<{ value: string; label: string; accent?: boolean }> = ({
  value,
  label,
  accent,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.figure}>
      <Text
        style={[styles.figureValue, accent && { color: c.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={styles.figureLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/** Racha actual + pips de los últimos 5 (V/D). */
export const StreakCard: React.FC<{
  streak: number;
  lastFive: ('W' | 'L')[];
  onPress?: () => void;
}> = ({ streak, lastFive, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const title =
    streak > 0
      ? `🔥 Racha: ${plural(streak, 'victoria', 'victorias')}`
      : 'Últimos partidos';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        styles.rowCard,
        pressed && onPress && styles.pressed,
      ]}
    >
      <Text style={styles.streakTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.pips}>
        {lastFive.map((r, i) => {
          const win = r === 'W';
          return (
            <View
              key={i}
              style={[
                styles.pip,
                win
                  ? { backgroundColor: c.accent10, borderColor: c.accent40 }
                  : { borderColor: c.hairStrong },
              ]}
            >
              <Text
                style={[
                  styles.pipText,
                  { color: win ? c.accent : c.error },
                ]}
              >
                {win ? 'V' : 'D'}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

/** MEJOR PAREJA: nombre, «9 de 11 juntos · 82 %», pista habitual. */
export const BestPartnerCard: React.FC<{
  partner: RecordBestPartner;
  onPress?: () => void;
}> = ({ partner, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <Text style={styles.eyebrow}>MEJOR PAREJA</Text>
      <Text style={styles.partnerName} numberOfLines={1}>
        {partner.name}
      </Text>
      <Text style={styles.partnerMeta} numberOfLines={1}>
        {`${partner.won} de ${partner.played} juntos · ${partner.rate} %`}
        {partner.usualCourt != null
          ? ` · Pista habitual: ${partner.usualCourt}`
          : ''}
      </Text>
    </Pressable>
  );
};

/** Esqueleto mientras carga el récord. */
export const RecordSkeleton: React.FC = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stack}>
      <View style={[styles.card, styles.skeleton, { height: 96 }]} />
      <View style={[styles.card, styles.skeleton, { height: 52 }]} />
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  stack: { gap: 10 },
  card: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hair,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.85 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  skeleton: { backgroundColor: c.bgRaised, borderColor: c.hair },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  figure: { flex: 1, alignItems: 'center' },
  figureValue: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  figureLabel: {
    fontFamily: Fonts.mono,
    color: c.textMuted,
    fontSize: 9.5,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: c.hairStrong },
  streakTitle: {
    flexShrink: 1,
    color: c.text,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  pips: { flexDirection: 'row', gap: 5 },
  pip: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipText: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '800' },
  partnerName: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  partnerMeta: {
    fontFamily: Fonts.mono,
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
