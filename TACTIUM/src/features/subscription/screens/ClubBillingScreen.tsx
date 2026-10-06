import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Platform,
  AppState,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconArrowRight } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import {
  requestConnectOnboarding,
  fetchConnectStatus,
  type ConnectStatus,
} from '@core/services/connectOnboarding';
import {
  PLAN_BY_TIER,
  formatEur,
  type SubscriptionStatus,
  isLiveSub,
} from '@core/subscriptions/plans';
import { TOURNAMENT_TIERS, TOURNAMENT_FREE_PAIRS } from '@core/entitlements/tournamentBilling';
import { GATEWAY_FEE_LABEL } from '@features/club/clubOps';
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

const STORE_NAME = { ios: 'App Store', android: 'Google Play', web: 'tactium.io' } as const;

// Estados de Stripe: los cuatro que ya devuelve /api/connect/status.
const CONNECT: Record<ConnectStatus, { label: string; tone: 'ok' | 'warn' | 'mute'; body: string; cta: string | null }> = {
  none: {
    label: 'Sin conectar',
    tone: 'mute',
    body: 'Conecta Stripe y el dinero de las inscripciones va directo a la cuenta del club. También puedes cobrar en el club.',
    cta: 'Conectar con Stripe',
  },
  onboarding: {
    label: 'Alta pendiente',
    tone: 'warn',
    body: 'Empezaste el alta en Stripe y falta terminarla. Hasta entonces, las inscripciones con pago online no se pueden abrir.',
    cta: 'Continuar alta',
  },
  restricted: {
    label: 'Faltan datos',
    tone: 'warn',
    body: 'Stripe necesita algún dato más (por ejemplo, tu IBAN) para poder ingresarte lo cobrado. Hasta entonces, las inscripciones con pago online no se pueden abrir.',
    cta: 'Completar en Stripe',
  },
  active: {
    label: 'Listo para cobrar',
    tone: 'ok',
    body: '',
    cta: null,
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** «25 € hasta 40, 67 € hasta 90» con los tramos reales. */
const tiersLine = TOURNAMENT_TIERS.filter((t) => t.priceEur > 0)
  .slice(0, 2)
  .map((t) => `${formatEur(t.priceEur)} hasta ${t.pairs}`)
  .join(', ');

/**
 * Cobros y facturación del club: el plan (con el importe que se FACTURA) y el
 * cobro de inscripciones con el estado REAL de Stripe. Antes la fila de cobros
 * decía siempre «Da de alta el club», aunque ya estuviera conectado.
 */
export const ClubBillingScreen = ({
  navigation,
}: RootStackScreenProps<'ClubBilling'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const STATUS_TINT = useMemo(() => makeStatusTint(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  const clubSub = useMemo<Subscription | null>(() => {
    if (!club) return null;
    return (
      subscriptions
        .filter((s) => s.subject_type === 'club' && s.subject_id === club.id && isLiveSub(s))
        .sort(
          (a, b) =>
            new Date(b.current_period_end).getTime() - new Date(a.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subscriptions, club]);

  const plan = clubSub ? PLAN_BY_TIER[clubSub.plan_tier] : null;
  const status = clubSub?.status ?? null;
  const covered = clubTeams.filter((t) => t.covered);
  const uncovered = clubTeams.filter((t) => !t.covered);
  const quota = plan?.teamQuota ?? 0;
  const freeSlots = Math.max(0, quota - covered.length);
  /** La sub del club se compró en la WEB: la tienda no puede reemplazarla. */
  const subWeb = clubSub?.platform === 'web';
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  // ── Estado de Stripe ──────────────────────────────────────────────────────
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [connectLoaded, setConnectLoaded] = useState(false);
  const refreshConnect = useCallback(async () => {
    if (!club) return;
    const s = await fetchConnectStatus(club.id);
    setConnect(s);
    setConnectLoaded(true);
  }, [club]);
  useFocusEffect(
    useCallback(() => {
      refreshConnect();
    }, [refreshConnect]),
  );
  // Al volver de la página de Stripe (navegador), el estado se actualiza solo.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refreshConnect();
    });
    return () => sub.remove();
  }, [refreshConnect]);

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
    Linking.openURL(url).catch(() => toast.error('No se pudo abrir', 'Abre Ajustes manualmente.'));
  };

  // Alta de cobros online (Stripe Connect). Es onboarding de COMERCIANTE
  // (recibir dinero), no una compra dentro de la app → fuera de IAP. Abrimos
  // directamente la página hospedada por Stripe.
  const [payoutBusy, setPayoutBusy] = useState(false);
  const openPayouts = async () => {
    if (payoutBusy || !club) return;
    setPayoutBusy(true);
    try {
      const url = await requestConnectOnboarding(club.id);
      await Linking.openURL(url);
    } catch (e) {
      Linking.openURL('https://tactium.io/club/facturacion#cobros').catch(() => {});
      toast.error(
        'No se pudo abrir el alta',
        e instanceof Error ? e.message : 'Inténtalo desde la web (Club → Cobros y facturación).',
      );
    } finally {
      setPayoutBusy(false);
    }
  };

  const cs = connect ? CONNECT[connect] : null;
  const toneColor = cs?.tone === 'ok' ? c.accent : cs?.tone === 'warn' ? c.warning : c.textMuted;

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
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{club?.name?.toUpperCase() ?? 'SIN CLUB'}</Text>
        <Text style={styles.title}>{plan ? 'Facturación del club' : 'Cobros y facturación'}</Text>

        {/* === TARJETA DEL PLAN === */}
        <View style={styles.card}>
          {clubSub && plan && status ? (
            <>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle}>{plan.displayName}</Text>
                  {/* Apple 3.1.2c: el importe FACTURADO es lo más visible. */}
                  <Text style={styles.price}>
                    {clubSub.billing_period === 'yearly'
                      ? `${formatEur(plan.priceYearlyEur)} al año`
                      : `${formatEur(plan.priceMonthlyEur)} al mes`}
                  </Text>
                  <Text style={styles.cardSub}>
                    {clubSub.billing_period === 'yearly' ? 'Anual' : 'Mensual'} ·{' '}
                    {STORE_NAME[clubSub.platform as keyof typeof STORE_NAME] ?? store}
                  </Text>
                </View>
                <View style={[styles.pill, { borderColor: STATUS_TINT[status] + '66' }]}>
                  <Text style={[styles.pillText, { color: STATUS_TINT[status] }]}>
                    {STATUS_LABEL[status]}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Row
                label={
                  status === 'trialing'
                    ? 'Prueba termina'
                    : clubSub.cancel_at_period_end
                      ? 'Termina'
                      : status === 'active'
                        ? 'Próximo cobro'
                        : 'Próxima renovación'
                }
                value={
                  // Importe solo con el plan activo (como la web): una prueba
                  // de club puede ser sin tarjeta y no cobrar nada.
                  status === 'active' && !clubSub.cancel_at_period_end
                    ? `${formatDate(clubSub.current_period_end)} · ${formatEur(
                        clubSub.billing_period === 'yearly'
                          ? plan.priceYearlyEur
                          : plan.priceMonthlyEur,
                      )}`
                    : formatDate(clubSub.current_period_end)
                }
              />
              <Row label="Equipos cubiertos" value={`${covered.length} de ${quota}`} />
              <Row label="Torneos incluidos" value={`hasta ${plan.tournamentPairCap} parejas`} />
              {clubSub.cancel_at_period_end ? (
                <Text style={styles.notice}>
                  No se renovará: tu acceso termina el {formatDate(clubSub.current_period_end)}.
                </Text>
              ) : null}
              {clubSub.scheduled_plan_tier ? (
                <Text style={styles.notice}>
                  Cambio programado: pasarás a {PLAN_BY_TIER[clubSub.scheduled_plan_tier].displayName}{' '}
                  el {formatDate(clubSub.current_period_end)}.
                </Text>
              ) : null}
              {uncovered.length > 0 ? (
                <View style={styles.coverRow}>
                  <Text style={styles.coverText}>
                    {uncovered.length === 1
                      ? `${uncovered[0].name} sin cubrir`
                      : `${uncovered.length} equipos sin cubrir`}
                    {freeSlots > 0 ? ': te queda sitio.' : ': el plan está lleno.'}
                  </Text>
                  <Pressable
                    onPress={() =>
                      freeSlots > 0
                        ? navigation.navigate('ClubCoverTeams')
                        : navigation.navigate('Paywall', { intent: 'upgrade' })
                    }
                    hitSlop={6}
                    style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.smallBtnText}>{freeSlots > 0 ? 'Cubrir' : 'Mejorar'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>Tu plan</Text>
                <View style={[styles.pill, { borderColor: c.hairStrong }]}>
                  <Text style={[styles.pillText, { color: c.textMuted }]}>Gratis</Text>
                </View>
              </View>
              <Text style={styles.body}>
                Torneos gratis hasta {TOURNAMENT_FREE_PAIRS} parejas. Por encima, pagas según las
                parejas al cerrar la inscripción: {tiersLine}.
              </Text>
              <Pressable
                onPress={() => navigation.navigate('Paywall', { intent: 'club' })}
                hitSlop={6}
                style={{ marginTop: 12 }}
              >
                <Text style={styles.link}>Ver planes de club ›</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* === TARJETA DE COBROS === */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle}>Cobro de inscripciones</Text>
              <Text style={styles.cardSub}>Stripe · cuenta del club</Text>
            </View>
            {!connectLoaded ? (
              <ActivityIndicator size="small" color={c.textFaint} />
            ) : cs ? (
              <Animated.View
                key={connect}
                entering={reduced ? undefined : FadeIn.duration(300)}
                style={[styles.pill, { borderColor: toneColor + '66', backgroundColor: toneColor + '14' }]}
              >
                <Text style={[styles.pillText, { color: toneColor }]}>{cs.label}</Text>
              </Animated.View>
            ) : null}
          </View>
          {connectLoaded && !cs ? (
            <Text style={styles.body}>
              No se pudo consultar el estado de Stripe ahora mismo. Vuelve a intentarlo en un rato.
            </Text>
          ) : null}
          {cs && cs.body ? <Text style={styles.body}>{cs.body}</Text> : null}
          <View style={styles.divider} />
          <Row label="Comisión de TACTIUM" value="0 €" />
          <Row label="Coste de la pasarela" value={GATEWAY_FEE_LABEL} />
          <Text style={styles.fine}>Por cada inscripción cobrada online. Lo cobra Stripe, no TACTIUM.</Text>
          {cs?.cta ? (
            <>
              <Pressable
                onPress={openPayouts}
                disabled={payoutBusy}
                style={({ pressed }) => [styles.primary, (pressed || payoutBusy) && { opacity: 0.85 }]}
              >
                {payoutBusy ? (
                  <ActivityIndicator color={c.textInverse} />
                ) : (
                  <Text style={styles.primaryText}>{cs.cta} ↗</Text>
                )}
              </Pressable>
              <Text style={styles.fine}>
                Se abre la página segura de Stripe. Al volver, el estado se actualiza solo.
              </Text>
            </>
          ) : null}
        </View>

        {/* === ACCIONES === */}
        <View style={styles.actions}>
          {plan ? (
            <ActionRow
              title="Cambiar de plan"
              sub="Ver Starter, Pro y Elite"
              onPress={() => (subWeb ? openWebBilling() : navigation.navigate('Paywall', { intent: 'change' }))}
              divider
            />
          ) : (
            <ActionRow
              title="Suscribir el club"
              sub="Prueba de 14 días"
              onPress={() => navigation.navigate('Paywall', { intent: 'club' })}
              divider
            />
          )}
          {clubSub ? (
            <ActionRow
              title={subWeb ? 'Gestionar en la web' : 'Gestionar en Ajustes'}
              sub={subWeb ? 'La contrataste en tactium.io' : `Cancelar en ${store}`}
              onPress={subWeb ? openWebBilling : openStoreSubscriptions}
            />
          ) : (
            <ActionRow
              title="Equipos del club"
              sub={`${clubTeams.length} ${clubTeams.length === 1 ? 'equipo' : 'equipos'} · cubre los que quieras con un plan`}
              onPress={() => navigation.navigate('ClubCoverTeams')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
};

const ActionRow: React.FC<{ title: string; sub: string; onPress: () => void; divider?: boolean }> = ({
  title,
  sub,
  onPress,
  divider,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.actionRow, divider && styles.actionDivider, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
      <IconArrowRight size={14} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 },
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
    title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 6, marginBottom: 14 },
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 16,
      marginBottom: 14,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardTitle: { color: c.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    cardSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    price: { fontFamily: Fonts.mono, color: c.text, fontSize: 22, fontWeight: '700', marginTop: 6 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    pillText: { fontSize: 12, fontWeight: '700' },
    divider: { height: 1, backgroundColor: c.hair, marginVertical: 12 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 5,
      gap: 12,
    },
    rowLabel: { color: c.textMuted, fontSize: 13.5 },
    rowValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 13.5, fontWeight: '600' },
    notice: { color: c.warning, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
    coverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      padding: 10,
      borderRadius: Radius.md,
      backgroundColor: c.warning + '14',
      borderWidth: 1,
      borderColor: c.warning + '55',
    },
    coverText: { flex: 1, color: c.text, fontSize: 13, lineHeight: 18 },
    smallBtn: {
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 9,
      backgroundColor: c.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallBtnText: { color: c.textInverse, fontSize: 12.5, fontWeight: '700' },
    body: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
    fine: { color: c.textFaint, fontSize: 11.5, lineHeight: 16, marginTop: 6 },
    link: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
    primary: {
      marginTop: 14,
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    actions: {
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
      minHeight: 60,
    },
    actionDivider: { borderBottomWidth: 1, borderBottomColor: c.hair },
    actionLabel: { color: c.text, fontSize: 14.5, fontWeight: '600' },
    actionSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  });
