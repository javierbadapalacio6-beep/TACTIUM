import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconChevron } from '@components/ui';
import { useMatchdayAvailability } from '@core/hooks/useMatchdayAvailability';
import type { FcpLastCrossing } from '@core/services/fcpSeason';

/**
 * Bloque PREVIA de la jornada: filas clave-valor. «Último cruce» solo cuando
 * la Federación lo da; convocatoria y sede siempre.
 */
export const JornadaPrevia: React.FC<{
  matchdayId: string;
  lastCrossing: FcpLastCrossing | null;
  venue?: string;
  tandas?: string | null;
  onOpenAvailability: () => void;
}> = ({ matchdayId, lastCrossing, venue, tandas, onOpenAvailability }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { counts, loading } = useMatchdayAvailability(matchdayId);

  let convocatoria: string;
  // Chips de la convocatoria (antes una sola línea que se cortaba: «3 sin…»).
  const stats: { n: number; label: string; tint: string }[] = [];
  if (counts.total === 0) convocatoria = loading ? 'Cargando…' : 'Sin plantilla';
  else {
    stats.push({ n: counts.yes, label: counts.yes === 1 ? 'va' : 'van', tint: c.accent });
    if (counts.no > 0) stats.push({ n: counts.no, label: 'no', tint: c.error });
    stats.push({ n: counts.maybe, label: 'duda', tint: c.warning });
    stats.push({ n: counts.pending, label: 'sin contestar', tint: c.textFaint });
    convocatoria = stats.map((x) => `${x.n} ${x.label}`).join(' · ');
  }

  let cruce: { text: string; tint: string } | null = null;
  if (lastCrossing) {
    const tint =
      lastCrossing.outcome === 'win'
        ? c.accent
        : lastCrossing.outcome === 'loss'
        ? c.error
        : lastCrossing.outcome === 'draw'
        ? c.warning
        : c.text;
    const marcador =
      lastCrossing.us != null && lastCrossing.them != null
        ? `${lastCrossing.us}–${lastCrossing.them}`
        : lastCrossing.outcome === 'win'
        ? 'Victoria'
        : lastCrossing.outcome === 'loss'
        ? 'Derrota'
        : lastCrossing.outcome === 'draw'
        ? 'Empate'
        : 'Jugado';
    const parts = [marcador];
    if (lastCrossing.jornada != null) parts.push(`J${lastCrossing.jornada}`);
    if (lastCrossing.fecha) {
      const [, mm, dd] = lastCrossing.fecha.slice(0, 10).split('-');
      if (dd && mm) parts.push(`${dd}/${mm}`);
    }
    cruce = { text: parts.join(' · '), tint };
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PREVIA</Text>
      {cruce ? (
        <Row label="Último cruce">
          <Text style={[styles.value, styles.mono, { color: cruce.tint }]}>
            {cruce.text}
          </Text>
        </Row>
      ) : null}
      <Pressable
        onPress={onOpenAvailability}
        accessibilityRole="button"
        accessibilityLabel={`Convocatoria: ${convocatoria}`}
        style={({ pressed }) => pressed && { opacity: 0.7 }}
      >
        <View style={[styles.row, styles.rowStack]}>
          <View style={styles.convHead}>
            <Text style={styles.label}>Convocatoria</Text>
            {stats.length === 0 ? <Text style={styles.value}>{convocatoria}</Text> : null}
            <IconChevron size={12} color={c.textFaint} />
          </View>
          {stats.length > 0 ? (
            <View style={styles.statRow}>
              {stats.map((x) => (
                <View key={x.label} style={styles.stat}>
                  <View style={[styles.statDot, { backgroundColor: x.tint }]} />
                  <Text style={styles.statText}>
                    <Text style={styles.statNum}>{x.n}</Text> {x.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
      {venue ? (
        <Row label="Sede" last={!tandas}>
          <Text style={styles.value} numberOfLines={2}>
            {venue}
          </Text>
        </Row>
      ) : null}
      {venue && tandas ? (
        <Row label="Tandas" last>
          <Text style={[styles.value, styles.mono]}>{tandas}</Text>
        </Row>
      ) : null}
    </View>
  );
};

const Row: React.FC<{ label: string; last?: boolean; children: React.ReactNode }> = ({
  label,
  last,
  children,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrap}>{children}</View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 4,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      color: c.textFaint,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    rowStack: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
    convHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgRaised,
    },
    statDot: { width: 6, height: 6, borderRadius: 3 },
    statText: { color: c.textMuted, fontSize: 12.5 },
    statNum: { color: c.text, fontFamily: Fonts.mono, fontWeight: '700' },
    label: { color: c.textMuted, fontSize: 13 },
    valueWrap: { flexShrink: 1, alignItems: 'flex-end' },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    value: {
      color: c.text,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'right',
      flexShrink: 1,
    },
    mono: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 0.2 },
  });
