import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';

interface TrialTimelineProps {
  visible: boolean;
  /** Nombre del plan elegido, p.ej. "Club Pro". */
  planName: string;
  /** Importe FACTURADO ya formateado, p.ej. "239,99 €/año". Es el elemento
   *  de precio prominente que Apple 3.1.2(c) exige mostrar con claridad. */
  billedLabel: string;
  /** Duración total de la prueba en días (14). */
  trialDays: number;
  /** Día en que avisamos antes de cobrar (≈ trialDays - 2). */
  reminderDays: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Línea de tiempo de la prueba gratuita — el patrón "How your free trial
 * works" que Apple recomienda en su HIG para suscripciones auto-renovables
 * (Hoy → recordatorio → cobro). Aparece como hoja inferior de confirmación
 * justo antes de lanzar la compra real (StoreKit/Play), reduciendo la
 * ansiedad del "¿me cobrarán sin avisar?" y reforzando la transparencia de
 * precio que pide la guideline 3.1.2(c).
 */
export const TrialTimeline = ({
  visible,
  planName,
  billedLabel,
  trialDays,
  reminderDays,
  loading,
  onConfirm,
  onCancel,
}: TrialTimelineProps) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const steps = [
    {
      key: 'today',
      tone: 'active' as const,
      when: 'Hoy',
      desc: `Acceso completo a TACTIUM Pro (${planName}): club, equipos, jornadas, alineaciones y rankings.`,
    },
    {
      key: 'reminder',
      tone: 'active' as const,
      when: `Dentro de ${reminderDays} días`,
      desc: 'Te recordamos que tu prueba está por terminar, por si quieres cancelar antes.',
    },
    {
      key: 'charge',
      tone: 'charge' as const,
      when: `Dentro de ${trialDays} días`,
      desc: `Se te cobrará ${billedLabel} con renovación automática. Cancela cuando quieras desde Ajustes, sin coste.`,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />

          <Text style={styles.eyebrow}>PRUEBA GRATUITA</Text>
          <Text style={styles.title}>Así funciona tu prueba</Text>
          <Text style={styles.subtitle}>
            {trialDays} días gratis · sin compromiso
          </Text>

          <View style={styles.timeline}>
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.railCol}>
                    <View
                      style={[
                        styles.dot,
                        step.tone === 'charge'
                          ? styles.dotCharge
                          : styles.dotActive,
                      ]}
                    />
                    {!isLast ? <View style={styles.rail} /> : null}
                  </View>
                  <View
                    style={[styles.textCol, isLast && { paddingBottom: 4 }]}
                  >
                    <Text
                      style={[
                        styles.stepWhen,
                        step.tone === 'charge' && styles.stepWhenCharge,
                      ]}
                    >
                      {step.when}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            disabled={loading}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.cta,
              loading && { opacity: 0.5 },
              pressed && !loading && { opacity: 0.85 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={c.textInverse} />
            ) : (
              <Text style={styles.ctaLabel}>Iniciar prueba gratuita</Text>
            )}
          </Pressable>
          <Text style={styles.microcopy}>
            Sin cargo hoy · No se renueva si cancelas antes del día {trialDays}
          </Text>

          {!loading ? (
            <Pressable
              onPress={onCancel}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Text style={styles.cancelLink}>Volver</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bgRaised,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: c.hairStrong,
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: c.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  subtitle: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  timeline: {
    marginTop: 22,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  railCol: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  dotActive: {
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dotCharge: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: c.textMuted,
  },
  rail: {
    width: 2,
    flex: 1,
    backgroundColor: c.accentDim,
    marginVertical: 4,
    opacity: 0.55,
  },
  textCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 22,
  },
  stepWhen: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stepWhenCharge: {
    color: c.textMuted,
  },
  stepDesc: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  cta: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaLabel: {
    color: c.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  microcopy: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 12,
  },
  cancelLink: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 14,
  },
});
