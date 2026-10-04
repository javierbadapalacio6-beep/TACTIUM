import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { initialsOf } from '@core/utils/format';

/**
 * Marcador de partido (detalle de jornada de liga y de amistoso). Mismo
 * lenguaje que la cabecera de la Jornada: escudo · marcador grande · escudo,
 * con el estado en mono debajo. Si hay foto, va de fondo.
 */
export interface MatchScoreboardProps {
  eyebrow?: string | null;
  left: string;
  right: string;
  /** Escudo con iniciales (equipos). En amistosos, solo nombres. */
  crests?: boolean;
  us: number | null;
  them: number | null;
  status?: string | null;
  tint?: string;
  photoUrl?: string | null;
}

export const MatchScoreboard: React.FC<MatchScoreboardProps> = ({
  eyebrow,
  left,
  right,
  crests = true,
  us,
  them,
  status,
  tint,
  photoUrl,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const color = tint ?? c.text;
  const body = (
    <View style={styles.inner}>
      {eyebrow ? (
        <Text style={styles.eyebrow} numberOfLines={2}>
          {eyebrow}
        </Text>
      ) : null}
      <View style={styles.grid}>
        <Side name={left} mine crest={crests} />
        <View style={styles.center}>
          <Text style={[styles.score, { color }]} numberOfLines={1}>
            {us ?? '–'}–{them ?? '–'}
          </Text>
          {status ? (
            <Text style={[styles.status, { color }]}>{status.toUpperCase()}</Text>
          ) : null}
        </View>
        <Side name={right} crest={crests} />
      </View>
    </View>
  );
  if (photoUrl) {
    return (
      <ImageBackground
        source={{ uri: photoUrl }}
        style={[styles.card, { borderColor: c.hairStrong }]}
        imageStyle={{ borderRadius: Radius.lg }}
      >
        <LinearGradient
          colors={['rgba(3,15,15,0.35)', 'rgba(3,15,15,0.92)']}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
        {body}
      </ImageBackground>
    );
  }
  return <View style={styles.card}>{body}</View>;
};

const Side: React.FC<{ name: string; mine?: boolean; crest: boolean }> = ({
  name,
  mine,
  crest,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.side}>
      {crest ? (
        <View
          style={[
            styles.crest,
            {
              backgroundColor: mine ? c.accent10 : withAlpha(c.text, 0.06),
              borderColor: mine ? c.accent40 : c.hairStrong,
            },
          ]}
        >
          <Text style={[styles.crestText, { color: mine ? c.accent : c.text }]}>
            {initialsOf(name)}
          </Text>
        </View>
      ) : null}
      <Text style={styles.sideName} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
};

// ── Fila de partido/pista (Resultados, detalle de liga, amistoso Equipos) ──
export interface MatchRowProps {
  badge: string;
  title: string;
  sub?: string | null;
  right?: string | null;
  rightTone?: 'win' | 'loss' | 'todo' | 'muted';
  rightSub?: string | null;
  me?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const MatchRow: React.FC<MatchRowProps> = ({
  badge,
  title,
  sub,
  right,
  rightTone = 'muted',
  rightSub,
  me,
  onPress,
  accessibilityLabel,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const rc =
    rightTone === 'win'
      ? c.accent
      : rightTone === 'loss'
        ? c.error
        : rightTone === 'todo'
          ? c.accent
          : c.textFaint;
  const content = (
    <>
      <Text style={styles.rowBadge}>{badge}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rowRight, { color: rc }]}>{right}</Text>
          {rightSub ? <Text style={[styles.rowRightSub, { color: c.accent }]}>{rightSub}</Text> : null}
        </View>
      ) : null}
    </>
  );
  const style = [styles.row, me && styles.rowMe];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...style, pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard,
      overflow: 'hidden',
    },
    inner: { padding: 16 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.6,
      color: c.accent,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 14,
    },
    grid: { flexDirection: 'row', alignItems: 'center' },
    side: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
    crest: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crestText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '600' },
    sideName: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    center: { width: 112, alignItems: 'center', gap: 4 },
    score: {
      fontFamily: Fonts.mono,
      fontSize: 40,
      fontWeight: '700',
      letterSpacing: -1,
      lineHeight: 44,
    },
    status: {
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    rowMe: { borderColor: c.accent, borderWidth: 1.5 },
    rowBadge: {
      width: 26,
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      color: c.accent,
      textAlign: 'center',
    },
    rowTitle: { color: c.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
    rowSub: { color: c.textFaint, fontSize: 12, marginTop: 2, fontFamily: Fonts.mono },
    rowRight: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.mono },
    rowRightSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  });
