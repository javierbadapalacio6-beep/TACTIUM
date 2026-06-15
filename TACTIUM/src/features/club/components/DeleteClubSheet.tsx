import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';

interface DeleteClubSheetProps {
  visible: boolean;
  clubName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación fuerte para borrar un club. Borrado IRREVERSIBLE en cascada
 * (equipos, temporadas, jornadas, alineaciones, actas, accesos de capitanes y
 * jugadores). Para evitar accidentes, el botón solo se activa cuando el user
 * escribe EXACTO el nombre del club.
 */
export const DeleteClubSheet = ({
  visible,
  clubName,
  loading,
  onConfirm,
  onCancel,
}: DeleteClubSheetProps) => {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const matches = text.trim() === clubName.trim() && clubName.trim().length > 0;

  const handleCancel = () => {
    if (loading) return;
    setText('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            <Text style={styles.eyebrow}>ZONA DE PELIGRO</Text>
            <Text style={styles.title}>Borrar club</Text>
            <Text style={styles.body}>
              Esto eliminará <Text style={styles.bodyStrong}>{clubName}</Text> y
              TODO su contenido de forma permanente: equipos, temporadas,
              jornadas, alineaciones, actas y los accesos de sus capitanes y
              jugadores. No se puede deshacer.
            </Text>

            <Text style={styles.inputLabel}>
              Escribe <Text style={styles.bodyStrong}>{clubName}</Text> para
              confirmar
            </Text>
            <TextInput
              value={text}
              onChangeText={setText}
              editable={!loading}
              placeholder={clubName}
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Pressable
              disabled={!matches || loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.deleteBtn,
                (!matches || loading) && { opacity: 0.4 },
                pressed && matches && !loading && { opacity: 0.85 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.deleteBtnLabel}>Borrar club para siempre</Text>
              )}
            </Pressable>

            {!loading ? (
              <Pressable onPress={handleCancel} hitSlop={6}>
                <Text style={styles.cancelLink}>Cancelar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgRaised,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.hairStrong,
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.error,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  body: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  bodyStrong: {
    color: Colors.text,
    fontWeight: '700',
  },
  inputLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 14,
    color: Colors.text,
    fontSize: 15,
  },
  deleteBtn: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  deleteBtnLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLink: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 14,
  },
});
