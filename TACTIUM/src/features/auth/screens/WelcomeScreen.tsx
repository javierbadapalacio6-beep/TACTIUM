import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideInLeft,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';

import { useColors, useTypography, type Palette } from '@core/theme';
import { Spacing, Radius } from '@core/theme/spacing';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, IconArrowRight, IconBack, NeonDot } from '@components/ui';
import { useAuthStore } from '@store/authStore';

import type { AuthStackScreenProps } from '@navigation/types';

import {
  HeroVisual,
  AvailVisual,
  LineupVisual,
  SeasonVisual,
  CasualVisual,
} from './welcome-visuals';

type Slide = {
  tag: string;
  title: string;
  body: string;
  Visual: React.ComponentType;
};

const slides: Slide[] = [
  {
    tag: 'PADEL FIRST · SPORTS ALWAYS',
    title: 'El laboratorio\ntáctico de tu equipo',
    body: 'Decisiones basadas en datos. Alineaciones inteligentes. Siempre un paso por delante.',
    Visual: HeroVisual,
  },
  {
    tag: '01 · DISPONIBILIDAD',
    title: 'Sabe quién juega\nen segundos',
    body: 'Tus jugadores marcan disponibilidad con un toque. Tú ves el equipo listo antes de cada jornada.',
    Visual: AvailVisual,
  },
  {
    tag: '02 · ALINEACIONES',
    title: 'Crea parejas\nque ganan',
    body: 'Forma parejas, ordénalas por puntos, valida la regla oficial al instante. Sin hojas, sin errores.',
    Visual: LineupVisual,
  },
  {
    tag: '03 · TEMPORADA',
    title: 'Lleva el control\nde la liga',
    body: 'Jornadas, resultados, racha y tasa de victoria. Toda la temporada en una sola pantalla.',
    Visual: SeasonVisual,
  },
  {
    tag: '04 · TU JUEGO',
    title: 'Tus partidos,\ntus números',
    body: 'También sin equipo: registra amistosos con tus colegas, comparte la foto del partido y sigue tus stats. Gratis para jugadores.',
    Visual: CasualVisual,
  },
];

export const WelcomeScreen = ({
  navigation,
}: AuthStackScreenProps<'Welcome'>) => {
  const c = useColors();
  const t = useTypography();
  const styles = useMemo(() => makeStyles(c, t), [c, t]);
  const [step, setStep] = useState(0);
  // Dirección del último cambio: 1 = avanzando, -1 = retrocediendo, 0 = mount.
  // Permite que la animación de entrada del visual + texto sea direccional,
  // como en una galería de swipe nativa.
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const insets = useSafeAreaInsets();
  const markWelcomeSeen = useAuthStore((s) => s.markWelcomeSeen);

  const goNext = () => {
    setDirection(1);
    setStep(step + 1);
  };
  const goPrev = () => {
    setDirection(-1);
    setStep(step - 1);
  };

  const slide = slides[step];
  const last = step === slides.length - 1;

  const finish = () => {
    markWelcomeSeen();
    navigation.replace('PublicHome');
  };

  const renderTitle = (title: string) => {
    const lines = title.split('\n');
    return lines.map((line, i) => {
      const isLast = i === lines.length - 1;
      if (isLast && step !== 0) {
        const words = line.split(' ');
        const last = words.pop();
        return (
          <Text key={i} style={styles.title}>
            {words.join(' ') + ' '}
            <Text style={styles.titleAccent}>{last}</Text>
          </Text>
        );
      }
      return (
        <Text key={i} style={styles.title}>
          {line}
        </Text>
      );
    });
  };

  return (
    <View style={styles.root}>
      <AmbientBackdrop />

      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <Animated.View
          style={styles.brand}
          entering={FadeIn.delay(80).duration(380)}
        >
          <TactiumMark size={22} gradient />
          <Text style={styles.wordmark}>TACTIUM</Text>
        </Animated.View>
        {!last ? (
          <Animated.View entering={FadeIn.delay(180).duration(260)}>
            <Pressable hitSlop={10} onPress={finish}>
              <Text style={styles.skip}>Saltar</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Visual: entra desde la derecha al avanzar, desde la izquierda
            al retroceder. ZoomIn springy en el mount inicial (step=0). */}
        <Animated.View
          style={styles.visualWrap}
          key={`visual-${step}`}
          entering={
            direction === 0
              ? ZoomIn.duration(440).easing(Easing.out(Easing.cubic))
              : direction === 1
                ? SlideInRight.duration(380).easing(Easing.out(Easing.cubic))
                : SlideInLeft.duration(380).easing(Easing.out(Easing.cubic))
          }
          exiting={FadeOut.duration(160)}
        >
          <slide.Visual />
        </Animated.View>
      </ScrollView>

      <View style={styles.copy} key={`copy-${step}`}>
        <Animated.Text
          style={styles.tag}
          entering={FadeInDown.duration(280)
            .delay(80)
            .easing(Easing.out(Easing.cubic))}
        >
          {slide.tag}
        </Animated.Text>
        <Animated.View
          style={styles.titleBlock}
          entering={FadeInDown.duration(360)
            .delay(160)
            .easing(Easing.out(Easing.cubic))}
        >
          {renderTitle(slide.title)}
        </Animated.View>
        <Animated.Text
          style={styles.bodyText}
          entering={FadeInDown.duration(320)
            .delay(240)
            .easing(Easing.out(Easing.cubic))}
        >
          {slide.body}
        </Animated.Text>
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: i === step ? 24 : 6 },
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.ctaRow}>
          {step > 0 && (
            <Animated.View
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
            >
              <Pressable
                onPress={goPrev}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconBack size={18} color={c.text} />
              </Pressable>
            </Animated.View>
          )}
          <Pressable
            onPress={() => (last ? finish() : goNext())}
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={[c.accent, '#27e898']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.ctaLabel}>{last ? 'Empezar' : 'Continuar'}</Text>
            <IconArrowRight size={18} color="#001810" />
          </Pressable>
        </View>

        {/* Subtítulo bajo el CTA — visible en la última slide para anunciar
            que la prueba es gratuita 14 días antes de crear cuenta. */}
        {last ? (
          <Animated.Text
            style={styles.trialNote}
            entering={FadeIn.delay(220).duration(260)}
          >
            14 días gratis · Después desde 4,99 €/mes
          </Animated.Text>
        ) : null}

        <Animated.View
          style={styles.signature}
          entering={FadeIn.delay(400).duration(320)}
        >
          <NeonDot size={4} />
          <Text style={styles.signatureText}>CREATE · ANALYZE · ELEVATE</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const makeStyles = (c: Palette, t: ReturnType<typeof useTypography>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    color: c.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    fontFamily: Fonts.sans,
  },
  skip: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: Spacing.lg,
  },
  visualWrap: {
    alignItems: 'center',
  },
  copy: {
    paddingHorizontal: 28,
  },
  tag: {
    ...t.eyebrow,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 14,
  },
  titleBlock: {
    marginBottom: 14,
  },
  title: {
    ...t.h1,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: c.text,
  },
  titleAccent: {
    color: c.accent,
  },
  bodyText: {
    ...t.body,
    fontSize: 15,
    lineHeight: 22,
    color: c.textMuted,
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 4,
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232,245,239,0.18)',
  },
  dotActive: {
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  trialNote: {
    textAlign: 'center',
    color: c.accent,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 12,
  },
  signature: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signatureText: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 2,
  },
});
