import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, NeonDot, IconTrophy, IconTeam } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';

import type { OnboardingStackScreenProps } from '@navigation/types';

const STAGGER_STEP = 90;

// Bifurcación inicial del onboarding: ¿el usuario viene a ORGANIZAR TORNEOS o a
// GESTIONAR EQUIPOS? Es la primera pantalla tras iniciar sesión.
//   · Gestionar equipos → el onboarding de siempre (OnboardingChoice).
//   · Organizar torneos → un club en modo "solo torneos" (paso mínimo: nombre)
//     que aterriza en un menú recortado (Torneos + Perfil).
export const OnboardingIntentScreen = ({
  navigation,
}: OnboardingStackScreenProps<'OnboardingIntent'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);
  const clubs = useClubStore((s) => s.clubs);
  const soloUpgrade = useTeamStore((s) => s.soloUpgrade);

  // Casos en los que NO mostramos la bifurcación:
  //  · "De jugador a gestor" (soloUpgrade) → directo a gestionar equipos.
  //  · Ya tiene un club de gestión a medias (creado pero sin equipos) →
  //    directo a crear sus equipos. Un club "solo torneos" no cuenta: ese
  //    ya entra al menú (showMainTabs), no pasa por aquí.
  useEffect(() => {
    if (soloUpgrade) {
      navigation.replace('OnboardingChoice');
      return;
    }
    if (clubs.some((cl) => !cl.tournaments_only)) {
      navigation.replace('CreateTeamsForClub');
    }
  }, [soloUpgrade, clubs, navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <AmbientBackdrop intensity={0.6} />

      <View style={styles.header}>
        <Animated.View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          entering={ZoomIn.duration(360).easing(Easing.out(Easing.cubic))}
        >
          <TactiumMark size={28} gradient />
          <Animated.Text
            style={styles.brand}
            entering={FadeIn.delay(180).duration(280)}
          >
            TACTIUM
          </Animated.Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(220).duration(220)}>
          <Pressable
            onPress={() =>
              Alert.alert('Cerrar sesión', '¿Salir y volver a iniciar sesión?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => signOut() },
              ])
            }
            hitSlop={10}
            style={{ paddingHorizontal: 6 }}
          >
            <Text style={styles.exitLink}>Cerrar sesión</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.Text
          style={styles.eyebrow}
          entering={FadeInDown.delay(STAGGER_STEP * 2)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          BIENVENIDO
        </Animated.Text>
        <Animated.Text
          style={styles.title}
          entering={FadeInDown.delay(STAGGER_STEP * 3)
            .duration(380)
            .easing(Easing.out(Easing.cubic))}
        >
          ¿Qué vas a hacer?
        </Animated.Text>
        <Animated.Text
          style={styles.lede}
          entering={FadeInDown.delay(STAGGER_STEP * 4)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          Puedes organizar torneos, gestionar tus equipos, o las dos cosas.
          Elige por dónde empezar — lo otro lo activas cuando quieras.
        </Animated.Text>

        <View style={styles.options}>
          <Animated.View
            entering={FadeInUp.delay(STAGGER_STEP * 5)
              .duration(360)
              .easing(Easing.out(Easing.cubic))}
          >
            <IntentCard
              Icon={IconTrophy}
              title="Organizar torneos"
              description="Monta torneos, abre inscripciones y gestiona los cuadros. Listo en un minuto."
              badge="TORNEOS"
              onPress={() => navigation.navigate('CreateTournamentClub')}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(STAGGER_STEP * 6)
              .duration(360)
              .easing(Easing.out(Easing.cubic))}
          >
            <IntentCard
              Icon={IconTeam}
              title="Gestionar equipos"
              description="Equipo independiente o club con varios equipos: alineaciones, jornadas y plantillas."
              badge="EQUIPOS"
              onPress={() => navigation.navigate('OnboardingChoice')}
            />
          </Animated.View>
        </View>

        <Animated.View
          style={styles.footer}
          entering={FadeIn.delay(STAGGER_STEP * 8).duration(260)}
        >
          <Text style={styles.footnote}>
            Los torneos necesitan una suscripción o el pago del propio torneo.{'\n'}
            Podrás gestionar equipos más adelante sin perder nada.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const IntentCard: React.FC<{
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
  badge: string;
  onPress: () => void;
}> = ({ Icon, title, description, badge, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Icon size={20} color={c.accent} />
        </View>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{badge}</Text>
        </View>
        <NeonDot size={6} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{description}</Text>
      <View style={styles.cardCta}>
        <Text style={styles.cardCtaText}>Empezar</Text>
        <Text style={styles.cardCtaArrow}>→</Text>
      </View>
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
    brand: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 2,
    },
    body: {
      flex: 1,
      paddingHorizontal: 24,
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
      fontWeight: '600',
      letterSpacing: -0.7,
      lineHeight: 32,
      marginBottom: 8,
    },
    lede: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    options: { gap: 12 },
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBadge: {
      flex: 1,
      alignItems: 'flex-start',
    },
    cardBadgeText: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: c.accent,
    },
    cardTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    cardDesc: {
      color: c.textMuted,
      fontSize: 12.5,
      lineHeight: 18,
    },
    cardCta: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardCtaText: {
      color: c.accent,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    cardCtaArrow: {
      color: c.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      marginTop: 'auto',
      paddingTop: 20,
    },
    footnote: {
      color: c.textFaint,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 17,
    },
    exitLink: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
  });
