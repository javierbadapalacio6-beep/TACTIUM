import React, { useMemo, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconArrowRight, IconCheck } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useClubStore } from '@store/clubStore';
import { useTeamPro } from '@features/settings/useTeamPro';
import { clubCoverage } from '@core/entitlements/coverage';
import {
  DbTrialBlock,
  BillingToggle,
} from '@features/subscription/components/PaywallParts';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import {
  PLAN_BY_TIER,
  CAPTAIN_PLAN,
  TRIAL_DURATION_DAYS,
  annualDiscountPercent,
  formatEur,
  type BillingPeriod,
  type SubscriptionStatus,
  isLiveSub,
} from '@core/subscriptions/plans';
import type { Subscription } from '@core/entitlements/hasPremiumAccess';
import {
  CAPTAIN_SEATS,
  captainFirstNames,
  formatCoverDate,
} from '@core/services/teamCaptains';
import { restorePurchases, presentCodeRedemption } from '@core/purchases';

import type { RootStackParamList, RootStackScreenProps } from '@navigation/types';

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
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * «Próximo cobro: 01/10/2026 · 47,99 €» (o «Primer cobro» en una prueba de
 * pago), con lo que ya hay en la fila: fin del periodo y precio del plan en
 * `plans.ts`. Null si no va a haber cobro: la prueba sin tarjeta (`trial_*`,
 * sin pasarela) no cobra nada al acabar, y con la baja pedida tampoco.
 * Mismo criterio que `nextChargeLine` de la web (MiSuscripcion.tsx).
 */
function nextCharge(sub: Subscription | null): { label: string; value: string } | null {
  if (!sub || sub.cancel_at_period_end || !sub.current_period_end) return null;
  if ((sub.product_id ?? '').startsWith('trial_')) return null;
  if (sub.status !== 'trialing' && sub.status !== 'active' && sub.status !== 'grace_period') {
    return null;
  }
  const plan = PLAN_BY_TIER[sub.plan_tier];
  if (!plan) return null;
  const amount = formatEur(
    sub.billing_period === 'yearly' ? plan.priceYearlyEur : plan.priceMonthlyEur,
  );
  return {
    label: sub.status === 'trialing' ? 'Primer cobro' : 'Próximo cobro',
    value: `${formatDate(sub.current_period_end)} · ${amount}`,
  };
}

type SubscriptionScreenProps = Partial<RootStackScreenProps<'Subscription'>> & {
  /**
   * TABLET: pintada como DETALLE de Ajustes (lista + detalle, como los
   * Ajustes del iPad). Sin cabecera «Volver» ni hueco de la barra de estado.
   */
  embedded?: boolean;
};

export const SubscriptionScreen = ({
  navigation: navProp,
  embedded = false,
}: SubscriptionScreenProps) => {
  const fallbackNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation = (navProp ?? fallbackNav) as NativeStackNavigationProp<RootStackParamList>;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const STATUS_TINT = useMemo(() => makeStatusTint(c), [c]);
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeRole = useTeamStore((s) => s.activeRole);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const refreshSubs = useSubscriptionStore((s) => s.refresh);
  const [restoring, setRestoring] = useState(false);
  const team = useTeamStore((s) => s.team);
  const teams = useTeamStore((s) => s.teams);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const clubs = useClubStore((s) => s.clubs);
  const activeClubId = useClubStore((s) => s.activeClubId);
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  // «El plan Capitán cubre al equipo» (hasta 3 capitanes): cobertura del
  // equipo activo, si es independiente…
  const teamCov = useSubscriptionStore((s) =>
    team && !team.club_id ? s.teamCoverage[team.id] ?? null : null,
  );
  // …y el equipo que cubre MI plan (uno solo: el mío o, si no tengo, aquel
  // en el que soy capitán desde hace más tiempo). Puede no ser el activo.
  const myPlanCov = useSubscriptionStore((s) =>
    Object.values(s.teamCoverage).find((r) => r.covered && r.payer_user_id === userId) ?? null,
  );

  // Una «Mi suscripción» por rol: el jugador no compra nada, el club va a la
  // facturación del club y el capitán (o quien no tiene rol de gestión) ve
  // su plan propio.
  const mode: 'player' | 'club' | 'captain' =
    activeRole === 'player' ? 'player' : activeRole === 'club_admin' ? 'club' : 'captain';

  // ¿El equipo del jugador tiene Pro? (sin decir quién paga)
  const teamPro = useTeamPro(team, mode === 'player');

  // Club activo y su suscripción.
  const clubId = activeClubId ?? clubs[0]?.id ?? null;
  const club = clubs.find((cl) => cl.id === clubId) ?? null;
  const clubSub = useMemo<Subscription | null>(
    () =>
      subscriptions.find(
        (s) => s.subject_type === 'club' && s.subject_id === clubId && isLiveSub(s),
      ) ?? null,
    [subscriptions, clubId],
  );
  const coverage = useMemo(
    () => clubCoverage(clubId, teams, subscriptions),
    [clubId, teams, subscriptions],
  );

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
          s.subject_type === 'club' && isLiveSub(s),
      ) ?? null
    );
  }, [subscriptions]);

  // La que manda ahora mismo, sea de persona (capitán) o de club.
  const activeSub = useMemo<Subscription | null>(() => {
    if (mySub && isLiveSub(mySub)) return mySub;
    return clubCovering;
  }, [mySub, clubCovering]);
  // ¿A qué familia se puede saltar? De club a capitán, o al revés.
  const switchTarget: 'club' | 'captain' | null = activeSub
    ? activeSub.plan_tier === 'captain'
      ? 'club'
      : 'captain'
    : null;

  const plan = mySub ? PLAN_BY_TIER[mySub.plan_tier] : null;

  // Pago yo el plan: «Cubre a los capitanes de X: Ana, Leti».
  const myPlanTeamName = myPlanCov
    ? teams.find((t) => t.id === myPlanCov.team_id)?.name ?? null
    : null;
  const mates = myPlanCov ? captainFirstNames(myPlanCov.captains, userId) : [];
  const seatsLine =
    myPlanCov && myPlanTeamName
      ? mates.length > 0
        ? `Cubre a los capitanes de ${myPlanTeamName}: ${mates.join(', ')}`
        : `Cubre a ${myPlanTeamName} y hasta ${CAPTAIN_SEATS - 1} capitanes más`
      : null;
  // Me cubre el plan de otro capitán del equipo (no pago yo).
  const coveredByMate =
    !!teamCov?.covered &&
    teamCov.payer_user_id !== userId &&
    !(mySub && isLiveSub(mySub));
  const goManageCaptains = () =>
    navigation.navigate('MainTabs', { screen: 'Team', params: { screen: 'TeamRoot' } });
  const status = mySub?.status ?? null;
  // Prueba SIN tarjeta de la base (product_id `trial_*`): mismo bloque que el
  // paywall (días que quedan y línea de tiempo).
  const dbTrial =
    !!mySub &&
    status === 'trialing' &&
    isLiveSub(mySub) &&
    (mySub.product_id ?? '').startsWith('trial_');
  const charge = useMemo(() => nextCharge(mySub), [mySub]);
  const yearlyChip = annualDiscountPercent(CAPTAIN_PLAN) > 0;
  const billed =
    period === 'yearly' ? CAPTAIN_PLAN.priceYearlyEur : CAPTAIN_PLAN.priceMonthlyEur;

  /**
   * ¿La suscripción viva se compró en la WEB (Stripe) y no en la tienda?
   *
   * Importa mucho más de lo que parece. Esta pantalla daba por hecho que todo
   * venía de App Store o Google Play, y con una sub de Stripe eso llevaba a
   * dos sitios malos:
   *
   *  · «Cambiar plan», «Mejorar» y el salto club↔capitán mandaban a la
   *    pasarela de la TIENDA. Comprar allí no sustituye a la de Stripe —son
   *    dos comercios distintos— asi que te quedabas con DOS suscripciones
   *    vivas y DOS cobros. Nada lo impedía: la única unicidad en la base es
   *    por transacción, no por sujeto.
   *  · «Gestionar suscripción» abría la ficha de la tienda, donde no hay nada
   *    tuyo que gestionar.
   *
   * La web ya hace lo simétrico: su checkout devuelve 409 si ya tienes una
   * sub de tienda. Esto cierra el otro lado.
   */
  const subWeb = (activeSub ?? mySub)?.platform === 'web';

  const openWebBilling = () => {
    Linking.openURL('https://tactium.io/suscripcion').catch(() =>
      toast.error('No se pudo abrir', 'Entra en tactium.io desde el navegador.'),
    );
  };

  const openStoreSubscriptions = () => {
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() =>
      toast.error('No se pudo abrir', 'Abre Ajustes manualmente.'),
    );
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const hasAny = Object.keys(info.entitlements.active).length > 0;
      if (hasAny) {
        toast.success(
          'Compras restauradas',
          'Tu suscripción se ha vinculado a esta cuenta.',
        );
        if (userId) await refreshSubs(userId);
      } else {
        toast.info(
          'Sin compras previas',
          'No encontramos suscripciones en esta cuenta de Apple.',
        );
      }
    } catch (e: any) {
      toast.error('No se pudo restaurar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRedeemCode = async () => {
    try {
      await presentCodeRedemption();
      if (userId) await refreshSubs(userId);
    } catch (e: any) {
      toast.error('No se pudo abrir el canje', e?.message ?? 'Inténtalo de nuevo.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar la renovación',
      'La cancelación se gestiona desde Ajustes de tu cuenta de App Store / Google Play. Te abrimos esa pantalla ahora.',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Abrir Ajustes', onPress: openStoreSubscriptions },
      ],
    );
  };

  return (
    <View style={styles.root}>
      {embedded ? null : (
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
        <View style={{ flex: 1 }} />
      </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          embedded && { paddingTop: insets.top + 20 },
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>MI SUSCRIPCIÓN</Text>

        {mode === 'player' ? (
          <PlayerCoverage
            teamName={team?.name ?? null}
            teamPro={teamPro}
            onCreateTeam={() => {
              setSoloUpgrade(true);
              setSoloMode(false);
            }}
            onRestore={handleRestore}
            restoring={restoring}
          />
        ) : mode === 'club' ? (
          <ClubSummary
            clubName={club?.name ?? null}
            sub={clubSub}
            used={coverage.used}
            quota={coverage.quota}
            personalLive={!!mySub && isLiveSub(mySub) && mySub.plan_tier === 'captain'}
            onOpenBilling={() => navigation.navigate('ClubBilling')}
          />
        ) : (
        <>
        {dbTrial && mySub ? (
          <>
            <DbTrialBlock
              startIso={mySub.current_period_start ?? mySub.created_at ?? null}
              endIso={mySub.trial_end ?? mySub.current_period_end}
              trialDays={TRIAL_DURATION_DAYS}
            />
            <View style={{ marginTop: 14 }}>
              <BillingToggle value={period} onChange={setPeriod} showYearlyChip={yearlyChip} />
            </View>
            {/* Apple 3.1.2c: el importe que se cobra es lo más grande. */}
            <View style={styles.trialPlan}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.trialPlanName}>{CAPTAIN_PLAN.displayName}</Text>
                <Text style={styles.planMeta}>
                  {team?.name && !team.club_id ? `Cubre a ${team.name}` : '1 equipo'} · todo Pro
                </Text>
                {seatsLine ? (
                  <Pressable onPress={goManageCaptains} accessibilityRole="link" hitSlop={6}>
                    <Text style={styles.planMeta}>{seatsLine}</Text>
                    <Text style={[styles.planMeta, { color: c.accent, fontWeight: '700' }]}>
                      Gestionar capitanes ›
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.trialPrice}>
                {formatEur(billed)}
                <Text style={styles.trialPriceUnit}>
                  {period === 'yearly' ? '/año' : '/mes'}
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Paywall', { intent: 'upgrade' })}
              style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={styles.ctaPrimaryLabel}>Elegir el plan Capitán</Text>
              <IconArrowRight size={16} color={c.textInverse} />
            </Pressable>
          </>
        ) : (
        <>
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
                  {mySub.plan_tier === 'captain' && team && !team.club_id ? (
                    seatsLine ? (
                      <Pressable onPress={goManageCaptains} accessibilityRole="link" hitSlop={6}>
                        <Text style={styles.planMeta}>{seatsLine}</Text>
                        <Text style={[styles.planMeta, { color: c.accent, fontWeight: '700' }]}>
                          Gestionar capitanes ›
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.planMeta}>Cubre a {team.name}</Text>
                    )
                  ) : null}
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
              {/* En activa, «Próximo cobro: fecha · importe» sustituye a la
                  fecha de renovación; en prueba de pago va debajo como
                  «Primer cobro». */}
              {charge && status !== 'trialing' ? null : (
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
              )}
              {charge ? (
                <View
                  style={[styles.statusRow, status === 'trialing' && { marginTop: 8 }]}
                >
                  <Text style={styles.statusRowLabel}>{charge.label}</Text>
                  <Text style={styles.statusRowValue}>{charge.value}</Text>
                </View>
              ) : null}
              {mySub.cancel_at_period_end ? (
                <View style={styles.scheduledNotice}>
                  <Text style={styles.scheduledText}>
                    No se renovará: tu acceso termina el{' '}
                    {formatDate(mySub.current_period_end)}.
                  </Text>
                </View>
              ) : null}
              {mySub.scheduled_plan_tier ? (
                <View style={styles.scheduledNotice}>
                  <Text style={styles.scheduledText}>
                    Cambio programado: pasarás a{' '}
                    {PLAN_BY_TIER[mySub.scheduled_plan_tier].displayName} el{' '}
                    {formatDate(mySub.current_period_end)}.
                  </Text>
                </View>
              ) : null}
              {clubCovering ? (
                <View style={styles.coverNotice}>
                  <View style={styles.coverDot}>
                    <IconCheck size={12} color={c.accent} />
                  </View>
                  <Text style={styles.coverText}>
                    Tu club ya cubre tu plan. Puedes cancelar la suscripción
                    individual en Ajustes y ahorrar{' '}
                    {formatEur(plan.priceMonthlyEur)}/mes.
                  </Text>
                </View>
              ) : null}
            </>
          ) : coveredByMate && teamCov && team ? (
            <>
              <Text style={styles.planName}>
                Te cubre el plan de {teamCov.payer_name?.split(/\s+/)[0] ?? 'otro capitán'}
              </Text>
              <Text style={styles.planMeta}>
                Pro en {team.name} hasta {formatCoverDate(teamCov.period_end)} · sin pagar nada
              </Text>
              <View style={[styles.coverNotice, { marginTop: 14 }]}>
                <View style={styles.coverDot}>
                  <IconCheck size={12} color={c.accent} />
                </View>
                <Text style={styles.coverText}>
                  El plan Capitán cubre a los {CAPTAIN_SEATS} capitanes del equipo. En
                  otro equipo necesitarías tu propio plan.
                </Text>
              </View>
              <Pressable onPress={goManageCaptains} accessibilityRole="link" hitSlop={6}>
                <Text style={[styles.planMeta, { color: c.accent, fontWeight: '700', marginTop: 12 }]}>
                  Ver los capitanes ›
                </Text>
              </Pressable>
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
                    <IconCheck size={12} color={c.accent} />
                  </View>
                  <Text style={styles.coverText}>
                    Tu club te cubre. Tienes acceso premium sin pagar nada.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* === RECUPERACIÓN DE PAGO (grace period) ===
            El webhook BILLING_ISSUE deja la sub en grace_period: el cobro de
            renovación falló pero el acceso sigue unos días. Prompt claro para
            que el usuario arregle el método de pago y no perdamos un pagador
            por una tarjeta caducada (churn involuntario). */}
        {status === 'grace_period' ? (
          <View style={styles.billingIssueCard}>
            <Text style={styles.billingIssueTitle}>
              Hay un problema con tu pago
            </Text>
            <Text style={styles.billingIssueText}>
              No pudimos renovar tu suscripción. Actualiza tu método de pago en{' '}
              {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} para no
              perder el acceso a TACTIUM Pro.
            </Text>
            <Pressable
              onPress={openStoreSubscriptions}
              style={({ pressed }) => [
                styles.billingIssueBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.billingIssueBtnLabel}>
                Actualizar método de pago
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* === CTA PRINCIPAL === */}
        {coveredByMate ? null : !mySub || status === 'expired' || status === 'canceled' ? (
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
            <IconArrowRight size={16} color={c.textInverse} />
          </Pressable>
        ) : subWeb ? (
          <Pressable
            onPress={openWebBilling}
            style={({ pressed }) => [
              styles.ctaSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaSecondaryLabel}>Cambiar plan en la web</Text>
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

        {/* === CAMBIAR DE TIPO DE PLAN ===
            Club y capitán están en el MISMO grupo de suscripción de la tienda,
            así que saltar de uno a otro es un cambio de plan, no cancelar y
            volver a comprar: nadie pierde lo pagado. Bajar de nivel lo difiere
            la tienda a la renovación. */}
        {activeSub && switchTarget && !subWeb ? (
          <View style={styles.switchBlock}>
            <Text style={styles.switchTitle}>
              {switchTarget === 'captain'
                ? '¿Solo gestionas un equipo?'
                : '¿Gestionas un club con varios equipos?'}
            </Text>
            <Text style={styles.switchBody}>
              {switchTarget === 'captain'
                ? `Puedes pasarte al plan Capitán, que cubre un único equipo tuyo. Mantienes ${PLAN_BY_TIER[activeSub.plan_tier].displayName} hasta el ${formatDate(activeSub.current_period_end)}`
                : `Puedes pasarte a un plan de club, que cubre varios equipos y capitanes. Mantienes ${PLAN_BY_TIER[activeSub.plan_tier].displayName} hasta el ${formatDate(activeSub.current_period_end)}`}
              {activeSub.billing_period === 'yearly'
                ? ', porque el año ya está pagado, y a partir de esa fecha se te cobra el plan nuevo.'
                : ', y en el siguiente cobro mensual ya pagas el plan nuevo.'}
              {switchTarget === 'captain' && activeSub.subject_type === 'club'
                ? ' Tu club dejará de estar cubierto.'
                : ''}
            </Text>
            <Pressable
              onPress={() =>
                navigation.navigate('Paywall', { intent: switchTarget })
              }
              style={({ pressed }) => [
                styles.switchBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.switchBtnLabel}>
                {switchTarget === 'captain'
                  ? 'Ver el plan Capitán'
                  : 'Ver los planes de club'}
              </Text>
              <IconArrowRight size={14} color={c.accent} />
            </Pressable>
          </View>
        ) : null}

        </>
        )}

        {/* === ACTIONS === */}
        <View style={styles.actionsBlock}>
          {!dbTrial ? (
          <ActionRow
            label="Gestionar suscripción"
            sub={
              subWeb
                ? 'La contrataste en la web: gestiónala en tactium.io'
                : Platform.OS === 'ios'
                  ? 'Cancelar o cambiar plan en App Store'
                  : 'Cancelar o cambiar plan en Google Play'
            }
            onPress={subWeb ? openWebBilling : openStoreSubscriptions}
          />
          ) : null}
          <ActionRow
            label={restoring ? 'Restaurando…' : 'Restaurar compras'}
            sub="Recupera tu suscripción si cambiaste de dispositivo"
            onPress={handleRestore}
          />
          <ActionRow
            label="Canjear código"
            sub="Introduce un código promocional o de invitación"
            onPress={handleRedeemCode}
          />
          {mySub && !dbTrial && !mySub.cancel_at_period_end && status !== 'expired' ? (
            <ActionRow
              label="Cancelar la renovación"
              sub="No se renovará al expirar"
              destructive
              onPress={handleCancel}
            />
          ) : null}
        </View>

        {/* === LEGAL === */}
        <View style={styles.legalBlock}>
          <Text style={styles.legalText}>
            Términos de uso y Política de privacidad en Ajustes, «Ayuda y
            contacto».
          </Text>
        </View>
        </>
        )}
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
}> = ({ label, sub, destructive, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
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
            destructive && { color: c.error },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
      <IconArrowRight
        size={14}
        color={destructive ? c.error : c.textFaint}
      />
    </Pressable>
  );
};

// ─── Jugador: nada que comprar ─────────────────────────────────────────────
const PLAYER_BENEFITS = [
  'Convocatoria con Voy · Duda · No',
  'Alineación y resultados de cada jornada',
  'Tus números de liga y de amistosos',
];

const PlayerCoverage: React.FC<{
  teamName: string | null;
  teamPro: boolean | null;
  onCreateTeam: () => void;
  onRestore: () => void;
  restoring: boolean;
}> = ({ teamName, teamPro, onCreateTeam, onRestore, restoring }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const name = teamName ?? 'Tu equipo';
  return (
    <>
      <Text style={styles.title}>
        {teamPro === false ? 'Tu equipo está en el plan gratis' : 'Tu equipo te cubre'}
      </Text>
      <Text style={styles.lede}>
        {teamPro === false
          ? `${name} está en el plan gratis. Lo activa tu capitán. Tú no pagas nada.`
          : `Eres jugador de ${name}. Tienes la app completa y no pagas nada.`}
      </Text>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{name.slice(0, 3).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.planName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.planMeta}>
              {teamPro === false ? 'Plan gratis · lo gestiona tu capitán' : 'Tu equipo tiene Pro'}
            </Text>
          </View>
          {teamPro ? (
            <View style={[styles.statusPill, { borderColor: c.accent40 }]}>
              <Text style={[styles.statusPillText, { color: c.accent }]}>PRO</Text>
            </View>
          ) : null}
        </View>
        {teamPro !== false ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            {PLAYER_BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <IconCheck size={13} color={c.accent} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.switchBlock}>
        <Text style={styles.switchTitle}>¿Vas a capitanear tu propio equipo?</Text>
        <Text style={styles.switchBody}>
          Créalo y tendrás {TRIAL_DURATION_DAYS} días de prueba, sin tarjeta.
        </Text>
        <Pressable
          onPress={onCreateTeam}
          style={({ pressed }) => [styles.switchBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.switchBtnLabel}>Crear un equipo</Text>
          <IconArrowRight size={14} color={c.accent} />
        </Pressable>
      </View>

      <Pressable onPress={onRestore} disabled={restoring} hitSlop={8} style={styles.restoreLink}>
        <Text style={styles.restoreLinkText}>
          {restoring ? 'Restaurando…' : 'Restaurar compras'}
        </Text>
      </Pressable>
    </>
  );
};

// ─── Club: un resumen y un camino ──────────────────────────────────────────
const ClubSummary: React.FC<{
  clubName: string | null;
  sub: Subscription | null;
  used: number;
  quota: number;
  personalLive: boolean;
  onOpenBilling: () => void;
}> = ({ clubName, sub, used, quota, personalLive, onOpenBilling }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const plan = sub ? PLAN_BY_TIER[sub.plan_tier] : null;
  const yearly = sub?.billing_period === 'yearly';
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <>
      <Text style={styles.title}>{sub ? 'La paga el club' : 'Tu club está en el plan gratis'}</Text>
      <Text style={styles.lede}>
        {sub
          ? 'La suscripción del club cubre a sus equipos y a sus capitanes.'
          : 'Con un plan de club cubres a todos tus equipos y capitanes.'}
      </Text>

      {sub && plan ? (
        <View style={[styles.statusCard, { borderColor: c.accent40 }]}>
          <View style={styles.statusHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.planName}>
                {plan.displayName} · {yearly ? 'anual' : 'mensual'}
              </Text>
              {clubName ? <Text style={styles.planMeta}>{clubName}</Text> : null}
            </View>
            <Text style={styles.clubPrice}>
              {formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}
              <Text style={styles.trialPriceUnit}>{yearly ? '/año' : '/mes'}</Text>
            </Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.quotaRow}>
            <Text style={styles.statusRowLabel}>Equipos</Text>
            <View style={styles.quotaTrack}>
              <View style={[styles.quotaFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.statusRowValue}>
              {used} de {quota}
            </Text>
          </View>
          <View style={[styles.statusRow, { marginTop: 10 }]}>
            <Text style={styles.statusRowLabel}>
              {sub.status === 'trialing'
                ? 'Prueba termina'
                : sub.cancel_at_period_end
                  ? 'Termina'
                  : 'Próximo cobro'}
            </Text>
            <Text style={styles.statusRowValue}>
              {formatDate(sub.current_period_end)}
              {/* Importe solo con el plan activo: una prueba de club puede ser
                  sin tarjeta y no cobrar nada al terminar. */}
              {sub.status === 'active' && !sub.cancel_at_period_end
                ? ` · ${formatEur(yearly ? plan.priceYearlyEur : plan.priceMonthlyEur)}`
                : ''}
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={onOpenBilling}
        style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={styles.ctaPrimaryLabel}>
          {sub ? 'Abrir la facturación del club' : 'Ver los planes de club'}
        </Text>
        <IconArrowRight size={16} color={c.textInverse} />
      </Pressable>

      {sub && personalLive ? (
        <View style={styles.coverNotice}>
          <View style={styles.coverDot}>
            <IconCheck size={12} color={c.accent} />
          </View>
          <Text style={styles.coverText}>
            Tu club ya cubre tu plan. Puedes cancelar la suscripción individual de
            capitán para no pagar dos veces.
          </Text>
        </View>
      ) : null}
    </>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  crest: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: c.accent15,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, fontWeight: '800' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { color: c.text, fontSize: 13, flex: 1 },
  restoreLink: { alignItems: 'center', marginTop: 18 },
  restoreLinkText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  trialPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
  },
  trialPlanName: { color: c.text, fontSize: 15, fontWeight: '700' },
  trialPrice: { fontFamily: Fonts.mono, color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  trialPriceUnit: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  clubPrice: { fontFamily: Fonts.mono, color: c.text, fontSize: 18, fontWeight: '800' },
  quotaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quotaTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.hairStrong, overflow: 'hidden' },
  quotaFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },

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
    backgroundColor: c.hair,
    marginVertical: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRowLabel: {
    color: c.textMuted,
    fontSize: 13,
  },
  statusRowValue: {
    fontFamily: Fonts.mono,
    color: c.text,
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
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  coverDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: c.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  coverText: {
    color: c.text,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
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

  // Recuperación de pago (grace period)
  billingIssueCard: {
    backgroundColor: c.warning + '14',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.warning + '55',
    padding: 16,
    marginBottom: 14,
  },
  billingIssueTitle: {
    color: c.warning,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  billingIssueText: {
    color: c.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  billingIssueBtn: {
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: c.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  billingIssueBtnLabel: {
    color: c.textInverse,
    fontSize: 14,
    fontWeight: '700',
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
    marginBottom: 14,
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
    marginBottom: 14,
  },
  switchBlock: {
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    backgroundColor: c.bgCard,
    gap: 8,
  },
  switchTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  switchBody: { fontSize: 13, lineHeight: 19, color: c.textMuted },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  switchBtnLabel: { fontSize: 13, fontWeight: '700', color: c.accent },
  ctaSecondaryLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // Actions block
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
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

  legalBlock: {
    marginTop: 18,
    alignItems: 'center',
  },
  legalText: {
    color: c.textFaint,
    fontSize: 11,
    textAlign: 'center',
  },
});
