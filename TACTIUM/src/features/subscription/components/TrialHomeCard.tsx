import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TrialExpiringBanner } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { isDbTrial } from '@core/services/subscriptions';
import {
  PLAN_BY_TIER,
  TRIAL_DURATION_DAYS,
  formatEur,
} from '@core/subscriptions/plans';

import type { RootStackParamList } from '@navigation/types';

const DAY_MS = 24 * 60 * 60 * 1000;
// Día en que avisamos antes de que acabe la prueba.
const REMINDER_DAY = 12;
// Con ≤3 días la tarjeta deja paso al aviso compacto (TrialExpiringBanner).
const BANNER_THRESHOLD_DAYS = 3;

/**
 * Tarjeta de Inicio mientras dura la PRUEBA GRATIS de BD (la de 14 días sin
 * tarjeta que arranca al crear el primer equipo o el club). Solo para quien
 * paga (capitán / gestor del club). Explica qué es gratis y qué premium, y
 * enseña la línea de tiempo con el importe FACTURADO como lo más visible
 * (norma Apple 3.1.2c).
 *
 * Cuando quedan ≤3 días se sustituye por `TrialExpiringBanner`.
 */
export const TrialHomeCard: React.FC<{
  /** Padding horizontal del contenedor donde se monta (Inicio = 22, panel del
   *  club = 0). La tarjeta queda siempre a 22 del borde. */
  containerPadding?: number;
}> = ({ containerPadding = 22 }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const anyTrialDays = useSubscriptionStore((s) => s.trialDaysLeft());

  const trial = useMemo(() => {
    if (!userId) return null;
    const now = Date.now();
    return (
      subscriptions
        .filter(
          (s) =>
            s.payer_user_id === userId &&
            isDbTrial(s) &&
            new Date(s.trial_end ?? s.current_period_end).getTime() > now,
        )
        .sort(
          (a, b) =>
            new Date(a.trial_end ?? a.current_period_end).getTime() -
            new Date(b.trial_end ?? b.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subscriptions, userId]);

  // Aviso compacto en los últimos días (cualquier prueba, también la de tienda).
  if (anyTrialDays !== null && anyTrialDays <= BANNER_THRESHOLD_DAYS) {
    return (
      <View style={{ marginHorizontal: -containerPadding, marginBottom: 8 }}>
        <TrialExpiringBanner thresholdDays={BANNER_THRESHOLD_DAYS} />
      </View>
    );
  }

  if (!trial) return null;

  const end = new Date(trial.trial_end ?? trial.current_period_end).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
  const plan = PLAN_BY_TIER[trial.plan_tier];
  const yearly = trial.billing_period === 'yearly';
  const billed = plan
    ? `${formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}/${yearly ? 'año' : 'mes'}`
    : '';
  const intent = trial.subject_type === 'club' ? 'club' : 'captain';

  return (
    <View style={[styles.card, { marginHorizontal: 22 - containerPadding }]}>
      <Text style={styles.eyebrow}>
        PRUEBA GRATIS · {daysLeft === 1 ? 'QUEDA 1 DÍA' : `QUEDAN ${daysLeft} DÍAS`}
      </Text>
      <Text style={styles.body}>
        Montar el equipo e invitar es gratis. La gestión (jornadas,
        alineaciones, escáner, recordatorios) es premium.
      </Text>

      <View style={styles.timeline}>
        <Step styles={styles} label="HOY" desc="Todo desbloqueado" active />
        <Step
          styles={styles}
          label={`DÍA ${REMINDER_DAY}`}
          desc="Te avisamos"
        />
        <Step
          styles={styles}
          label={`DÍA ${TRIAL_DURATION_DAYS}`}
          price={billed}
          desc="cancela cuando quieras"
          last
        />
      </View>

      <Pressable
        onPress={() => navigation.navigate('Paywall', { intent })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.ctaLabel}>Elegir plan</Text>
      </Pressable>
    </View>
  );
};

const Step: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  label: string;
  desc: string;
  price?: string;
  active?: boolean;
  last?: boolean;
}> = ({ styles, label, desc, price, active, last }) => (
  <View style={[styles.step, last && { flex: 1.3 }]}>
    <View style={[styles.dot, active && styles.dotActive]} />
    <Text style={styles.stepLabel}>{label}</Text>
    {price ? <Text style={styles.stepPrice}>{price}</Text> : null}
    <Text style={styles.stepDesc}>{desc}</Text>
  </View>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.bgCard,
      marginBottom: 16,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '600',
    },
    body: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 8,
    },
    timeline: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    step: { flex: 1, minWidth: 0 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.hairStrong,
      marginBottom: 6,
    },
    dotActive: { backgroundColor: c.accent },
    stepLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: '600',
    },
    stepPrice: {
      color: c.text,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginTop: 3,
    },
    stepDesc: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },
    cta: {
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    ctaLabel: {
      color: c.textInverse,
      fontSize: 14,
      fontWeight: '700',
    },
  });
