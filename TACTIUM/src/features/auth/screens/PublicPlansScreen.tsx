import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { AmbientBackdrop, IconBack } from '@components/ui';
import {
  CAPTAIN_PLAN,
  CLUB_PLANS,
  TRIAL_DURATION_DAYS,
  annualDiscountPercent,
  formatEur,
  type BillingPeriod,
  type PlanDescriptor,
} from '@core/subscriptions/plans';
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_EXTRA_PAIR_EUR,
} from '@core/entitlements/tournamentBilling';
import { BillingToggle, ComparePlans } from '@features/subscription/components/PaywallParts';

import type { AuthStackScreenProps } from '@navigation/types';

/**
 * Planes — visible SIN cuenta.
 *
 * Dos cosas distintas con dos precios, y un selector arriba en vez de dos
 * órdenes duplicados:
 *   · LLEVO EQUIPOS: suscripción (capitán o club), los cuatro planes a la vista
 *     en lista vertical (se comparan mejor que en carrusel).
 *   · MONTO TORNEOS: pago único por torneo según sus plazas, en una tabla con
 *     los cinco tramos. Si el club ya tiene plan, sus torneos van incluidos
 *     hasta el tope de ese plan.
 *
 * Aquí NO se compra nada: la suscripción se contrata dentro de la app tras
 * iniciar sesión y el torneo se paga por el enlace que llega por correo. Los
 * precios salen SIEMPRE de plans.ts / tournamentBilling.ts. Apple 3.1.2c: el
 * importe FACTURADO es lo más grande; el equivalente mensual va debajo.
 */

type Lane = 'teams' | 'tournaments';
// El tramo que más se usa (torneos de club medianos): va marcado.
const COMMON_TIER_PAIRS = 40;

export const PublicPlansScreen = ({
  navigation,
  route,
}: AuthStackScreenProps<'Plans'>) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [lane, setLane] = useState<Lane>(
    route.params?.focus === 'tournaments' ? 'tournaments' : 'teams',
  );
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const yearly = period === 'yearly';
  const allPlans: PlanDescriptor[] = [CAPTAIN_PLAN, ...CLUB_PLANS];
  const showYearlyChip = allPlans.some((p) => annualDiscountPercent(p) > 0);

  const planRow = (p: PlanDescriptor, i: number) => (
    <View key={p.tier} style={[s.planRow, i > 0 && s.rowBorder]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.planName}>{p.displayName}</Text>
        <Text style={s.planSub} numberOfLines={2}>
          {p.tier === 'captain'
            ? '1 equipo · tus jugadores no pagan'
            : `${p.teamQuota} equipos${p.tournamentPairCap ? ` · torneos hasta ${p.tournamentPairCap}` : ''}`}
        </Text>
      </View>
      {/* El importe FACTURADO manda (3.1.2c); el mensual equivalente, pequeño. */}
      <View style={{ alignItems: 'flex-end' }}>
        <View style={s.priceRow}>
          <Text style={s.price} numberOfLines={1}>
            {formatEur(yearly ? p.priceYearlyEur : p.priceMonthlyEur)}
          </Text>
          <Text style={s.pricePeriod}>{yearly ? '/año' : '/mes'}</Text>
        </View>
        {yearly ? (
          <Text style={s.priceEq}>≈ {formatEur(p.priceYearlyEur / 12)}/mes</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <AmbientBackdrop />

      <View style={[s.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [s.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={s.navBtnLabel}>Atrás</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>PLANES</Text>
        <Text style={s.title}>Dos cosas distintas, dos precios</Text>

        {/* Selector de carril: sustituye a los dos órdenes duplicados. */}
        <View style={s.lane} accessibilityRole="tablist">
          {([
            ['teams', 'Llevo equipos'],
            ['tournaments', 'Monto torneos'],
          ] as [Lane, string][]).map(([k, label]) => {
            const on = lane === k;
            return (
              <Pressable
                key={k}
                onPress={() => setLane(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[s.laneBtn, on && s.laneBtnOn]}
              >
                <Text style={[s.laneText, on && s.laneTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Animated.View key={lane} entering={FadeIn.duration(150)}>
          {lane === 'tournaments' ? (
            <>
              <Text style={s.lede}>Pago único por torneo según sus plazas. Sin suscripción.</Text>
              <View style={s.table}>
                {TOURNAMENT_TIERS.map((t, i) => {
                  const common = t.pairs === COMMON_TIER_PAIRS;
                  return (
                    <View key={t.pairs} style={[s.tierRow, i > 0 && s.rowBorder, common && s.tierRowOn]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.tierLabel}>Hasta {t.pairs} parejas</Text>
                        {common ? <Text style={s.tierCommon}>El más común</Text> : null}
                      </View>
                      <Text style={[s.tierPrice, t.priceEur === 0 && { color: c.accent }]}>
                        {t.priceEur === 0 ? 'Gratis' : `${t.priceEur} €`}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={s.note}>
                +{TOURNAMENT_EXTRA_PAIR_EUR} € por pareja por encima de{' '}
                {TOURNAMENT_TIERS[TOURNAMENT_TIERS.length - 1].pairs}. Si tu club tiene
                plan, sus torneos van incluidos hasta su tope.
              </Text>
              <Text style={s.note}>
                Las inscripciones se cobran online y llegan a tu cuenta. Solo se
                descuenta el coste de la pasarela.
              </Text>
            </>
          ) : (
            <>
              <View style={{ marginTop: 18, marginBottom: 14, alignSelf: 'flex-start' }}>
                <BillingToggle value={period} onChange={setPeriod} showYearlyChip={showYearlyChip} />
              </View>
              <View style={s.table}>{allPlans.map(planRow)}</View>
              <View style={{ marginTop: 6 }}>
                <ComparePlans plans={allPlans} />
              </View>
              <Text style={s.note}>
                {TRIAL_DURATION_DAYS} días de prueba al crear tu primer equipo. Se
                contrata dentro de la app.
              </Text>
            </>
          )}
        </Animated.View>

        <Pressable
          // Abre el login en modo ALTA: aún deja elegir Apple/Google, y si va
          // por email, la pestaña ya es «Crear cuenta».
          onPress={() => navigation.navigate('Login', { tab: 'signup' })}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={s.ctaText}>
            {lane === 'teams' ? `Crear cuenta · ${TRIAL_DURATION_DAYS} días gratis` : 'Crear cuenta gratis'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: { paddingHorizontal: 18, paddingBottom: 10 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.text, fontSize: 14, fontWeight: '600' },

    eyebrow: { color: c.accent, fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2.2, marginBottom: 8 },
    title: { color: c.text, fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5 },
    lede: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: 18, marginBottom: 12 },

    lane: {
      flexDirection: 'row',
      marginTop: 18,
      padding: 4,
      borderRadius: 13,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      gap: 4,
    },
    laneBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    laneBtnOn: { backgroundColor: c.text },
    laneText: { color: c.textMuted, fontSize: 14, fontWeight: '700' },
    laneTextOn: { color: c.background },

    table: {
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    rowBorder: { borderTopWidth: 1, borderColor: c.hair },

    tierRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    tierRowOn: { backgroundColor: c.accent10 },
    tierLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
    tierCommon: { color: c.accent, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
    tierPrice: { color: c.text, fontFamily: Fonts.mono, fontSize: 18, fontWeight: '800' },

    planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    planName: { color: c.text, fontSize: 16, fontWeight: '800' },
    planSub: { color: c.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    price: { color: c.text, fontFamily: Fonts.mono, fontSize: 19, fontWeight: '800' },
    pricePeriod: { color: c.textFaint, fontFamily: Fonts.mono, fontSize: 11 },
    priceEq: { color: c.textFaint, fontFamily: Fonts.mono, fontSize: 10.5, marginTop: 3 },

    note: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 12 },

    cta: {
      height: 52,
      borderRadius: 999,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 26,
    },
    ctaText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
  });
