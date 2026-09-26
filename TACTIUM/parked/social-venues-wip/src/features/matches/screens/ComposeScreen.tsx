import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBack } from '@components/ui/Icon';
import { createPost } from '@core/services/posts';
import type { PublishStackScreenProps } from '@navigation/types';

const CONFIG = {
  video: { emoji: '🎬', title: 'Vídeo o clip', hint: 'Sube tu mejor punto (máx. 30s).' },
  photo: { emoji: '📷', title: 'Foto', hint: 'Comparte una foto de tu partido.' },
  text: { emoji: '✍️', title: 'Publicación', hint: 'Escribe algo para tu feed.' },
} as const;

export const ComposeScreen = ({
  navigation,
  route,
}: PublishStackScreenProps<'Compose'>) => {
  const insets = useSafeAreaInsets();
  const kind = route.params.kind;
  const asVenueId = route.params.asVenueId;
  const cfg = CONFIG[kind];
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const publish = async () => {
    if (kind !== 'text') {
      Alert.alert('Próximamente', 'La subida de media se activa con el próximo build nativo.');
      return;
    }
    if (text.trim() === '') {
      Alert.alert('Escribe algo', 'La publicación no puede estar vacía.');
      return;
    }
    try {
      setSaving(true);
      await createPost({
        kind: 'text',
        body: text.trim(),
        visibility: 'public',
        venueId: asVenueId,
      });
      Alert.alert(
        '¡Publicado!',
        asVenueId
          ? 'La publicación está en el feed a nombre de tu club.'
          : 'Tu publicación está en el feed.',
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo publicar', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <IconBack size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{cfg.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {kind === 'text' ? (
          <TextInput
            style={styles.composer}
            value={text}
            onChangeText={setText}
            placeholder="¿Qué quieres contar?"
            placeholderTextColor={Colors.textFaint}
            multiline
            autoFocus
          />
        ) : (
          <Pressable style={styles.dropzone} onPress={publish}>
            <Text style={styles.dropEmoji}>{cfg.emoji}</Text>
            <Text style={styles.dropTxt}>Toca para elegir {kind === 'video' ? 'un vídeo' : 'una foto'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>PRÓXIMAMENTE</Text>
            </View>
          </Pressable>
        )}
        <Text style={styles.hint}>{cfg.hint}</Text>

        <Pressable
          style={[styles.publishBtn, saving && { opacity: 0.6 }]}
          onPress={publish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <Text style={styles.publishTxt}>Publicar</Text>
          )}
        </Pressable>
        <Text style={styles.note}>
          {kind === 'text'
            ? 'La publicación al feed se activará muy pronto.'
            : 'La subida necesita el próximo build nativo.'}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  composer: {
    minHeight: 160,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  dropzone: {
    height: 220,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.hairStrong,
    borderStyle: 'dashed',
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dropEmoji: { fontSize: 40 },
  dropTxt: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,223,130,0.14)',
    borderWidth: 1,
    borderColor: Colors.accent + '55',
  },
  badgeTxt: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.accent, fontWeight: '600' },
  hint: { color: Colors.textFaint, fontSize: 13, marginTop: 14 },
  publishBtn: {
    marginTop: 22,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishTxt: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
  note: { color: Colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
