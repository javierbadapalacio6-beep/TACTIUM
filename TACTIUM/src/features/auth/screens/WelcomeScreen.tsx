import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Typography } from '@core/theme/typography';
import { Spacing, Radius } from '@core/theme/spacing';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, IconArrowRight, IconBack, NeonDot } from '@components/ui';
import { useAuthStore } from '@store/authStore';

import type { AuthStackScreenProps } from '@navigation/types';

import { HeroVisual, AvailVisual, LineupVisual, SeasonVisual } from './welcome-visuals';

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
];

export const WelcomeScreen = ({
  navigation,
}: AuthStackScreenProps<'Welcome'>) => {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const markWelcomeSeen = useAuthStore((s) => s.markWelcomeSeen);

  const slide = slides[step];
  const last = step === slides.length - 1;

  const finish = () => {
    markWelcomeSeen();
    navigation.replace('Login');
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
        <View style={styles.brand}>
          <TactiumMark size={22} gradient />
          <Text style={styles.wordmark}>TACTIUM</Text>
        </View>
        {!last ? (
          <Pressable hitSlop={10} onPress={finish}>
            <Text style={styles.skip}>Saltar</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.visualWrap} key={step}>
          <slide.Visual />
        </View>
      </ScrollView>

      <View style={styles.copy}>
        <Text style={styles.tag}>{slide.tag}</Text>
        <View style={styles.titleBlock}>{renderTitle(slide.title)}</View>
        <Text style={styles.bodyText}>{slide.body}</Text>
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
            <Pressable
              onPress={() => setStep(step - 1)}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconBack size={18} color={Colors.text} />
            </Pressable>
          )}
          <Pressable
            onPress={() => (last ? finish() : setStep(step + 1))}
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={[Colors.accent, '#27e898']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.ctaLabel}>{last ? 'Empezar' : 'Continuar'}</Text>
            <IconArrowRight size={18} color="#001810" />
          </Pressable>
        </View>

        <View style={styles.signature}>
          <NeonDot size={4} />
          <Text style={styles.signatureText}>CREATE · ANALYZE · ELEVATE</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    fontFamily: Fonts.sans,
  },
  skip: {
    color: Colors.textMuted,
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
    ...Typography.eyebrow,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 14,
  },
  titleBlock: {
    marginBottom: 14,
  },
  title: {
    ...Typography.h1,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: Colors.text,
  },
  titleAccent: {
    color: Colors.accent,
  },
  bodyText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
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
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
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
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
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
    shadowColor: Colors.accent,
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
  signature: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signatureText: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 2,
  },
});
