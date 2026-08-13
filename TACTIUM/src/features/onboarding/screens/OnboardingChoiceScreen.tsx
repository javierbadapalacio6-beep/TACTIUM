import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
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
import { AmbientBackdrop, NeonDot } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';

// Timings de la secuencia de entrada — inspirado en stagger de anime.js
// aplicado con layout animations de Reanimated. Reglas del UX guide:
// `stagger-sequence` (30-50ms entre items), `duration-timing` (≤300ms),
// `ease-out`/spring entering.
const STAGGER_STEP = 90;

import type { OnboardingStackScreenProps } from '@navigation/types';

export const OnboardingChoiceScreen = ({
  navigation,
}: OnboardingStackScreenProps<'OnboardingChoice'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);
  const clubs = useClubStore((s) => s.clubs);
  const setSoloMode = useTeamStore((st) => st.setSoloMode);
  const soloUpgrade = useTeamStore((st) => st.soloUpgrade);
  const setSoloUpgrade = useTeamStore((st) => st.setSoloUpgrade);
  const backToSolo = () => {
    setSoloUpgrade(false);
    setSoloMode(true);
  };

  // Si el usuario ya tiene un club de gestión (no "solo torneos") pero salió
  // antes de crear los equipos, saltamos la elección y vamos directo al paso de
  // equipos. Los clubes "solo torneos" no cuentan: ese modo entra al menú
  // recortado, no pasa por aquí.
  useEffect(() => {
    if (clubs.some((cl) => !cl.tournaments_only)) {
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
          {soloUpgrade ? (
            <Pressable
              onPress={backToSolo}
              hitSlop={10}
              style={{ paddingHorizontal: 6 }}
            >
              <Text style={styles.exitLink}>← Volver</Text>
            </Pressable>
          ) : (
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
          )}
        </Animated.View>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          style={styles.eyebrow}
          entering={FadeInDown.delay(STAGGER_STEP * 2)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          {soloUpgrade ? 'DE JUGADOR A GESTOR' : 'BIENVENIDO'}
        </Animated.Text>
        <Animated.Text
          style={styles.title}
          entering={FadeInDown.delay(STAGGER_STEP * 3)
            .duration(380)
            .easing(Easing.out(Easing.cubic))}
        >
          {soloUpgrade ? 'Crea tu equipo o tu club' : '¿Cómo vas a empezar?'}
        </Animated.Text>
        <Animated.Text
          style={styles.lede}
          entering={FadeInDown.delay(STAGGER_STEP * 4)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          {soloUpgrade
            ? 'Tus amistosos y tus stats se conservan: es la misma cuenta, con más poderes.'
            : 'Gestiona un equipo o un club — o entra como jugador: amistosos, tu liga y tus stats. Gratis.'}
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
              description="Tú gestionas, tú alineas. Listo en 2 minutos."
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
          style={styles.footer}
          entering={FadeIn.delay(STAGGER_STEP * 9).duration(260)}
        >
          <Text style={styles.footnote}>
            Sólo el capitán independiente paga su plan.{'\n'}
            Podrás cambiar entre equipos más adelante.
          </Text>
        </Animated.View>
      </ScrollView>
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
}> = ({ title, description, badge, badgeAccent, priceLabel, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
  >
    <View style={styles.cardHeader}>
      <View
        style={[
          styles.cardBadge,
          badgeAccent && {
            backgroundColor: c.accent10,
            borderColor: c.accent50,
          },
        ]}
      >
        <Text
          style={[
            styles.cardBadgeText,
            { color: badgeAccent ? c.accent : c.textMuted },
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
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
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
  bodyScroll: {
    flex: 1,
  },
  body: {
    // flexGrow (no flex:1) para que el contenido fluya y haga scroll cuando
    // no cabe en pantallas pequeñas, pero ocupe todo el alto cuando sobra.
    flexGrow: 1,
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
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    marginBottom: 24,
  },
  trialPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  trialPillText: {
    fontFamily: Fonts.mono,
    color: c.accent,
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
    backgroundColor: c.hairStrong,
  },
  dividerText: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  redeem: {
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hair,
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  freeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    marginBottom: 6,
  },
  freeBadgeText: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  redeemTitle: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  redeemHint: {
    color: c.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  // ──────────────────────────────────────────────────────────────────────
  // Cards compactas: reducidos paddings, gaps y fontSizes para que en
  // pantallas pequeñas no solapen con el bloque "código de invitación"
  // ni el footnote inferior.
  card: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
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
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
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
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardDesc: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  cardPrice: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  cardCta: {
    marginTop: 10,
    paddingTop: 8,
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
    // Anclado al fondo cuando sobra espacio; empujado por el scroll cuando no.
    marginTop: 'auto',
    paddingTop: 20,
  },
  footnote: {
    color: c.textFaint,
    fontSize: 12,
    textAlign: 'center',
  },
  exitLink: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
