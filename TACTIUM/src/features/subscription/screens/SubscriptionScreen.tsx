import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconArrowRight, IconCheck } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import {
  PLAN_BY_TIER,
  formatEur,
  PREMIUM_STATUSES,
  type SubscriptionStatus,
} from '@core/subscriptions/plans';
import type { Subscription } from '@core/entitlements/hasPremiumAccess';

import type { RootStackScreenProps } from '@navigation/types';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: 'En prueba',
  active: 'Activa',
  grace_period: 'Pago pendiente',
  canceled: 'Cancelada',
  expired: 'Expirada',
};

const STATUS_TINT: Record<SubscriptionStatus, string> = {
  trialing: Colors.accent,
  active: Colors.accent,
  grace_period: Colors.warning,
  canceled: Colors.textMuted,
  expired: Colors.error,
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export const SubscriptionScreen = ({
  navigation,
}: RootStackScreenProps<'Subscription'>) => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeRole = useTeamStore((s) => s.activeRole);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  // Sub del propio user (subject_type='user'). La activa más reciente.
  const mySub = useMemo<Subscription | null>(() => {
    if (!userId) return null;
    return (
      subscriptions
        .filter((s) => s.subject_type === 'user' && s.subject_id === userId)
        .sort(
          (a, b) =>
            new Date(b.current_period_end).getTime() -
            new Date(a.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subscriptions, userId]);

  // ¿Hay sub de club que cubra al captain? (info para "tu club ya paga").
  const clubCovering = useMemo<Subscription | null>(() => {
    return (
      subscriptions.find(
        (s) =>
          s.subject_type === 'club' && PREMIUM_STATUSES.includes(s.status),
      ) ?? null
    );
  }, [subscriptions]);

  const plan = mySub ? PLAN_BY_TIER[mySub.plan_tier] : null;
  const status = mySub?.status ?? null;

  const openStoreSubscriptions = () => {
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() =>
      toast.error('No se pudo abrir', 'Abre Ajustes manualmente.'),
    );
  };

  const handleRestore = () => {
    toast.info(
      'Restaurar compras',
      'Disponible tras la integración del SDK de RevenueCat.',
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar suscripción',
      'La cancelación se gestiona desde Ajustes de tu cuenta de App Store / Google Play. Te abrimos esa pantalla ahora.',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Abrir Ajustes', onPress: openStoreSubscriptions },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={Colors.text} />
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>MI SUSCRIPCIÓN</Text>
        <Text style={styles.title}>Plan y facturación</Text>
        <Text style={styles.lede}>
          Gestiona tu plan TACTIUM Pro y consulta el estado de tu suscripción.
        </Text>

        {/* === STATUS CARD === */}
        <View style={styles.statusCard}>
          {mySub && plan && status ? (
            <>
              <View style={styles.statusHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.displayName}</Text>
                  <Text style={styles.planMeta}>
                    {mySub.billing_period === 'yearly' ? 'Plan anual' : 'Plan mensual'}
                    {' · '}
                    {mySub.billing_period === 'yearly'
                      ? formatEur(plan.priceYearlyEur)
                      : formatEur(plan.priceMonthlyEur)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { borderColor: STATUS_TINT[status] + '66' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: STATUS_TINT[status] },
                    ]}
                  >
                    {STATUS_LABEL[status]}
                  </Text>
                </View>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusRow}>
                <Text style={styles.statusRowLabel}>
                  {status === 'trialing'
                    ? 'Prueba termina'
                    : mySub.cancel_at_period_end
                      ? 'Termina'
                      : 'Próxima renovación'}
                </Text>
                <Text style={styles.statusRowValue}>
                  {formatDate(mySub.current_period_end)}
                </Text>
              </View>
              {clubCovering ? (
                <View style={styles.coverNotice}>
                  <View style={styles.coverDot}>
                    <IconCheck size={12} color={Colors.accent} />
                  </View>
                  <Text style={styles.coverText}>
                    Tu club ya cubre tu plan. Puedes cancelar la suscripción
                    individual en Ajustes y ahorrar{' '}
                    {formatEur(plan.priceMonthlyEur)}/mes.
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.planName}>Plan gratuito</Text>
              <Text style={styles.planMeta}>
                Aún no tienes suscripción premium activa.
              </Text>
              {clubCovering ? (
                <View style={[styles.coverNotice, { marginTop: 14 }]}>
                  <View style={styles.coverDot}>
                    <IconCheck size={12} color={Colors.accent} />
                  </View>
                  <Text style={styles.coverText}>
                    Tu club te cubre. Tienes acceso premium sin pagar nada.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* === CTA PRINCIPAL === */}
        {!mySub || status === 'expired' || status === 'canceled' ? (
          <Pressable
            onPress={() => navigation.navigate('Paywall', { intent: 'upgrade' })}
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaPrimaryLabel}>
              {activeRole === 'club_admin'
                ? 'Suscribir el club'
                : 'Hazte Pro · Prueba 14 días'}
            </Text>
            <IconArrowRight size={16} color={Colors.textInverse} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Paywall', { intent: 'change' })}
            style={({ pressed }) => [
              styles.ctaSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaSecondaryLabel}>Cambiar plan</Text>
          </Pressable>
        )}

        {/* === ACTIONS === */}
        <View style={styles.actionsBlock}>
          <ActionRow
            label="Gestionar suscripción"
            sub={
              Platform.OS === 'ios'
                ? 'Cancelar o cambiar plan en App Store'
                : 'Cancelar o cambiar plan en Google Play'
            }
            onPress={openStoreSubscriptions}
          />
          <ActionRow
            label="Restaurar compras"
            sub="Recupera tu plan si reinstalaste la app"
            onPress={handleRestore}
          />
          {mySub && !mySub.cancel_at_period_end && status !== 'expired' ? (
            <ActionRow
              label="Cancelar suscripción"
              sub="No se renovará al expirar"
              destructive
              onPress={handleCancel}
            />
          ) : null}
        </View>

        {/* === LEGAL === */}
        <View style={styles.legalBlock}>
          <Text style={styles.legalText}>
            Términos de uso y Política de Privacidad disponibles en
            tactium.io/legal
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// ─── ActionRow ──────────────────────────────────────────────────────────────
const ActionRow: React.FC<{
  label: string;
  sub: string;
  destructive?: boolean;
  onPress: () => void;
}> = ({ label, sub, destructive, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${label}. ${sub}`}
    style={({ pressed }) => [
      styles.actionRow,
      pressed && { opacity: 0.85 },
    ]}
  >
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={[
          styles.actionLabel,
          destructive && { color: Colors.error },
        ]}
      >
        {label}
      </Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </View>
    <IconArrowRight
      size={14}
      color={destructive ? Colors.error : Colors.textFaint}
    />
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  backLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },

  scroll: { paddingHorizontal: 22, paddingTop: 14 },

  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 6,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },

  // Status card
  statusCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
    marginBottom: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  planMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusDivider: {
    height: 1,
    backgroundColor: Colors.hair,
    marginVertical: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRowLabel: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  statusRowValue: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  coverNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  coverDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: Colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  coverText: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },

  // CTAs
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    marginBottom: 14,
    shadowColor: Colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaPrimaryLabel: {
    color: Colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSecondary: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ctaSecondaryLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // Actions block
  actionsBlock: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hair,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  legalBlock: {
    marginTop: 18,
    alignItems: 'center',
  },
  legalText: {
    color: Colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
  },
});
