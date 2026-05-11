import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, NeonDot } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TactiumMark size={28} gradient />
          <Text style={styles.brand}>TACTIUM</Text>
        </View>
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
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>BIENVENIDO</Text>
        <Text style={styles.title}>¿Cómo vas a empezar?</Text>
        <Text style={styles.lede}>
          Puedes gestionar un único equipo o estructurar varios bajo un club.
        </Text>

        <View style={styles.options}>
          <ChoiceCard
            title="Equipo independiente"
            description="Un solo equipo. Empieza rápido sin estructura adicional."
            badge="RÁPIDO"
            badgeAccent
            onPress={() => navigation.navigate('CreateTeam', {})}
          />

          <ChoiceCard
            title="Club con varios equipos"
            description="Para clubes con múltiples equipos y capitanes."
            badge="ESCALABLE"
            onPress={() => navigation.navigate('CreateClub')}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>O</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={() => setRedeemOpen(true)}
          style={({ pressed }) => [
            styles.redeem,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.redeemTitle}>Tengo un código de invitación</Text>
          <Text style={styles.redeemHint}>
            Únete al equipo que te ha invitado un capitán o gestor.
          </Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 22 }]}>
        <Text style={styles.footnote}>
          Podrás cambiar entre equipos más adelante.
        </Text>
      </View>

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
  onPress: () => void;
}> = ({ title, description, badge, badgeAccent, onPress }) => (
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
    paddingTop: 36,
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
    marginBottom: 28,
  },
  options: {
    gap: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 22,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  redeemTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  redeemHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  cardDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  cardCta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCtaText: {
    color: Colors.accent,
    fontSize: 13,
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
