import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  MAYBE_REASONS,
  type Availability,
  type AvailabilityStatus,
  type MaybeReason,
} from '@core/services/availability';
import { formatTimeLeft } from '@core/hooks/useMatchdayAvailability';

import { MaybeSheet } from './MaybeSheet';
import { statusColor, withAlpha } from './statusColors';

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** «vie 10:30» */
export function formatDeadline(d: Date): string {
  return `${DAYS[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  jornadaNumber: number | null;
  answer: Availability | undefined;
  deadline: Date | null;
  maybeClosed: boolean;
  onRespond: (
    status: AvailabilityStatus,
    extra?: { reason?: MaybeReason | null; note?: string | null },
  ) => Promise<boolean>;
  /** Integrada dentro de la tarjeta de la jornada (sin caja propia). */
  embedded?: boolean;
  /** Paleta forzada: la tarjeta de la jornada es siempre oscura. */
  palette?: Palette;
}

/**
 * Tarjeta «¿Puedes jugar?» del jugador en Inicio. Tres respuestas en un toque.
 * En duda: se pone ámbar, enseña la cuenta atrás al cierre y solo ofrece
 * Voy / No puedo (la duda tiene que resolverse).
 */
export const RsvpCard: React.FC<Props> = ({
  jornadaNumber,
  answer,
  deadline,
  maybeClosed,
  onRespond,
  embedded = false,
  palette,
}) => {
  const themed = useColors();
  const c = palette ?? themed;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const status = answer?.status ?? null;
  const isMaybe = status === 'maybe';
  const jNum = jornadaNumber != null ? `J${String(jornadaNumber).padStart(2, '0')}` : 'Jornada';
  // Integrada en la tarjeta de la jornada, el número ya se ve arriba.
  const jLabel = embedded ? '' : `${jNum} · `;
  const deadlineLabel = deadline ? formatDeadline(deadline) : null;
  const reasonLabel = answer?.reason
    ? MAYBE_REASONS.find((r) => r.id === answer.reason)?.label
    : null;

  // En duda (o con la duda ya cerrada) solo quedan dos salidas.
  const options: AvailabilityStatus[] = isMaybe || maybeClosed ? ['yes', 'no'] : ['yes', 'maybe', 'no'];

  const press = (s: AvailabilityStatus) => {
    if (s === 'maybe') {
      setSheetOpen(true);
      return;
    }
    onRespond(s);
  };

  const eyebrow = isMaybe
    ? `${jLabel}ESTÁS EN DUDA`
    : status === 'yes'
      ? `${jLabel}VAS`
      : status === 'no'
        ? `${jLabel}NO PUEDES`
        : `${jLabel}¿PUEDES JUGAR?`;

  return (
    <View
      style={
        embedded
          ? styles.embedded
          : [
              styles.card,
              isMaybe && { borderColor: withAlpha(c.warning, 0.5) },
              status === null && { borderColor: c.accent40 },
            ]
      }
    >
      <View style={styles.headRow}>
        <Text style={[styles.eyebrow, { color: statusColor(c, status ?? 'yes') }]}>{eyebrow}</Text>
        {isMaybe && reasonLabel ? (
          <View style={styles.reasonChip}>
            <Text style={styles.reasonChipText}>{reasonLabel.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {isMaybe && deadline ? (
        <View style={styles.countdownRow}>
          <Text style={styles.countdown}>{formatTimeLeft(deadline)}</Text>
          <Text style={styles.countdownLabel}>para decidir</Text>
        </View>
      ) : null}
      {isMaybe && deadlineLabel ? (
        <Text style={styles.hint}>Si no decides antes del {deadlineLabel}, contarás como «No puedo».</Text>
      ) : status === null ? (
        <Text style={styles.hint}>
          {maybeClosed ? 'La convocatoria está a punto de cerrar: di si vas o no.' : 'Tu capitán lo verá al momento.'}
        </Text>
      ) : answer?.auto_resolved ? (
        <Text style={styles.hint}>Tu duda no se resolvió a tiempo y cuentas como «No puedo». Puedes cambiarlo.</Text>
      ) : status === 'yes' ? (
        <Text style={styles.hint}>Tu capitán ya lo sabe. Te avisaremos cuando publique la alineación.</Text>
      ) : status === 'no' ? (
        <Text style={styles.hint}>Tu capitán ya lo sabe. Si al final puedes, cámbialo aquí.</Text>
      ) : null}

      <View style={styles.buttons}>
        {options.map((s) => {
          const on = status === s;
          const col = statusColor(c, s);
          return (
            <Pressable
              key={s}
              onPress={() => press(s)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={s === 'yes' ? 'Voy' : s === 'maybe' ? 'Duda' : 'No puedo'}
              style={({ pressed }) => [
                styles.btn,
                embedded && { backgroundColor: c.black35 },
                on && s === 'yes' && { backgroundColor: c.accent, borderColor: c.accent },
                on && s !== 'yes' && { backgroundColor: withAlpha(col, 0.12), borderColor: col },
                status !== null && !on && { opacity: 0.6 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.btnLabel,
                  on && { color: s === 'yes' ? c.textInverse : col },
                ]}
              >
                {s === 'yes' ? 'Voy' : s === 'maybe' ? 'Duda' : 'No puedo'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <MaybeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={jornadaNumber != null ? `Jornada ${jornadaNumber}` : 'Jornada'}
        deadlineLabel={deadlineLabel}
        initialReason={answer?.reason ?? null}
        initialNote={answer?.note ?? null}
        onSave={async (reason, note) => {
          setSheetOpen(false);
          await onRespond('maybe', { reason, note });
        }}
      />
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
      gap: 8,
    },
    embedded: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderColor: c.hairStrong,
      gap: 8,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.2, fontWeight: '600' },
    reasonChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(c.warning, 0.45),
      backgroundColor: withAlpha(c.warning, 0.12),
    },
    reasonChipText: { fontFamily: Fonts.mono, fontSize: 10, color: c.warning, letterSpacing: 0.6 },
    countdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    countdown: { fontFamily: Fonts.mono, fontSize: 26, fontWeight: '700', color: c.warning },
    countdownLabel: { color: c.textMuted, fontSize: 13 },
    hint: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 4 },
    btn: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
  });
