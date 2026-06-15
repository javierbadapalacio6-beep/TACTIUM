import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';
import { useTeamStore } from '@store/teamStore';
import { useClubStore } from '@store/clubStore';
import { toast } from '@store/toastStore';

export const RedeemInvitationSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onRedeemed?: () => void;
}> = ({ open, onClose, onRedeemed }) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loadTeam = useTeamStore((s) => s.loadForUser);
  const loadClubs = useClubStore((s) => s.loadForUser);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);

  const trimmed = code.trim().toUpperCase();
  const valid = trimmed.length === 8;

  const handleRedeem = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await InvitationsApi.redeemInvitation(trimmed);
      // Recargamos datos para que aparezca el equipo recién canjeado.
      // Clubs primero por consistencia con App.tsx (teamStore lee clubs).
      await loadClubs();
      await loadTeam();
      finishOnboarding();
      setCode('');
      onClose();
      // Toast post-redeem: orienta al user recién unido sobre qué hacer.
      // El PlayerClaimGate ya abrirá automáticamente el sheet de reclamar
      // slot si era role=player; este toast cubre el caso de captain
      // invitado y refuerza el siguiente paso para players también.
      toast.success(
        '¡Te has unido al equipo!',
        'Marca tu disponibilidad para la próxima jornada cuando puedas.',
      );
      onRedeemed?.();
    } catch (e: any) {
      Alert.alert('Código inválido', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (!submitting) {
          setCode('');
          onClose();
        }
      }}
    >
      <Text style={styles.eyebrow}>INVITACIÓN</Text>
      <Text style={styles.title}>Introduce tu código</Text>
      <Text style={styles.lede}>
        El gestor de tu club o el capitán te ha enviado un código de 8 caracteres.
      </Text>

      <View style={styles.input}>
        <TextInput
          value={code}
          onChangeText={(t) =>
            setCode(t.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))
          }
          placeholder="XK8R9P3M"
          placeholderTextColor={Colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          style={styles.inputField}
          maxLength={8}
        />
        <Text style={styles.inputCounter}>{trimmed.length}/8</Text>
      </View>

      <Pressable
        disabled={!valid || submitting}
        onPress={handleRedeem}
        style={({ pressed }) => [
          styles.cta,
          (!valid || submitting) && { opacity: 0.4 },
          pressed && valid && !submitting && { opacity: 0.85 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#001810" />
        ) : (
          <Text style={styles.ctaLabel}>Unirme al equipo</Text>
        )}
      </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 4,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  inputField: {
    flex: 1,
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    paddingVertical: 0,
    textTransform: 'uppercase',
  },
  inputCounter: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 1,
  },
  cta: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#001810',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
