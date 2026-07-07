import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconTeam } from '@components/ui/Icon';
import { useTeamStore } from '@store/teamStore';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';

// Estado del tab "Equipo" cuando el usuario NO está en ningún equipo (acceso
// abierto). No fuerza nada: puede seguir jugando/publicando; aquí decide si
// unirse a su equipo con un código o crear uno (capitán/club).
export const NoTeamScreen = () => {
  const insets = useSafeAreaInsets();
  const startOnboarding = useTeamStore((s) => s.startOnboarding);
  const [redeemOpen, setRedeemOpen] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.iconWrap}>
          <IconTeam size={34} color={Colors.accent} />
        </View>
        <Text style={styles.title}>Aún no estás en un equipo</Text>
        <Text style={styles.subtitle}>
          Puedes jugar, registrar partidos y publicar igual. Si compites por
          equipos, únete al tuyo con un código, o crea un equipo o club.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={startOnboarding}>
          <Text style={styles.primaryTxt}>Crear equipo o club</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => setRedeemOpen(true)}>
          <Text style={styles.secondaryTxt}>Tengo un código de invitación</Text>
        </Pressable>

        <Text style={styles.note}>
          Recuerda: solo puedes competir en un equipo, pero puedes jugar en los
          clubes que quieras.
        </Text>
      </ScrollView>

      <RedeemInvitationSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 28, alignItems: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.accent + '18',
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTxt: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryTxt: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  note: { color: Colors.textFaint, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 24 },
});
