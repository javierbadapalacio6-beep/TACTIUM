import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, darkColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { BottomSheet, IconCamera } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import { initialsOf, displayNameOf } from '@core/utils/format';
import * as ProfileApi from '@core/services/profile';
import * as AvatarApi from '@core/services/avatar';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Editor del perfil (escaparate Instagram). Reúne en un solo sheet las tres
 * ediciones del perfil público: foto, nombre de usuario y descripción.
 *  · La foto se guarda al instante (sube/borra al elegir).
 *  · Nombre de usuario + descripción se guardan juntos con "Guardar".
 */
export const EditProfileSheet: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const user = useAuthStore((s) => s.user);
  const displayName = displayNameOf(user);
  const initials = initialsOf(displayName);

  const currentUsername = (
    (user?.user_metadata?.username as string | undefined) ?? ''
  ).trim();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [username, setUsername] = useState(currentUsername);
  const [bio, setBio] = useState('');
  const [savedBio, setSavedBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Hidratación al abrir: avatar + bio desde profiles; username desde la
  // sesión (user_metadata, síncrono).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setUsername(currentUsername);
    (async () => {
      try {
        const p = await ProfileApi.fetchMyProfile();
        if (cancelled) return;
        setAvatarUrl(p?.avatar_url ?? null);
        const b = (
          (p as { bio?: string | null } | null)?.bio ?? ''
        ).toString();
        setBio(b);
        setSavedBio(b);
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── Avatar · pick / upload / remove ───────────────────────────────────
  const handlePickedImage = async (uri: string) => {
    setAvatarBusy(true);
    try {
      const url = await AvatarApi.uploadMyAvatar(uri);
      setAvatarUrl(url);
      toast.success('Foto actualizada');
      onSaved?.();
    } catch (e: any) {
      Alert.alert('No se pudo subir', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a la cámara para hacer una foto.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await handlePickedImage(result.assets[0].uri);
  };

  const handlePickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tus fotos para elegir una.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await handlePickedImage(result.assets[0].uri);
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      await AvatarApi.deleteMyAvatar();
      setAvatarUrl(null);
      toast.success('Foto eliminada');
      onSaved?.();
    } catch (e: any) {
      Alert.alert('No se pudo eliminar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const openAvatarPicker = () => {
    if (avatarBusy) return;
    const buttons: any[] = [
      { text: 'Hacer foto', onPress: handleTakePhoto },
      { text: 'Elegir de galería', onPress: handlePickFromLibrary },
    ];
    if (avatarUrl) {
      buttons.push({
        text: 'Quitar foto',
        style: 'destructive',
        onPress: handleRemoveAvatar,
      });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Foto de perfil', undefined, buttons);
  };

  // ─── Guardar (nombre de usuario + descripción juntos) ──────────────────
  const handleSave = async () => {
    if (saving) return;
    const nextUsername = username.trim();
    const nextBio = bio.trim();
    const usernameDirty = nextUsername !== currentUsername;
    const bioDirty = nextBio !== savedBio;
    if (!usernameDirty && !bioDirty) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      if (usernameDirty) {
        // setMyUsername lanza un error amable si el nombre ya existe.
        await ProfileApi.setMyUsername(nextUsername);
      }
      if (bioDirty) {
        await ProfileApi.setMyBio(nextBio);
        setSavedBio(nextBio);
      }
      toast.success('Perfil actualizado');
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          accessibilityRole="button"
          accessibilityLabel="Guardar perfil"
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || loading) && { opacity: 0.5 },
            pressed && !saving && !loading && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveBtnLabel}>Guardar</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.eyebrow}>EDITAR PERFIL</Text>

      {/* Avatar */}
      <View style={styles.avatarBlock}>
        <Pressable
          onPress={openAvatarPicker}
          disabled={avatarBusy}
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
          style={({ pressed }) => [
            styles.avatarPressable,
            pressed && !avatarBusy && { opacity: 0.85 },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <LinearGradient
              colors={[darkColors.primary, darkColors.bgCard2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { color: darkColors.accent }]}>
                {initials}
              </Text>
            </LinearGradient>
          )}
          <View style={styles.avatarEditBadge}>
            {avatarBusy ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <IconCamera size={13} color={c.text} />
            )}
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Toca para cambiar la foto</Text>
      </View>

      {/* Nombre de usuario */}
      <View>
        <Text style={styles.fieldLabel}>NOMBRE DE USUARIO</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Cómo apareces (ej. Javi)"
            placeholderTextColor={c.textFaint}
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Nombre de usuario"
          />
        </View>
        <Text style={styles.fieldHint}>
          Tu nombre corto para amistosos, la foto del partido y la comunidad.
          Es único. Si lo dejas vacío, usamos tu nombre completo.
        </Text>
      </View>

      {/* Descripción */}
      <View>
        <Text style={styles.fieldLabel}>DESCRIPCIÓN</Text>
        <View style={styles.bioCard}>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Cuéntate en una línea (nivel, club, mano dominante…)"
            placeholderTextColor={c.textFaint}
            maxLength={160}
            multiline
            accessibilityLabel="Descripción del perfil"
          />
          <Text style={styles.bioCount}>{bio.length}/160</Text>
        </View>
        <Text style={styles.fieldHint}>
          Aparece en tu perfil público de la comunidad.
        </Text>
      </View>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
  avatarBlock: { alignItems: 'center', marginTop: 4 },
  avatarPressable: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.accent40,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: c.accent40,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.bgRaised,
    borderWidth: 2,
    borderColor: c.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: c.accent,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  avatarHint: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: c.textFaint,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputCard: {
    backgroundColor: c.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hair,
    paddingHorizontal: 14,
  },
  textInput: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 14,
  },
  fieldHint: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  bioCard: {
    backgroundColor: c.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hair,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  bioInput: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 48,
    maxHeight: 120,
    textAlignVertical: 'top',
    paddingVertical: 2,
  },
  bioCount: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnLabel: {
    color: c.textInverse,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
