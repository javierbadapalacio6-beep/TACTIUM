import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { AmbientBackdrop, IconBack, IconCheck } from '@components/ui';
import {
  CAPTAIN_PLAN,
  CLUB_PLANS,
  TRIAL_DURATION_DAYS,
  formatEur,
  type PlanDescriptor,
} from '@core/subscriptions/plans';
import {
  TOURNAMENT_TIERS,
  TOURNAMENT_EXTRA_PAIR_EUR,
} from '@core/entitlements/tournamentBilling';

import type { AuthStackScreenProps } from '@navigation/types';

/**
 * Planes — visible SIN cuenta.
 *
 * Son dos carriles distintos y la pantalla los separa a propósito, porque
 * mezclarlos es lo que confunde:
 *   · GESTIÓN DE EQUIPOS: suscripción (capitán o club), por temporada.
 *   · TORNEOS: pago por torneo según su tamaño, sin suscripción. Y si el club
 *     ya tiene plan, sus torneos van incluidos hasta el tope de ese plan.
 *
 * Aquí NO se compra nada: la suscripción se contrata dentro de la app tras
 * iniciar sesión y el torneo se paga por el enlace que llega por correo. Esta
 * pantalla solo informa — ver precios antes de registrarse es lo mínimo.
 */

/** Qué incluye cada plan, en la voz del capitán, no del sistema. */
const PLAN_FEATURES: Record<string, string[]> = {
  captain: [
    'Un equipo de hasta 30 jugadores',
    'Alineaciones ordenadas por puntos',
    'Avisos a los convocados',
    'Histórico de temporadas',
  ],
  club_starter: [
    'Panel del club con todos sus equipos',
    'Capitanes invitados sin coste extra',
    'Horarios de pista',
  ],
  club_pro: [
    'Multi-categoría (masculino, femenino y mixto)',
    'Rejilla de horarios y conflictos',
    'Todo lo del plan anterior',
  ],
  club_elite: [
    'Informes por categoría',
    'Soporte por WhatsApp',
    'Todo lo del plan anterior',
  ],
};

export const PublicPlansScreen = ({
  navigation,
  route,
}: AuthStackScreenProps<'Plans'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [yearly, setYearly] = useState(true);

  // Si se llega desde el carril de torneos, ese bloque va primero: quien ha
  // dicho que monta torneos no debería aterrizar en planes de equipo.
  const tournamentsFirst = route.params?.focus === 'tournaments';

  const planCard = (p: PlanDescriptor, featured = false) => (
    <View key={p.tier} style={[styles.card, featured && styles.cardFeatured]}>
      {featured ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>RECOMENDADO</Text>
        </View>
      ) : null}

      <Text style={styles.cardTitle}>{p.displayName}</Text>
      <Text style={styles.cardSub}>
        {p.teamQuota === 1 ? 'Un equipo' : `Hasta ${p.teamQuota} equipos`}
      </Text>
      {p.tournamentPairCap ? (
        <Text style={styles.cardSub}>
          Torneos hasta {p.tournamentPairCap} parejas
        </Text>
      ) : null}

      {/* El importe FACTURADO manda; el equivalente mensual va debajo y
          pequeño. Es la regla que costó un rechazo de Apple (3.1.2c). */}
      <View style={styles.priceRow}>
        <Text
          style={[styles.price, featured && { color: c.accent }]}
          numberOfLines={1}
        >
          {formatEur(yearly ? p.priceYearlyEur : p.priceMonthlyEur)}
        </Text>
        <Text style={styles.pricePeriod}>{yearly ? '/AÑO' : '/MES'}</Text>
      </View>
      {yearly ? (
        <Text style={styles.priceEq}>
          equivale a {formatEur(p.priceYearlyEur / 12)}/mes
        </Text>
      ) : null}

      <View style={styles.sep} />

      {(PLAN_FEATURES[p.tier] ?? []).map((f) => (
        <View key={f} style={styles.featRow}>
          <IconCheck size={14} color={c.accent} />
          <Text style={styles.featText}>{f}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <AmbientBackdrop />

      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.navBtnLabel}>Atrás</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>PLANES</Text>
        <Text style={styles.title}>Dos cosas distintas{'\n'}y dos precios</Text>
        <Text style={styles.lede}>
          Gestionar equipos va por suscripción. Montar un torneo se paga por
          torneo, sin suscripción — y si ya tienes plan de club, entra incluido
          hasta el tope de tu plan.
        </Text>
        {tournamentsFirst ? (
          <>
        {/* ── Torneos ──────────────────────────────────────────────── */}
        <Text
          style={[styles.secLabel, !tournamentsFirst && { marginTop: 32 }]}
        >
          MONTAR UN TORNEO
        </Text>
        <Text style={styles.lede}>
          Pago único por torneo según sus plazas. Las inscripciones las cobras
          tú con tu pasarela: TACTIUM no se queda comisión.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          style={styles.railOuter}
        >
          {TOURNAMENT_TIERS.map((t) => (
            <View key={t.pairs} style={styles.tier}>
              <Text style={styles.tierPairs}>HASTA {t.pairs}</Text>
              <Text style={styles.tierPairsSub}>PAREJAS</Text>
              <Text
                style={[
                  styles.tierPrice,
                  t.priceEur === 0 && { color: c.accent },
                ]}
                numberOfLines={1}
              >
                {t.priceEur === 0 ? 'Gratis' : formatEur(t.priceEur)}
              </Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.note}>
          +{TOURNAMENT_EXTRA_PAIR_EUR} € por pareja por encima del tramo. El
          enlace de pago llega por correo.
        </Text>
        {/* ── Gestión de equipos ───────────────────────────────────── */}
        <Text
          style={[styles.secLabel, tournamentsFirst && { marginTop: 32 }]}
        >
          GESTIÓN DE EQUIPOS
        </Text>

        <View style={styles.toggle}>
          {([
            [false, 'Mensual'],
            [true, 'Anual'],
          ] as [boolean, string][]).map(([v, label]) => {
            const on = yearly === v;
            return (
              <Pressable
                key={label}
                onPress={() => setYearly(v)}
                style={[styles.toggleBtn, on && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* En carril horizontal: cuatro tarjetas apiladas obligaban a
            recorrer media pantalla por plan y a comparar de memoria. Al lado
            se comparan de un vistazo, que es lo que se hace con precios. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          style={styles.railOuter}
        >
          {planCard(CAPTAIN_PLAN)}
          {CLUB_PLANS.map((p) => planCard(p, p.tier === 'club_pro'))}
        </ScrollView>


        <Text style={styles.note}>
          {TRIAL_DURATION_DAYS} días de prueba al crear tu primer equipo. Se
          contrata dentro de la app.
        </Text>
          </>
        ) : (
          <>
        {/* ── Gestión de equipos ───────────────────────────────────── */}
        <Text style={styles.secLabel}>GESTIÓN DE EQUIPOS</Text>

        <View style={styles.toggle}>
          {([
            [false, 'Mensual'],
            [true, 'Anual'],
          ] as [boolean, string][]).map(([v, label]) => {
            const on = yearly === v;
            return (
              <Pressable
                key={label}
                onPress={() => setYearly(v)}
                style={[styles.toggleBtn, on && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* En carril horizontal: cuatro tarjetas apiladas obligaban a
            recorrer media pantalla por plan y a comparar de memoria. Al lado
            se comparan de un vistazo, que es lo que se hace con precios. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          style={styles.railOuter}
        >
          {planCard(CAPTAIN_PLAN)}
          {CLUB_PLANS.map((p) => planCard(p, p.tier === 'club_pro'))}
        </ScrollView>


        <Text style={styles.note}>
          {TRIAL_DURATION_DAYS} días de prueba al crear tu primer equipo. Se
          contrata dentro de la app.
        </Text>
        {/* ── Torneos ──────────────────────────────────────────────── */}
        <Text style={[styles.secLabel, { marginTop: 32 }]}>
          MONTAR UN TORNEO
        </Text>
        <Text style={styles.lede}>
          Pago único por torneo según sus plazas. Las inscripciones las cobras
          tú con tu pasarela: TACTIUM no se queda comisión.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          style={styles.railOuter}
        >
          {TOURNAMENT_TIERS.map((t) => (
            <View key={t.pairs} style={styles.tier}>
              <Text style={styles.tierPairs}>HASTA {t.pairs}</Text>
              <Text style={styles.tierPairsSub}>PAREJAS</Text>
              <Text
                style={[
                  styles.tierPrice,
                  t.priceEur === 0 && { color: c.accent },
                ]}
                numberOfLines={1}
              >
                {t.priceEur === 0 ? 'Gratis' : formatEur(t.priceEur)}
              </Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.note}>
          +{TOURNAMENT_EXTRA_PAIR_EUR} € por pareja por encima del tramo. El
          enlace de pago llega por correo.
        </Text>
          </>
        )}
        <Pressable
          onPress={() => navigation.navigate('Login')}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>Crear cuenta</Text>
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

    eyebrow: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 2.2,
      marginBottom: 8,
    },
    title: {
      color: c.text,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    lede: {
      color: c.textMuted,
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 10,
      marginBottom: 22,
    },

    secLabel: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 2,
      marginBottom: 12,
    },

    toggle: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      padding: 4,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      gap: 4,
      marginBottom: 16,
    },
    toggleBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 9 },
    toggleBtnOn: { backgroundColor: c.accent10 },
    toggleText: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    toggleTextOn: { color: c.accent, fontWeight: '700' },

    railOuter: { marginHorizontal: -18, marginBottom: 14 },
    rail: { paddingHorizontal: 18, gap: 11, alignItems: 'stretch' },

    card: {
      width: 262,
      padding: 18,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      marginBottom: 12,
    },
    cardFeatured: { borderColor: c.accent },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: c.accent10,
      marginBottom: 10,
    },
    badgeText: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      letterSpacing: 1.4,
    },
    cardTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
    cardSub: {
      flexShrink: 1,
      color: c.textMuted,
      fontSize: 12.5,
      marginTop: 5,
      lineHeight: 18,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 7,
      marginTop: 16,
      minWidth: 0,
    },
    price: {
      color: c.text,
      fontFamily: Fonts.mono,
      fontSize: 25,
      fontWeight: '700',
      flexShrink: 1,
    },
    pricePeriod: {
      flexShrink: 0,
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.4,
    },
    priceEq: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      marginTop: 6,
    },
    sep: { height: 1, backgroundColor: c.hair, marginVertical: 16 },
    featRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      marginBottom: 9,
    },
    featText: { color: c.textMuted, fontSize: 13, lineHeight: 18, flex: 1 },

    note: {
      color: c.textFaint,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },

    tier: {
      width: 152,
      paddingHorizontal: 14,
      paddingVertical: 15,
      borderRadius: 13,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tierPairs: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.4,
    },
    tierPairsSub: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.4,
      marginTop: 2,
    },
    tierPrice: {
      color: c.text,
      fontFamily: Fonts.mono,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 12,
    },

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
