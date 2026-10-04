import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { clubCoverage } from '@core/entitlements/coverage';
import { updateClub } from '@core/services/clubs';
import { FEDERATIONS } from '@core/data/federations';
import { toast } from '@store/toastStore';
import { DeleteClubSheet } from '../components/DeleteClubSheet';
import { tapSuccess } from '../clubOps';

import type { RootStackScreenProps } from '@navigation/types';

/**
 * Ajustes del club. Aquí vive «Borrar club», que antes era lo último que se
 * veía en la portada del panel: es irreversible y no pinta nada en Inicio.
 */
export const ClubSettingsScreen = ({ navigation }: RootStackScreenProps<'ClubSettings'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const reloadClubs = useClubStore((s) => s.loadForUser);
  const deleteClub = useClubStore((s) => s.deleteClub);
  const reloadTeams = useTeamStore((s) => s.loadForUser);
  const teams = useTeamStore((s) => s.teams);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const coverage = clubCoverage(club?.id ?? null, teams, subscriptions);

  const [name, setName] = useState(club?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(club?.name ?? '');
  }, [club?.name]);

  const fed = FEDERATIONS.find((f) => f.code === club?.federation) ?? null;
  const dirty = !!club && name.trim() !== club.name && name.trim().length >= 2;

  const save = async () => {
    if (!club || !dirty || saving) return;
    setSaving(true);
    try {
      await updateClub(club.id, { name: name.trim() });
      await reloadClubs();
      tapSuccess();
      toast.success('Club guardado');
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!club || deleting) return;
    setDeleting(true);
    try {
      await deleteClub(club.id);
      await reloadTeams();
      setDeleteOpen(false);
      toast.success('Club borrado', 'Se ha eliminado el club y su contenido.');
      navigation.goBack();
    } catch (e: any) {
      toast.error('No se pudo borrar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Inicio</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>{club?.name?.toUpperCase() ?? 'CLUB'}</Text>
        <Text style={styles.title}>Ajustes del club</Text>

        <Text style={styles.label}>NOMBRE DEL CLUB</Text>
        <View style={styles.input}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Club Halcones"
            placeholderTextColor={c.textFaint}
            style={styles.inputField}
            maxLength={60}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
          />
        </View>

        <Text style={styles.label}>FEDERACIÓN</Text>
        <View style={styles.readonly}>
          <Text style={styles.readonlyText}>{fed?.name ?? 'Sin federación'}</Text>
        </View>
        <Text style={styles.hint}>
          El escudo y la federación se cambian desde la web, en tactium.io › Club › Editar club.
        </Text>

        <Pressable
          onPress={save}
          disabled={!dirty || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            (!dirty || saving) && { opacity: 0.45 },
            pressed && dirty && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Guardar</Text>
          )}
        </Pressable>

        {/* ZONA DE PELIGRO · borrar club (cascada irreversible) */}
        <View style={styles.danger}>
          <Text style={styles.dangerEyebrow}>ZONA DE PELIGRO</Text>
          <Text style={styles.dangerText}>
            Borrar el club elimina sus equipos, temporadas, jornadas, actas y torneos.
            No se puede deshacer.
          </Text>
          <Pressable
            onPress={() =>
              coverage.hasActiveSub
                ? Alert.alert(
                    'Cancela primero la suscripción',
                    'No se puede borrar un club con una suscripción activa. Cancélala en la tienda (App Store / Google Play) y, cuando caduque, podrás borrar el club.',
                  )
                : setDeleteOpen(true)
            }
            accessibilityRole="button"
            accessibilityLabel="Borrar club"
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.deleteLabel}>Borrar club</Text>
          </Pressable>
        </View>
      </ScrollView>

      <DeleteClubSheet
        visible={deleteOpen}
        clubName={club?.name ?? ''}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 6 },
    label: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      letterSpacing: 2,
      marginTop: 22,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputField: { color: c.text, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
    readonly: {
      backgroundColor: c.bgCard2,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    readonlyText: { color: c.textMuted, fontSize: 15 },
    hint: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginTop: 8 },
    saveBtn: {
      marginTop: 20,
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    danger: {
      marginTop: 40,
      padding: 16,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.error + '44',
      backgroundColor: c.error + '0D',
    },
    dangerEyebrow: {
      fontFamily: Fonts.mono,
      color: c.error,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    dangerText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
    deleteBtn: {
      marginTop: 14,
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.error + '66',
      backgroundColor: c.error + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLabel: { color: c.error, fontSize: 15, fontWeight: '700' },
  });
