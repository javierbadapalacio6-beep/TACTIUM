import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconArrowRight, IconAlert } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import {
  PLAN_BY_TIER,
  CLUB_PLANS,
  PREMIUM_STATUSES,
  formatEur,
  recommendClubPlanForTeams,
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
const makeStatusTint = (c: Palette): Record<SubscriptionStatus, string> => ({
  trialing: c.accent,
  active: c.accent,
  grace_period: c.warning,
  canceled: c.textMuted,
  expired: c.error,
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export const ClubBillingScreen = ({
  navigation,
}: RootStackScreenProps<'ClubBilling'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const STATUS_TINT = useMemo(() => makeStatusTint(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  // Sub activa del club
  const clubSub = useMemo<Subscription | null>(() => {
    if (!club) return null;
    return (
      subscriptions
        .filter(
          (s) =>
            s.subject_type === 'club' &&
            s.subject_id === club.id &&
            PREMIUM_STATUSES.includes(s.status),
        )
        .sort(
          (a, b) =>
            new Date(b.current_period_end).getTime() -
            new Date(a.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subscriptions, club]);

  const currentPlan = clubSub ? PLAN_BY_TIER[clubSub.plan_tier] : null;
  const status = clubSub?.status ?? null;
  const teamsCovered = currentPlan?.teamQuota ?? 0;
  const teamCount = clubTeams.length;
  const overQuota = currentPlan ? teamCount > currentPlan.teamQuota : false;
  const recommended = recommendClubPlanForTeams(teamCount);

  const openStoreSubscriptions = () => {
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() =>
      toast.error('No se pudo abrir', 'Abre Ajustes manualmente.'),
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
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          CLUB · {club?.name?.toUpperCase() ?? 'SIN CLUB'}
        </Text>
        <Text style={styles.title}>Facturación del club</Text>
        <Text style={styles.lede}>
          Gestiona el plan del club y los equipos que cubre. Los capitanes de
          equipos cubiertos no necesitan suscripción individual.
        </Text>

        {/* === STATUS CARD === */}
        <View style={styles.statusCard}>
          {clubSub && currentPlan && status ? (
            <>
              <View style={styles.statusHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{currentPlan.displayName}</Text>
                  <Text style={styles.planMeta}>
                    {clubSub.billing_period === 'yearly' ? 'Anual' : 'Mensual'}
                    {' · '}
                    {clubSub.billing_period === 'yearly'
                      ? formatEur(currentPlan.priceYearlyEur)
                      : formatEur(currentPlan.priceMonthlyEur)}
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
                    : clubSub.cancel_at_period_end
                      ? 'Termina'
                      : 'Próxima renovación'}
                </Text>
                <Text style={styles.statusRowValue}>
                  {formatDate(clubSub.current_period_end)}
                </Text>
              </View>
              {clubSub.scheduled_plan_tier ? (
                <View style={styles.scheduledNotice}>
                  <Text style={styles.scheduledText}>
                    Cambio programado: pasarás a{' '}
                    {PLAN_BY_TIER[clubSub.scheduled_plan_tier].displayName} el{' '}
                    {formatDate(clubSub.current_period_end)}.
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.planName}>Sin plan activo</Text>
              <Text style={styles.planMeta}>
                Suscribe el club para que tus capitanes accedan a las
                funciones premium sin pagar individualmente.
              </Text>
            </>
          )}
        </View>

        {/* === USO DE EQUIPOS === */}
        <View style={styles.usageBlock}>
          <View style={styles.usageHeader}>
            <Text style={styles.sectionLabel}>EQUIPOS</Text>
            <Text style={styles.usageCount}>
              {currentPlan
                ? `${clubTeams.filter((t) => t.covered).length} de ${teamsCovered} cubiertos`
                : `${teamCount} sin cubrir`}
            </Text>
          </View>

          {overQuota && recommended && currentPlan ? (
            <View style={styles.warningCard}>
              <IconAlert size={14} color={c.warning} />
              <Text style={styles.warningText}>
                Tienes {teamCount} equipos pero tu plan {currentPlan.shortLabel}{' '}
                solo cubre {teamsCovered}. Sube a{' '}
                <Text style={{ fontWeight: '700' }}>
                  {recommended.displayName}
                </Text>{' '}
                ({formatEur(recommended.priceMonthlyEur)}/mes) para cubrir
                todos.
              </Text>
            </View>
          ) : null}

          {clubTeams.length === 0 ? (
            <Text style={styles.emptyTeams}>
              Tu club aún no tiene equipos creados.
            </Text>
          ) : (
            <View style={styles.teamList}>
              {clubTeams
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime(),
                )
                .map((t, i) => {
                  // Cobertura REAL por equipo (flag `covered`, el que usa el
                  // motor de entitlements), no por orden de creación.
                  const covered = currentPlan ? !!t.covered : false;
                  return (
                    <View
                      key={t.id}
                      style={[
                        styles.teamRow,
                        i < clubTeams.length - 1 && styles.teamRowDivider,
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.teamName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={styles.teamMeta} numberOfLines={1}>
                          {[t.category, t.gender].filter(Boolean).join(' · ') ||
                            'Sin configurar'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.teamBadge,
                          covered ? styles.teamBadgeOk : styles.teamBadgeOff,
                        ]}
                      >
                        <Text
                          style={[
                            styles.teamBadgeText,
                            {
                              color: covered ? c.accent : c.warning,
                            },
                          ]}
                        >
                          {covered ? 'INCLUIDO' : 'NO CUBIERTO'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>

        {/* === CTAS === */}
        {!clubSub ? (
          <Pressable
            onPress={() => navigation.navigate('Paywall', { intent: 'club' })}
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaPrimaryLabel}>
              Suscribir club · Prueba 14 días
            </Text>
            <IconArrowRight size={16} color={c.textInverse} />
          </Pressable>
        ) : overQuota ? (
          <Pressable
            onPress={() =>
              navigation.navigate('Paywall', { intent: 'upgrade' })
            }
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaPrimaryLabel}>Mejorar plan</Text>
            <IconArrowRight size={16} color={c.textInverse} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              navigation.navigate('Paywall', { intent: 'change' })
            }
            style={({ pressed }) => [
              styles.ctaSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaSecondaryLabel}>Cambiar plan</Text>
          </Pressable>
        )}

        {/* === COMPARATIVA DE PLANES === */}
        <View style={styles.plansCompareBlock}>
          <Text style={styles.sectionLabel}>PLANES DISPONIBLES</Text>
          {CLUB_PLANS.map((p) => {
            const isCurrent = currentPlan?.tier === p.tier;
            return (
              <View
                key={p.tier}
                style={[
                  styles.compareRow,
                  isCurrent && styles.compareRowCurrent,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.compareName}>
                    {p.displayName}
                    {isCurrent ? ' · ACTUAL' : ''}
                  </Text>
                  <Text style={styles.compareQuota}>
                    Hasta {p.teamQuota} equipos
                  </Text>
                </View>
                <Text style={styles.comparePrice}>
                  {formatEur(p.priceMonthlyEur)}
                  <Text style={styles.comparePriceSuffix}>/mes</Text>
                </Text>
              </View>
            );
          })}
        </View>

        {/* === ACCIONES SECUNDARIAS === */}
        <View style={styles.actionsBlock}>
          <Pressable
            onPress={openStoreSubscriptions}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Gestionar en Ajustes</Text>
              <Text style={styles.actionSub}>
                Cancelar o cambiar plan en{' '}
                {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
              </Text>
            </View>
            <IconArrowRight size={14} color={c.textFaint} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },

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
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },

  scroll: { paddingHorizontal: 22, paddingTop: 14 },

  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: c.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 6,
  },
  lede: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },

  // Status card
  statusCard: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    padding: 16,
    marginBottom: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  planMeta: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
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
  statusDivider: { height: 1, backgroundColor: c.hair, marginVertical: 14 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRowLabel: { color: c.textMuted, fontSize: 13 },
  statusRowValue: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  scheduledNotice: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: c.warning + '14',
    borderWidth: 1,
    borderColor: c.warning + '40',
  },
  scheduledText: {
    color: c.warning,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  // Usage block
  usageBlock: { marginBottom: 14 },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.text,
    letterSpacing: 2,
    fontWeight: '500',
  },
  usageCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    letterSpacing: 1,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(242,201,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.40)',
    marginBottom: 10,
  },
  warningText: {
    color: c.text,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  emptyTeams: {
    color: c.textFaint,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 22,
  },

  teamList: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    overflow: 'hidden',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  teamRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
  },
  teamName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  teamMeta: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  teamBadgeOk: {
    backgroundColor: c.accent10,
    borderColor: c.accent40,
  },
  teamBadgeOff: {
    backgroundColor: 'rgba(242,201,76,0.10)',
    borderColor: 'rgba(242,201,76,0.40)',
  },
  teamBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // CTAs
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    marginVertical: 14,
    shadowColor: c.accent,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaPrimaryLabel: {
    color: c.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSecondary: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  ctaSecondaryLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // Plans compare
  plansCompareBlock: {
    marginTop: 8,
    marginBottom: 14,
    gap: 8,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  compareRowCurrent: {
    backgroundColor: c.accent10,
    borderColor: c.accent40,
  },
  compareName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  compareQuota: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  comparePrice: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
  },
  comparePriceSuffix: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },

  // Actions
  actionsBlock: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionSub: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
