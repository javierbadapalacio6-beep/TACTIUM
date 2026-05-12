import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconCheck, AmbientBackdrop } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import { PLAN_BY_TIER, TRIAL_DURATION_DAYS, formatEur } from '@core/subscriptions/plans';
import type { Subscription } from '@core/entitlements/hasPremiumAccess';

// AsyncStorage key para marcar las subs ya saludadas (no mostrar el modal
// dos veces para la misma trial).
const SEEN_KEY_PREFIX = 'tactium-trial-greeted-';
import AsyncStorage from '@react-native-async-storage/async-storage';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Modal one-shot que se muestra la primera vez que un usuario tiene una
 * subscripción `trialing` recién creada (vía trigger DB tras crear club o
 * team). Una vez visto, lo marcamos en AsyncStorage por `subject_type:subject_id`
 * (NO por sub.id) para que un cambio de plan dentro del mismo subject
 * — que genera nueva fila optimistic con id distinto — no relance el modal.
 */
export const TrialStartedModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const [visible, setVisible] = useState(false);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  // seenSubjects es STATE (no ref) para que cambios disparen re-render y
  // el useMemo de unseenTrial recalcule. La clave es `subject_type:subject_id`
  // — no el sub.id — para que cambios de plan que generen nueva fila
  // (mismo subject, otro id) NO relancen el modal.
  const [seenSubjects, setSeenSubjects] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  const subjectKey = (s: Subscription) => `${s.subject_type}:${s.subject_id}`;

  // Hidratamos seenSubjects una vez por user.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHydrated(false);
      setSeenSubjects(new Set());
      return;
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SEEN_KEY_PREFIX + userId);
        if (cancelled) return;
        setSeenSubjects(new Set<string>(raw ? JSON.parse(raw) : []));
      } catch {
        if (!cancelled) setSeenSubjects(new Set<string>());
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Detectar nueva trial: la sub trialing más reciente cuyo subject aún
  // no hayamos saludado.
  const unseenTrial = useMemo<Subscription | null>(() => {
    if (!hydrated || !userId) return null;
    const trials = subscriptions
      .filter(
        (s) => s.status === 'trialing' && s.payer_user_id === userId,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return trials.find((s) => !seenSubjects.has(subjectKey(s))) ?? null;
  }, [subscriptions, userId, seenSubjects, hydrated]);

  useEffect(() => {
    if (unseenTrial && !visible) {
      setCurrentSub(unseenTrial);
      setVisible(true);
    }
  }, [unseenTrial, visible]);

  const handleClose = async () => {
    // Cogemos referencia local del plan ANTES de limpiar currentSub, así
    // el toast siempre tiene el nombre correcto del plan aunque otra
    // actualización del state se entrometa.
    const closingSub = currentSub;
    const closingPlan = closingSub ? PLAN_BY_TIER[closingSub.plan_tier] : null;

    if (closingSub && userId) {
      // Inmutable: nuevo Set para que React detecte el cambio de state.
      // Marcamos el SUBJECT como saludado, no el sub.id — cambios de plan
      // futuros con el mismo subject no relanzarán el modal.
      const next = new Set(seenSubjects);
      next.add(subjectKey(closingSub));
      setSeenSubjects(next);
      try {
        await AsyncStorage.setItem(
          SEEN_KEY_PREFIX + userId,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // ignore — el peor caso es que vuelva a aparecer una vez.
      }
    }
    setVisible(false);
    setCurrentSub(null);

    // Toast confirmatorio AL CERRAR el modal, no antes — así la secuencia
    // queda clara: modal → entendido → toast en la pantalla siguiente.
    if (closingSub && closingPlan) {
      // setTimeout para dejar que la animación de cierre del Modal
      // termine antes de mostrar el toast; si no, FadeIn del toast se
      // solapa con FadeOut del modal y se ve poco.
      setTimeout(() => {
        toast.success(
          `Prueba activa · ${TRIAL_DURATION_DAYS} días`,
          `Plan: ${closingPlan.displayName}`,
        );
      }, 220);
    }
  };

  if (!currentSub) return null;

  const plan = PLAN_BY_TIER[currentSub.plan_tier];
  const trialEnd = currentSub.trial_end ?? currentSub.current_period_end;
  const postTrialPrice = formatEur(plan.priceMonthlyEur);

  const valueProps = [
    'Alineaciones inteligentes con auto-balance',
    'Variantes ilimitadas por jornada',
    'Histórico completo de temporadas',
    'Notificaciones push a tus jugadores',
  ];

  return (
    <Modal
      visible={visible}
      // Sin `transparent`: queremos un fondo SÓLIDO de la app para que no
      // se vea por debajo el screen anterior (el bug que se notaba durante
      // el fade-in con `transparent: true`).
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <AmbientBackdrop intensity={0.4} />
        <Animated.View
          entering={FadeInDown.duration(320)}
          style={[
            styles.card,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 },
          ]}
        >
          <Animated.View entering={FadeIn.duration(260)} style={styles.iconWrap}>
            <TactiumMark size={72} gradient />
          </Animated.View>

          <Text style={styles.eyebrow}>PRUEBA ACTIVADA</Text>
          <Text style={styles.title}>
            14 días de TACTIUM Pro{'\n'}
            <Text style={{ color: Colors.accent }}>gratis</Text>
          </Text>
          <Text style={styles.lede}>
            Acceso completo a todas las funciones. Sin compromiso. Cancela
            cuando quieras.
          </Text>

          {/* Plan resumen */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>PLAN</Text>
              <Text style={styles.summaryValue}>{plan.displayName}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>EXPIRA</Text>
              <Text style={styles.summaryValue}>{formatDate(trialEnd)}</Text>
            </View>
          </View>

          {/* Value props */}
          <View style={styles.valueProps}>
            {valueProps.map((label) => (
              <View key={label} style={styles.valueRow}>
                <View style={styles.checkDot}>
                  <IconCheck size={11} color={Colors.accent} />
                </View>
                <Text style={styles.valueText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Disclaimer obligatorio */}
          <Text style={styles.disclaimer}>
            Tras la prueba, {postTrialPrice}/mes con renovación automática.
            Puedes cancelar en cualquier momento desde Perfil → Suscripción.
          </Text>

          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Empezar"
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaLabel}>Entendido, empezar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: '500',
    marginBottom: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 36,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  summaryItem: { alignItems: 'center', minWidth: 110 },
  summaryDivider: { width: 1, height: 28, backgroundColor: Colors.hair },
  summaryLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '500',
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  valueProps: {
    gap: 10,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
  },
  disclaimer: {
    color: Colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 10,
  },
  cta: {
    height: 54,
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaLabel: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
