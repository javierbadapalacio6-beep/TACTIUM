import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconChevron } from '@components/ui/Icon';
import { useTeamStore } from '@store/teamStore';
import type { NewUserStackScreenProps } from '@navigation/types';

// Selector de tipo de cuenta (Fase 1d). El tipo NO encierra a nadie: es solo
// por dónde empiezas — cualquiera puede crear equipo/club/sede después.
export const AccountTypeScreen = ({
  navigation,
}: NewUserStackScreenProps<'AccountType'>) => {
  const insets = useSafeAreaInsets();
  const startOnboarding = useTeamStore((s) => s.startOnboarding);

  const OPTIONS = [
    {
      emoji: '🎾',
      title: 'Juego al pádel',
      subtitle: 'Registra partidos, sigue tu nivel y a tu gente. Amateur o de competición.',
      tint: Colors.accent,
      onPress: () => navigation.navigate('ProfileSetup'),
    },
    {
      emoji: '🏆',
      title: 'Gestiono un club o equipo',
      subtitle: 'Jornadas, alineaciones, plantillas. Capitán o club con varios equipos.',
      tint: '#F2C94C',
      onPress: () => startOnboarding(), // → OnboardingFlow (crear equipo/club)
    },
    {
      emoji: '📍',
      title: 'Soy una sede o club de pádel',
      subtitle: 'Publica novedades, servicios y torneos de tu club en el feed.',
      tint: '#4CC3FF',
      onPress: () => navigation.navigate('VenueSetup'),
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.header}>
          <TactiumMark size={40} gradient />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>BIENVENIDO</Text>
            <Text style={styles.title}>¿Cómo vas a usar TACTIUM?</Text>
          </View>
        </View>
        <Text style={styles.lede}>
          Elige por dónde empezar. No te preocupes: luego podrás hacer de todo
          — unirte a un equipo, crear un club o registrar tu sede.
        </Text>

        <View style={styles.list}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.title}
              onPress={o.onPress}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.iconWrap, { backgroundColor: o.tint + '22', borderColor: o.tint + '55' }]}>
                <Text style={styles.emoji}>{o.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{o.title}</Text>
                <Text style={styles.rowSub}>{o.subtitle}</Text>
              </View>
              <IconChevron size={16} color={Colors.textFaint} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: Colors.accent, fontWeight: '500' },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  lede: { color: Colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 12 },
  list: { marginTop: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
  },
  rowPressed: { opacity: 0.75 },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
});
