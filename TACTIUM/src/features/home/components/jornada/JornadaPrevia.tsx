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
  venue: string;
  tandas?: string | null;
  onOpenAvailability: () => void;
}> = ({ matchdayId, lastCrossing, venue, tandas, onOpenAvailability }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { counts, loading } = useMatchdayAvailability(matchdayId);

  let convocatoria: string;
  if (counts.total === 0) convocatoria = loading ? 'Cargando…' : 'Sin plantilla';
  else {
    const parts = [`${counts.yes} ${counts.yes === 1 ? 'va' : 'van'}`];
    if (counts.no > 0) parts.push(`${counts.no} no`);
    parts.push(`${counts.maybe} duda`);
    parts.push(`${counts.pending} sin contestar`);
    convocatoria = parts.join(' · ');
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
        <Row label="Convocatoria">
          <View style={styles.valueRow}>
            <Text style={[styles.value, styles.mono]} numberOfLines={1}>
              {convocatoria}
            </Text>
            <IconChevron size={12} color={c.textFaint} />
          </View>
        </Row>
      </Pressable>
      <Row label="Sede" last={!tandas}>
        <Text style={styles.value} numberOfLines={2}>
          {venue}
        </Text>
      </Row>
      {tandas ? (
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
