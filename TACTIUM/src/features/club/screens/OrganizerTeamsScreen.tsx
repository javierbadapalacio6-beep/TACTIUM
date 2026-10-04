import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconCheck } from '@components/ui';
import { StaggerRow } from '@features/team/components/TeamMotion';
import type { RootStackParamList } from '@navigation/types';

const PERKS = [
  'Convocatoria Voy / Duda / No en cada jornada',
  'Alineación por puntos y acta',
  'Un capitán por equipo, sin coste para él',
];

/**
 * Pestaña Equipo del ORGANIZADOR (club «solo torneos»). Rediseño 2026-10:
 * antes preguntaba «¿También gestionas equipos?» sin enseñar qué se gana.
 * Ahora una tarjeta de ejemplo (trazo discontinuo) enseña cómo quedará la
 * pestaña, tres ventajas en una línea cada una y la frase que tranquiliza.
 */
export const OrganizerTeamsScreen = () => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>EQUIPOS</Text>
        <Text style={s.title}>¿Llevas también equipos de liga?</Text>

        {/* Así quedará la pestaña: datos de ejemplo, no reales. */}
        <StaggerRow index={0} style={s.sample}>
          <View style={s.sampleHead}>
            <View style={s.sampleCrest}>
              <Text style={s.sampleCrestText}>TU</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sampleName}>Tu equipo A</Text>
              <Text style={s.sampleMeta}>2ª Masc. · 12 jugadores</Text>
            </View>
          </View>
          <View style={s.sampleLine}>
            <Text style={s.sampleMeta}>Próxima jornada</Text>
            <Text style={s.sampleValue}>sáb · 10:00 · local</Text>
          </View>
        </StaggerRow>

        <View style={s.perks}>
          {PERKS.map((p, i) => (
            <StaggerRow key={p} index={i + 1} style={s.perk}>
              <View style={s.perkIcon}>
                <IconCheck size={12} color={c.accent} />
              </View>
              <Text style={s.perkText}>{p}</Text>
            </StaggerRow>
          ))}
        </View>

        <Text style={s.calm}>Tus torneos no cambian.</Text>

        <Pressable
          onPress={() => rootNav.navigate('ActivateTeamManagement')}
          accessibilityRole="button"
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.ctaText}>Activar gestión de equipos</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: 20 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2.4,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 31,
      marginTop: 8,
      marginBottom: 18,
    },
    sample: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.hairStrong,
      gap: 14,
    },
    sampleHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sampleCrest: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sampleCrestText: { fontFamily: Fonts.mono, color: c.accent, fontWeight: '700' },
    sampleName: { color: c.text, fontSize: 15, fontWeight: '700' },
    sampleMeta: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    sampleLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    sampleValue: { color: c.textFaint, fontSize: 12.5, fontWeight: '600' },
    perks: { marginTop: 20, gap: 12 },
    perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    perkIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.accent15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
    calm: { color: c.textMuted, fontSize: 13.5, marginTop: 20 },
    cta: {
      marginTop: 16,
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { color: c.textInverse, fontSize: 15.5, fontWeight: '700' },
  });
