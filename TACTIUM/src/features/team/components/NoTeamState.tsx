import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconChevron } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import type { RootStackParamList } from '@navigation/types';
import { StaggerRow } from './TeamMotion';

/** Acepta el código suelto o el enlace entero (tactium.io/i/XK8R9P3M). */
function normalizeCode(raw: string): string {
  const m = raw.match(/\/i\/([A-Za-z0-9]+)/);
  const base = m ? m[1] : raw;
  return base.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
}

/**
 * Jugador SUELTO (sin equipo). Rediseño 2026-10:
 *  · El código va en la propia pantalla y lleva a la vista previa del equipo
 *    («¿Eres tú?», `preview_team_invitation`), sin abrir otra hoja.
 *  · «Crear mi equipo» dice qué eres y lo que cuesta antes de sacarte del modo
 *    suelto (antes te sacaba sin avisar).
 *  · La última línea deja claro que sin equipo también se juega.
 * Se usa en la pestaña Equipo y en el segmento Liga de Competir.
 */
export const NoTeamState: React.FC<{ text?: string }> = ({ text }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const setSoloMode = useTeamStore((st) => st.setSoloMode);
  const setSoloUpgrade = useTeamStore((st) => st.setSoloUpgrade);
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [code, setCode] = useState('');
  const clean = normalizeCode(code);
  const valid = clean.length >= 6;

  const createTeam = () => {
    Alert.alert(
      'Crear mi equipo',
      'Serás el capitán. Tienes 14 días con todo, sin tarjeta; luego eliges plan o sigues gratis. Tus amistosos y torneos no se pierden.',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Crear equipo',
          onPress: () => {
            setSoloUpgrade(true);
            setSoloMode(false);
          },
        },
      ],
    );
  };

  return (
    <View style={s.wrap}>
      <StaggerRow index={0}>
        <Text style={s.title}>Todavía no estás en un equipo</Text>
        {text ? <Text style={s.lede}>{text}</Text> : null}
      </StaggerRow>

      <StaggerRow index={1} style={s.card}>
        <Text style={s.cardTitle}>Me han pasado un enlace o un código</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="XK8R9P3M"
          placeholderTextColor={c.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => valid && rootNav.navigate('JoinTeam', { code: clean })}
          accessibilityLabel="Código o enlace del equipo"
          style={s.input}
        />
        <Pressable
          disabled={!valid}
          onPress={() => rootNav.navigate('JoinTeam', { code: clean })}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.primary,
            !valid && { opacity: 0.4 },
            pressed && valid && { opacity: 0.85 },
          ]}
        >
          <Text style={s.primaryText}>Ver el equipo</Text>
        </Pressable>
      </StaggerRow>

      <StaggerRow index={2}>
        <Pressable
          onPress={createTeam}
          accessibilityRole="button"
          style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowTitle}>Crear mi equipo</Text>
            <Text style={s.rowSub}>Capitán · 14 días gratis, sin tarjeta</Text>
          </View>
          <IconChevron size={14} color={c.textFaint} />
        </Pressable>
      </StaggerRow>

      <StaggerRow index={3}>
        <Text style={s.foot}>
          Mientras tanto, tus amistosos y torneos siguen en Inicio y en Competir.
        </Text>
      </StaggerRow>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 20, paddingTop: 18, gap: 14 },
    title: {
      color: c.text,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.5,
      lineHeight: 29,
    },
    lede: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    card: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 10,
    },
    cardTitle: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    input: {
      height: 52,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      color: c.text,
      fontFamily: Fonts.mono,
      fontSize: 20,
      letterSpacing: 3,
      textAlign: 'center',
    },
    primary: {
      height: 48,
      borderRadius: 13,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    rowTitle: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    rowSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    foot: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  });
