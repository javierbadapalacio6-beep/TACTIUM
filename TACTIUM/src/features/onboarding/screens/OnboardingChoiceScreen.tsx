import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, NeonDot } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';

// Timings de la secuencia de entrada — inspirado en stagger de anime.js
// aplicado con layout animations de Reanimated. Reglas del UX guide:
// `stagger-sequence` (30-50ms entre items), `duration-timing` (≤300ms),
// `ease-out`/spring entering.
const STAGGER_STEP = 90;

import type { OnboardingStackScreenProps } from '@navigation/types';

export const OnboardingChoiceScreen = ({
  navigation,
}: OnboardingStackScreenProps<'OnboardingChoice'>) => {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);
  const clubs = useClubStore((s) => s.clubs);
  const [redeemOpen, setRedeemOpen] = useState(false);

  // Si el usuario ya tiene un club pero salió antes de crear los equipos,
  // saltamos la elección y vamos directo al paso de equipos del club.
  useEffect(() => {
    if (clubs.length > 0) {
      navigation.replace('CreateTeamsForClub');
    }
  }, [clubs, navigation]);

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
            <Text style={styles.exitLink}>Salir</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.body}>
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
          ¿Cómo vas a empezar?
        </Animated.Text>
        <Animated.Text
          style={styles.lede}
          entering={FadeInDown.delay(STAGGER_STEP * 4)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          Puedes gestionar un único equipo o estructurar varios bajo un club.
        </Animated.Text>

        {/* Pill explicando trial: genérica (sin precio) porque el coste
            depende de qué modo elija el usuario. El precio concreto se
            muestra dentro de cada ChoiceCard. */}
        <Animated.View
          style={styles.trialPill}
          entering={FadeInDown.delay(STAGGER_STEP * 4.5)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          <View style={styles.trialPillDot} />
          <Text style={styles.trialPillText}>
            14 días gratis en cualquier plan · Cancela cuando quieras
          </Text>
        </Animated.View>

        <View style={styles.options}>
          <Animated.View
            entering={FadeInUp.delay(STAGGER_STEP * 5)
              .duration(360)
              .easing(Easing.out(Easing.cubic))}
          >
            <ChoiceCard
              title="Equipo independiente"
              description="Un solo equipo. Empieza rápido sin estructura adicional."
              badge="RÁPIDO"
              badgeAccent
              priceLabel="Tras prueba: 4,99 €/mes"
              onPress={() => navigation.navigate('CreateTeam', {})}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(STAGGER_STEP * 6)
              .duration(360)
              .easing(Easing.out(Easing.cubic))}
          >
            <ChoiceCard
              title="Club con varios equipos"
              description="Para clubes con múltiples equipos y capitanes."
              badge="ESCALABLE"
              badgeAccent
              priceLabel="Tras prueba: desde 11,99 €/mes"
              onPress={() => navigation.navigate('CreateClub')}
            />
          </Animated.View>
        </View>

        <Animated.View
          style={styles.divider}
          entering={FadeIn.delay(STAGGER_STEP * 7).duration(280)}
        >
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>O</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(STAGGER_STEP * 8)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          <Pressable
            onPress={() => setRedeemOpen(true)}
            style={({ pressed }) => [
              styles.redeem,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>SIEMPRE GRATIS</Text>
            </View>
            <Text style={styles.redeemTitle}>Tengo un código de invitación</Text>
            <Text style={styles.redeemHint}>
              Jugadores y capitanes invitados a un club{'\n'}
              acceden sin pagar nada.
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.footer, { paddingBottom: insets.bottom + 22 }]}
        entering={FadeIn.delay(STAGGER_STEP * 9).duration(260)}
      >
        <Text style={styles.footnote}>
          Sólo el capitán independiente paga su plan.{'\n'}
          Podrás cambiar entre equipos más adelante.
        </Text>
      </Animated.View>

      <RedeemInvitationSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
    </View>
  );
};

const ChoiceCard: React.FC<{
  title: string;
  description: string;
  badge: string;
  badgeAccent?: boolean;
  // Precio post-trial. Mostrarlo dentro de cada card evita la ambigüedad
  // de un precio "desde X" en el subtítulo que no aplica a todos los modos.
  priceLabel?: string;
  onPress: () => void;
}> = ({ title, description, badge, badgeAccent, priceLabel, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
  >
    <View style={styles.cardHeader}>
      <View
        style={[
          styles.cardBadge,
          badgeAccent && {
            backgroundColor: Colors.accent10,
            borderColor: Colors.accent50,
          },
        ]}
      >
        <Text
          style={[
            styles.cardBadgeText,
            { color: badgeAccent ? Colors.accent : Colors.textMuted },
          ]}
        >
          {badge}
        </Text>
      </View>
      {badgeAccent ? <NeonDot size={6} /> : null}
    </View>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardDesc}>{description}</Text>
    {priceLabel ? (
      <Text style={styles.cardPrice}>{priceLabel}</Text>
    ) : null}
    <View style={styles.cardCta}>
      <Text style={styles.cardCtaText}>Empezar</Text>
      <Text style={styles.cardCtaArrow}>→</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: Colors.text,
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
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 32,
    marginBottom: 8,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    marginBottom: 24,
  },
  trialPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  trialPillText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  options: {
    gap: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.hair,
  },
  dividerText: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  redeem: {
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  freeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    marginBottom: 6,
  },
  freeBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  redeemTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  redeemHint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  // ──────────────────────────────────────────────────────────────────────
  // Cards compactas: reducidos paddings, gaps y fontSizes para que en
  // pantallas pequeñas no solapen con el bloque "código de invitación"
  // ni el footnote inferior.
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardBadge: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 5,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  cardPrice: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  cardCta: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCtaText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  cardCtaArrow: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
  },
  footnote: {
    color: Colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
  },
  exitLink: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
