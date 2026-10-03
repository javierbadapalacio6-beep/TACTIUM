import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  AmbientBackdrop,
  IconChevron,
  IconCourt,
  IconTeam,
  IconTicket,
  IconTrophy,
} from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';
import { readStorePurchases, isClubTier } from '@core/services/storeSync';
import { PLAN_BY_TIER } from '@core/subscriptions/plans';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';

import type { OnboardingStackScreenProps } from '@navigation/types';

const STAGGER_STEP = 70;

// Pregunta única del onboarding, primera pantalla tras iniciar sesión: «¿Qué
// vas a hacer en TACTIUM?». Antes eran dos (Intent: torneos vs equipos, y
// Choice: equipo independiente vs club); ahora cada opción lleva a su paso 1:
//   · Capitanear un equipo → CreateTeam (prueba de 14 días al crearlo).
//   · Gestionar un club    → CreateClub (prueba de 14 días al crearlo).
//   · Organizar torneos    → CreateTournamentClub (hasta 16 parejas, gratis).
//   · Soy jugador · invitado → hoja de canjear invitación.
//   · «Juego por mi cuenta» → modo suelto (amistosos y stats), gratis.
export const OnboardingIntentScreen = ({
  navigation,
}: OnboardingStackScreenProps<'OnboardingIntent'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const signOut = useAuthStore((s) => s.signOut);
  const clubs = useClubStore((s) => s.clubs);
  const soloUpgrade = useTeamStore((s) => s.soloUpgrade);
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const [redeemOpen, setRedeemOpen] = useState(false);

  // «De jugador a gestor» (soloUpgrade): solo equipo o club, y «Volver» deja
  // al usuario en su modo suelto en vez de cerrar sesión.
  const backToSolo = () => {
    setSoloUpgrade(false);
    setSoloMode(true);
  };

  // Ya tiene un club de gestión a medias (creado pero sin equipos) → directo
  // a crear sus equipos. Un club «solo torneos» no cuenta: ese ya entra al
  // menú recortado (showMainTabs), no pasa por aquí.
  useEffect(() => {
    if (clubs.some((cl) => !cl.tournaments_only)) {
      navigation.replace('CreateTeamsForClub');
    }
  }, [clubs, navigation]);

  // La compra vive en la cuenta de la tienda, no en la de TACTIUM: quien
  // rehace su cuenta llega aquí con un plan ya pagado. Si es de club, ese es
  // su camino y el de capitán no le aplicaría.
  const [paidClubPlan, setPaidClubPlan] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    readStorePurchases()
      .then((ps) => {
        const club = ps.find((p) => isClubTier(p.tier));
        if (!cancelled && club) setPaidClubPlan(PLAN_BY_TIER[club.tier].displayName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const goCaptain = () => {
    if (!paidClubPlan) {
      navigation.navigate('CreateTeam', {});
      return;
    }
    Alert.alert(
      'Tu plan es de club',
      `Tienes ${paidClubPlan} activo, que cubre un club con varios equipos. ` +
        'Un equipo independiente se cobra aparte con el plan Capitán.',
      [
        { text: 'Crear el club', onPress: () => navigation.navigate('CreateClub') },
        {
          text: 'Seguir con equipo suelto',
          style: 'destructive',
          onPress: () => navigation.navigate('CreateTeam', {}),
        },
      ],
    );
  };

  const enter = (i: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(STAGGER_STEP * i)
          .duration(340)
          .easing(Easing.out(Easing.cubic));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <AmbientBackdrop intensity={0.6} />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <TactiumMark size={26} gradient />
          <Text style={styles.brand}>TACTIUM</Text>
        </View>
        <Pressable
          onPress={
            soloUpgrade
              ? backToSolo
              : () =>
                  Alert.alert('Cerrar sesión', '¿Salir y volver a iniciar sesión?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', style: 'destructive', onPress: () => signOut() },
                  ])
          }
          hitSlop={10}
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={styles.exitLink}>{soloUpgrade ? '← Volver' : 'Cerrar sesión'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(1)}>
          <Text style={styles.eyebrow}>
            {soloUpgrade ? 'DE JUGADOR A GESTOR' : 'BIENVENIDO'}
          </Text>
          <Text style={styles.title}>
            {soloUpgrade ? 'Crea tu equipo o tu club' : '¿Qué vas a hacer en TACTIUM?'}
          </Text>
          {soloUpgrade ? (
            <Text style={styles.lede}>
              Tus amistosos y tus stats se conservan: es la misma cuenta, con más
              poderes.
            </Text>
          ) : null}
        </Animated.View>

        {paidClubPlan ? (
          <Animated.View entering={enter(2)} style={styles.paidPill}>
            <View style={styles.paidPillDot} />
            <Text style={styles.paidPillText}>
              Ya tienes {paidClubPlan} activo · lo aplicamos al club que crees
            </Text>
          </Animated.View>
        ) : null}

        <View style={styles.options}>
          <Animated.View entering={enter(3)}>
            <OptionRow
              Icon={IconTeam}
              title="Capitanear un equipo"
              subtitle={
                paidClubPlan
                  ? 'Un solo equipo · tu plan de club no lo cubre'
                  : 'Convocatoria, alineación y acta · 14 días gratis'
              }
              onPress={goCaptain}
            />
          </Animated.View>
          <Animated.View entering={enter(4)}>
            <OptionRow
              Icon={IconCourt}
              title="Gestionar un club"
              subtitle={
                paidClubPlan
                  ? `Varios equipos en un panel · incluido en tu ${paidClubPlan}`
                  : 'Varios equipos en un panel · 14 días gratis'
              }
              highlight={!!paidClubPlan}
              onPress={() => navigation.navigate('CreateClub')}
            />
          </Animated.View>
          {!soloUpgrade ? (
            <Animated.View entering={enter(5)}>
              <OptionRow
                Icon={IconTrophy}
                title="Organizar torneos"
                subtitle="Hasta 16 parejas, gratis"
                onPress={() => navigation.navigate('CreateTournamentClub')}
              />
            </Animated.View>
          ) : null}
        </View>

        {!soloUpgrade ? (
          <>
            <Animated.Text
              entering={reduced ? undefined : FadeIn.delay(STAGGER_STEP * 6).duration(260)}
              style={styles.sectionLabel}
            >
              SOY JUGADOR
            </Animated.Text>
            <Animated.View entering={enter(7)}>
              <OptionRow
                Icon={IconTicket}
                tone="warning"
                title="Me han invitado a un equipo"
                subtitle="Tengo un enlace o un código"
                onPress={() => setRedeemOpen(true)}
              />
            </Animated.View>
            <Animated.View entering={enter(8)}>
              <Pressable
                onPress={() => setSoloMode(true)}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.soloLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.soloLinkText}>Juego por mi cuenta · gratis →</Text>
              </Pressable>
            </Animated.View>
          </>
        ) : null}
      </ScrollView>

      <RedeemInvitationSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} />
    </View>
  );
};

/** Opción de la lista: icono, título, subtítulo y chevron; escala al pulsar. */
const OptionRow: React.FC<{
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  onPress: () => void;
  tone?: 'accent' | 'warning';
  highlight?: boolean;
}> = ({ Icon, title, subtitle, onPress, tone = 'accent', highlight }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    if (reduced) return;
    scale.value = withTiming(to, { duration: to < 1 ? 90 : 160 });
  };
  const toneColor = tone === 'warning' ? c.warning : c.accent;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => press(0.975)}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <Animated.View
        style={[styles.option, highlight && styles.optionOn, pressStyle]}
      >
        <View
          style={[
            styles.optionIcon,
            tone === 'warning' && {
              backgroundColor: withAlpha(c.warning, 0.12),
              borderColor: withAlpha(c.warning, 0.45),
            },
          ]}
        >
          <Icon size={18} color={toneColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionSub}>{subtitle}</Text>
        </View>
        <IconChevron size={14} color={c.textFaint} />
      </Animated.View>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brand: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 2,
    },
    exitLink: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    body: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 28,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 10,
    },
    title: {
      color: c.text,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.7,
      lineHeight: 33,
    },
    lede: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
    },
    paidPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      marginTop: 16,
    },
    paidPillDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.accent,
    },
    paidPillText: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
      flexShrink: 1,
    },
    options: { gap: 10, marginTop: 22 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
    },
    optionOn: {
      borderColor: c.accent,
      backgroundColor: c.accent10,
    },
    optionIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionTitle: {
      color: c.text,
      fontSize: 15.5,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    optionSub: {
      color: c.textMuted,
      fontSize: 12.5,
      lineHeight: 17,
      marginTop: 2,
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      letterSpacing: 2.4,
      fontWeight: '500',
      marginTop: 24,
      marginBottom: 10,
    },
    soloLink: {
      alignSelf: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      marginTop: 6,
    },
    soloLinkText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
  });
