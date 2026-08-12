import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, IconBack, IconTrophy, NeonDot } from '@components/ui';
import { useClubStore } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';

import type { OnboardingStackScreenProps } from '@navigation/types';

// Paso mínimo del modo "Organizar torneos": solo el nombre. Los torneos cuelgan
// de un club, así que creamos uno marcado `tournaments_only=true`. Tras crearlo
// re-derivamos el rol (club_admin sin equipo) → el RootNavigator muestra el
// menú recortado (Torneos + Perfil). No hace falta federación ni equipos.
export const CreateTournamentClubScreen = ({
  navigation,
}: OnboardingStackScreenProps<'CreateTournamentClub'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const createClub = useClubStore((s) => s.createClub);
  const loadTeam = useTeamStore((s) => s.loadForUser);

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const valid = useMemo(() => Boolean(name.trim()), [name]);

  const handleCreate = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await createClub({ name: name.trim(), tournamentsOnly: true });
      // Re-deriva el rol: al no haber equipos pero sí un club "solo torneos",
      // el teamStore fija activeRole='club_admin' y sale del onboarding →
      // el RootNavigator conmuta a las tabs (recortadas). No navegamos a mano.
      await loadTeam();
    } catch (e: any) {
      Alert.alert(
        'No se pudo crear',
        e?.message ?? 'Inténtalo de nuevo.',
      );
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop intensity={0.6} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <IconBack size={18} color={c.text} />
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.bar, styles.barActive]} />
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>ORGANIZAR TORNEOS</Text>
        <Text style={styles.title}>Ponle nombre</Text>
        <Text style={styles.lede}>
          Es el nombre con el que aparecerán tus torneos. Nada más:
          entras directo a crear el primero.
        </Text>

        <View style={{ marginTop: 20 }}>
          <Text style={styles.sectionLabel}>Nombre del organizador / club</Text>
          <View style={{ height: 8 }} />
          <View style={styles.nameInput}>
            <View style={styles.accentBar} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Padel Club"
              placeholderTextColor={c.textFaint}
              maxLength={60}
              autoCapitalize="words"
              style={styles.nameInputField}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>
        </View>

        <View style={styles.preview}>
          <View style={styles.previewRow}>
            <View style={styles.previewIcon}>
              <IconTrophy size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name || 'Sin nombre'}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                Modo torneos · sin equipos
              </Text>
            </View>
            <NeonDot size={7} />
          </View>
          <View style={styles.previewFooter}>
            <Text style={styles.previewFooterText}>
              Después podrás activar la gestión de equipos cuando quieras.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          disabled={!valid || submitting}
          onPress={handleCreate}
          style={({ pressed }) => [
            styles.ctaBtn,
            (!valid || submitting) && { opacity: 0.4 },
            pressed && valid && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#001810" />
          ) : (
            <Text style={styles.ctaLabel}>Crear y entrar</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progress: { flexDirection: 'row', gap: 6 },
    bar: {
      width: 18,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.hairStrong,
    },
    barActive: {
      width: 28,
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOpacity: 0.7,
      shadowRadius: 6,
    },
    scroll: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
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
      fontSize: 28,
      fontWeight: '600',
      letterSpacing: -0.7,
      lineHeight: 30,
      marginBottom: 6,
    },
    lede: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    nameInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    accentBar: {
      width: 5,
      height: 22,
      borderRadius: 3,
      backgroundColor: c.accent,
    },
    nameInputField: {
      flex: 1,
      color: c.text,
      fontSize: 17,
      fontWeight: '600',
      paddingVertical: 0,
    },
    preview: {
      marginTop: 22,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 14,
    },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewName: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    previewMeta: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    previewFooter: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    previewFooterText: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      color: c.textFaint,
      letterSpacing: 0.5,
    },
    cta: { paddingHorizontal: 20, paddingTop: 8 },
    ctaBtn: {
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
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
  });
