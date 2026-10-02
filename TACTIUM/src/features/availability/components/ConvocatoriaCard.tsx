import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import type { AvailabilityCounts } from '@core/services/availability';
import { useIsPremium } from '@core/hooks/usePremiumGate';

import { nextAutoReminder } from '../hooks/useRemindPending';

interface Props {
  counts: AvailabilityCounts;
  /** Jugadores necesarios: 2 × pistas. */
  needed: number;
  courts: number;
  onRemind: () => void;
  remindDisabledUntil: Date | null;
  sending: boolean;
  onOpen: () => void;
}

/**
 * Convocatoria del capitán en Inicio: los cuatro estados de un vistazo, el
 * dato que importa («te falta 1») y «Recordar ahora» (premium, 1 vez / 12 h).
 */
export const ConvocatoriaCard: React.FC<Props> = ({
  counts,
  needed,
  courts,
  onRemind,
  remindDisabledUntil,
  sending,
  onOpen,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isPremium = useIsPremium();
  const pendingToRemind = counts.pending + counts.maybe;
  const missing = Math.max(0, needed - counts.yes);
  const total = Math.max(1, counts.total);

  const segments: { n: number; color: string; label: string; dashed?: boolean }[] = [
    { n: counts.yes, color: c.accent, label: 'Van' },
    { n: counts.maybe, color: c.warning, label: 'Duda' },
    { n: counts.no, color: c.error, label: 'No pueden' },
    { n: counts.pending, color: c.hairStrong, label: 'Sin contestar', dashed: true },
  ];

  const blocked = !!remindDisabledUntil;
  const blockedLabel = remindDisabledUntil
    ? `Podrás recordar a las ${String(remindDisabledUntil.getHours()).padStart(2, '0')}:${String(
        remindDisabledUntil.getMinutes(),
      ).padStart(2, '0')}`
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.eyebrow}>CONVOCATORIA</Text>
        <Text style={styles.headMeta}>
          {counts.yes}/{counts.total} van
        </Text>
      </View>

      <View style={styles.bar} accessibilityLabel={`${counts.yes} van, ${counts.maybe} en duda, ${counts.no} no pueden, ${counts.pending} sin contestar`}>
        {segments
          .filter((s) => s.n > 0)
          .map((s) => (
            <View key={s.label} style={{ flex: s.n / total, backgroundColor: s.color }} />
          ))}
      </View>

      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View
              style={[
                styles.dot,
                s.dashed
                  ? { borderWidth: 1, borderStyle: 'dashed', borderColor: c.textFaint }
                  : { backgroundColor: s.color },
              ]}
            />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendValue}>{s.n}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.need, missing === 0 && { color: c.accent }]}>
        {missing === 0
          ? `Tienes ${counts.yes} para ${courts} ${courts === 1 ? 'pista' : 'pistas'}: equipo completo`
          : `Necesitas ${needed} para ${courts} ${courts === 1 ? 'pista' : 'pistas'}: te ${missing === 1 ? 'falta 1' : `faltan ${missing}`}`}
      </Text>

      {pendingToRemind > 0 ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onRemind}
            disabled={blocked || sending}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.remind,
              isPremium && !blocked ? styles.remindPrimary : styles.remindGhost,
              (pressed || sending) && { opacity: 0.8 },
              blocked && { opacity: 0.55 },
            ]}
          >
            <Text style={[styles.remindLabel, isPremium && !blocked && { color: c.textInverse }]}>
              {sending ? 'Enviando…' : blocked ? 'Recordado' : `Recordar ahora a ${pendingToRemind}`}
            </Text>
            {!isPremium ? (
              <View style={styles.pro}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            style={({ pressed }) => [styles.remind, styles.remindGhost, styles.seeAll, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.remindLabel}>Ver todos</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.remind, styles.remindGhost, pressed && { opacity: 0.8 }]}>
          <Text style={styles.remindLabel}>Ver convocatoria</Text>
        </Pressable>
      )}

      {pendingToRemind > 0 ? (
        <Text style={styles.foot}>
          {blockedLabel ?? `Recordatorio automático: ${nextAutoReminder()}`}
        </Text>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 16,
      gap: 12,
    },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: c.accent, fontWeight: '600' },
    headMeta: { fontFamily: Fonts.mono, fontSize: 12, color: c.textMuted },
    bar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      backgroundColor: c.hair,
      gap: 2,
    },
    legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { color: c.textMuted, fontSize: 12.5 },
    legendValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 12.5, fontWeight: '700' },
    need: { color: c.text, fontSize: 13.5, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: 8 },
    remind: {
      flex: 1,
      height: 42,
      borderRadius: Radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    seeAll: { flex: 0, paddingHorizontal: 16 },
    remindPrimary: { backgroundColor: c.accent },
    remindGhost: { borderWidth: 1, borderColor: c.hairStrong, backgroundColor: c.background },
    remindLabel: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    pro: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.accent },
    proText: { fontFamily: Fonts.mono, fontSize: 10, fontWeight: '700', color: c.textInverse, letterSpacing: 0.8 },
    foot: { color: c.textFaint, fontSize: 12, marginTop: -4, textAlign: 'center' },
  });
