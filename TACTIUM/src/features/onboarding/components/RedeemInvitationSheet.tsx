import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from '@components/ui';
import { useTeamStore } from '@store/teamStore';

import { JoinTeamPreview } from './JoinTeamPreview';

export const RedeemInvitationSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onRedeemed?: () => void;
}> = ({ open, onClose, onRedeemed }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [code, setCode] = useState('');
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);

  const trimmed = code.trim().toUpperCase();
  const complete = trimmed.length === 8;

  const close = () => {
    setCode('');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close}>
      <Text style={styles.eyebrow}>INVITACIÓN DE EQUIPO</Text>
      <Text style={styles.title}>Únete a tu equipo</Text>
      <Text style={styles.lede}>
        Mete el código de 8 caracteres que te ha enviado tu capitán o tu club.
        Antes de unirte verás a qué equipo entras.
      </Text>

      <View style={styles.input}>
        <TextInput
          value={code}
          onChangeText={(t) =>
            setCode(t.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))
          }
          placeholder="XK8R9P3M"
          placeholderTextColor={c.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          style={styles.inputField}
          maxLength={8}
        />
        <Text style={styles.inputCounter}>{trimmed.length}/8</Text>
      </View>

      {complete ? (
        <View style={{ marginTop: 14 }}>
          {/* key = código: al cambiarlo se vuelve a pedir la vista previa. */}
          <JoinTeamPreview
            key={trimmed}
            code={trimmed}
            onJoined={() => {
              close();
              onRedeemed?.();
            }}
            onGoToTeam={(teamId) => {
              void setActiveTeam(teamId).catch(() => {});
              finishOnboarding();
              close();
            }}
          />
        </View>
      ) : (
        <View style={[styles.cta, { opacity: 0.4 }]}>
          <Text style={styles.ctaLabel}>Unirme al equipo</Text>
        </View>
      )}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 4,
  },
  lede: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  inputField: {
    flex: 1,
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    paddingVertical: 0,
    textTransform: 'uppercase',
  },
  inputCounter: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
  },
  cta: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: c.accent,
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
