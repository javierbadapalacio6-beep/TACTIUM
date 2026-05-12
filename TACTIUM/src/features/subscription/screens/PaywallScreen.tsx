import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius, Spacing } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconX, IconCheck, AmbientBackdrop } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import {
  CAPTAIN_PLAN,
  CLUB_PLANS,
  PREMIUM_STATUSES,
  TRIAL_DURATION_DAYS,
  annualDiscountPercent,
  formatEur,
  type BillingPeriod,
  type PlanDescriptor,
  type PlanTier,
} from '@core/subscriptions/plans';
import { mockPurchasePlan } from '@core/services/subscriptions';

import type { RootStackScreenProps } from '@navigation/types';

// Value props mostradas en el hero. Mantener entre 3-4 para no saturar.
const VALUE_PROPS = [
  'Alineaciones inteligentes con auto-balance por puntos',
  'Variantes de alineación ilimitadas por jornada',
  'Histórico completo de temporadas y jugadores',
  'Notificaciones push a tus jugadores convocados',
];

// Default tier highlighted en cada flow.
const DEFAULT_CLUB_TIER: PlanTier = 'club_pro';

export const PaywallScreen = ({
  navigation,
}: RootStackScreenProps<'Paywall'>) => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeRole = useTeamStore((s) => s.activeRole);
  const club = useClubStore(selectActiveClub);
  const addOptimistic = useSubscriptionStore((s) => s.addOptimistic);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  // Modo: club_admin ve los 3 tier de club; el resto ve solo plan capitán.
  const showClubPlans = activeRole === 'club_admin';

  const [billing, setBilling] = useState<BillingPeriod>('yearly');
  const [selectedTier, setSelectedTier] = useState<PlanTier>(
    showClubPlans ? DEFAULT_CLUB_TIER : 'captain',
  );
  const [purchasing, setPurchasing] = useState(false);

  const visiblePlans: PlanDescriptor[] = useMemo(
    () => (showClubPlans ? CLUB_PLANS : [CAPTAIN_PLAN]),
    [showClubPlans],
  );

  const selectedPlan = useMemo(
    () => visiblePlans.find((p) => p.tier === selectedTier) ?? visiblePlans[0],
    [visiblePlans, selectedTier],
  );

  const price =
    billing === 'yearly'
      ? selectedPlan.priceYearlyEur
      : selectedPlan.priceMonthlyEur;
  const yearlyDiscount = annualDiscountPercent(selectedPlan);

  const handleStartTrial = async () => {
    if (!userId) {
      toast.error('No hay sesión activa');
      return;
    }
    if (showClubPlans && !club?.id) {
      toast.error('Sin club activo', 'Crea un club antes de suscribirte.');
      return;
    }
    setPurchasing(true);
    try {
      // Detectamos si ya había sub premium previa PARA EL MISMO subject.
      // Si sí → es un cambio de plan, no un trial nuevo:
      //   - `mockPurchasePlan` preservará trial_end (no regalamos otro trial).
      //   - El TrialStartedModal NO aparecerá (subject ya saludado).
      //   - Damos feedback inmediato vía toast aquí mismo.
      // Si no → primera compra:
      //   - TrialStartedModal aparece y dispara su propio toast al cerrar.
      const subjectType = showClubPlans ? 'club' : 'user';
      const subjectId = showClubPlans ? (club?.id as string) : userId;
      const hadExistingPremium = subscriptions.some(
        (s) =>
          s.subject_type === subjectType &&
          s.subject_id === subjectId &&
          PREMIUM_STATUSES.includes(s.status),
      );

      const sub = await mockPurchasePlan(userId, {
        tier: selectedPlan.tier,
        billingPeriod: billing,
        clubId: showClubPlans ? club?.id : null,
        startTrial: true,
      });
      addOptimistic(sub);

      if (hadExistingPremium) {
        toast.success(
          'Plan actualizado',
          `Ahora: ${selectedPlan.displayName}`,
        );
      }

      navigation.goBack();
    } catch (e: any) {
      toast.error(
        'No se pudo iniciar la prueba',
        e?.message ?? 'Inténtalo de nuevo.',
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = () => {
    // Cuando integremos RevenueCat SDK real → Purchases.restorePurchases().
    // De momento solo refrescamos lo persistido en DB.
    toast.info(
      'Restaurar compras',
      'Disponible tras la integración del SDK de RevenueCat.',
    );
  };

  return (
    <View style={styles.root}>
      <AmbientBackdrop intensity={0.35} />

      {/* === HEADER === */}
      <Animated.View
        entering={FadeIn.duration(220)}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={10}
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconX size={14} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>TACTIUM PRO</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* === HERO === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(60)}
          style={styles.hero}
        >
          <TactiumMark size={64} gradient />
          <Text style={styles.heroTitle}>
            Pásate a {showClubPlans ? 'Club' : 'Capitán'}
          </Text>
          <Text style={styles.heroLede}>
            {showClubPlans
              ? 'Gestiona todos los equipos del club desde un solo plan, con herramientas pro para tus capitanes.'
              : 'Saca el máximo a tu equipo con alineaciones inteligentes, variantes ilimitadas e histórico completo.'}
          </Text>
        </Animated.View>

        {/* === VALUE PROPS === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(140)}
          style={styles.valueProps}
        >
          {VALUE_PROPS.map((label) => (
            <View key={label} style={styles.valueRow}>
              <View style={styles.checkDot}>
                <IconCheck size={12} color={Colors.accent} />
              </View>
              <Text style={styles.valueText}>{label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* === BILLING TOGGLE === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(220)}
          style={styles.billingToggle}
        >
          {(['monthly', 'yearly'] as const).map((opt) => {
            const sel = billing === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => setBilling(opt)}
                style={[styles.billingChip, sel && styles.billingChipActive]}
              >
                <Text
                  style={[
                    styles.billingChipText,
                    sel && styles.billingChipTextActive,
                  ]}
                >
                  {opt === 'monthly' ? 'Mensual' : 'Anual'}
                </Text>
                {opt === 'yearly' && yearlyDiscount > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      -{yearlyDiscount}%
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* === PLANS === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(300)}
          style={styles.plansBlock}
        >
          {visiblePlans.map((plan) => {
            const sel = plan.tier === selectedTier;
            const monthlyEquiv =
              billing === 'yearly'
                ? (plan.priceYearlyEur / 12).toFixed(2).replace('.', ',')
                : plan.priceMonthlyEur.toFixed(2).replace('.', ',');
            const showBadge = plan.tier === DEFAULT_CLUB_TIER && showClubPlans;
            return (
              <Pressable
                key={plan.tier}
                onPress={() => setSelectedTier(plan.tier)}
                style={({ pressed }) => [
                  styles.planCard,
                  sel && styles.planCardSelected,
                  pressed && { opacity: 0.95 },
                ]}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <Text style={styles.planTitle}>{plan.displayName}</Text>
                    <Text style={styles.planQuota}>
                      {plan.tier === 'captain'
                        ? 'Para 1 capitán'
                        : `Hasta ${plan.teamQuota} equipos`}
                    </Text>
                  </View>
                  {showBadge ? (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>RECOM.</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>{monthlyEquiv}</Text>
                  <Text style={styles.planPriceSuffix}>€/mes</Text>
                  {billing === 'yearly' ? (
                    <Text style={styles.planAnnualHint}>
                      · {formatEur(plan.priceYearlyEur)} / año
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* === DISCLAIMER (Apple/Google obligan visible) === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(360)}
          style={styles.disclaimer}
        >
          <Text style={styles.disclaimerText}>
            Pago tras {TRIAL_DURATION_DAYS} días de prueba.{' '}
            {formatEur(price)}/
            {billing === 'monthly' ? 'mes' : 'año'} con renovación automática.
            Cancela en cualquier momento desde Ajustes.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* === FOOTER CTA === */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}
      >
        <Pressable
          disabled={purchasing}
          onPress={handleStartTrial}
          style={({ pressed }) => [
            styles.cta,
            purchasing && { opacity: 0.5 },
            pressed && !purchasing && { opacity: 0.85 },
          ]}
        >
          {purchasing ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.ctaLabel}>
              Empezar prueba {TRIAL_DURATION_DAYS} días
            </Text>
          )}
        </Pressable>
        <View style={styles.footerLinks}>
          <Pressable
            onPress={handleRestore}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Restaurar compras"
          >
            <Text style={styles.footerLink}>Restaurar compras</Text>
          </Pressable>
          <Text style={styles.footerLinkSep}>·</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Continuar gratis"
          >
            <Text style={styles.footerLink}>Continuar gratis</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },

  scroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  // Hero
  hero: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 8,
  },
  heroLede: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },

  // Value props
  valueProps: {
    gap: 10,
    marginBottom: 22,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  valueText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 19,
    flex: 1,
  },

  // Billing toggle
  billingToggle: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    marginBottom: 14,
  },
  billingChip: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  billingChipActive: {
    backgroundColor: Colors.bgRaised,
  },
  billingChipText: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  billingChipTextActive: { color: Colors.text },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  discountBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Plan cards
  plansBlock: {
    gap: 10,
    marginBottom: 18,
  },
  planCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
    gap: 4,
  },
  planCardSelected: {
    // Fondo sólido (bgRaised, ligeramente más claro que bgCard) + borde
    // accent doble grosor + sombra accent para destacar sin transparencia.
    backgroundColor: Colors.bgRaised,
    borderColor: Colors.accent,
    borderWidth: 2,
    shadowColor: Colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  planQuota: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  recommendedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  recommendedBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  planPrice: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  planPriceSuffix: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  planAnnualHint: {
    color: Colors.textFaint,
    fontSize: 11,
    fontFamily: Fonts.mono,
  },
  planCheckmark: {
    position: 'absolute',
    top: 14,
    right: 14,
  },

  // Disclaimer
  disclaimer: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  disclaimerText: {
    color: Colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
    backgroundColor: Colors.background,
    gap: 12,
  },
  cta: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaLabel: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  footerLinkSep: {
    color: Colors.textFaint,
  },
});
