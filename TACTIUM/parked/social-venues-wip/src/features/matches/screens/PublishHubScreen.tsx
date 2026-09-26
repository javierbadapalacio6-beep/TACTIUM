import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconChevron } from '@components/ui/Icon';
import { useAuthStore } from '@store/authStore';
import { getMyVenue } from '@core/services/venues';
import type { PublishStackScreenProps } from '@navigation/types';

// Hub de creación (estilo Instagram): al pulsar ➕ eliges qué publicar.
// Las opciones se ADAPTAN al tipo de cuenta: una sede publica novedades/
// torneos/ofertas (no resultados de partido); un jugador publica resultados,
// clips y fotos.
type Nav = PublishStackScreenProps<'PublishHub'>['navigation'];
type Option = {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: (nav: Nav, venueId?: string) => void;
  tint: string;
};

// Opciones para JUGADOR / cuenta general.
const PLAYER_OPTIONS: Option[] = [
  {
    emoji: '🏆',
    title: 'Resultado de partido',
    subtitle: 'Registra tu partido y genera la tarjeta',
    tint: Colors.accent,
    onPress: (nav) => nav.navigate('Registrar'),
  },
  {
    emoji: '🎬',
    title: 'Vídeo o clip',
    subtitle: 'Sube tu mejor punto',
    tint: '#F2C94C',
    onPress: (nav) => nav.navigate('Compose', { kind: 'video' }),
  },
  {
    emoji: '📷',
    title: 'Foto',
    subtitle: 'Comparte una foto de tu partido',
    tint: '#4CC3FF',
    onPress: (nav) => nav.navigate('Compose', { kind: 'photo' }),
  },
  {
    emoji: '✍️',
    title: 'Publicación',
    subtitle: 'Escribe algo para tu feed',
    tint: '#C99AF2',
    onPress: (nav) => nav.navigate('Compose', { kind: 'text' }),
  },
];

// Opciones para SEDE (cuenta de negocio): novedades, torneos, ofertas, fotos.
// Sin "resultado de partido".
const VENUE_OPTIONS: Option[] = [
  {
    emoji: '📣',
    title: 'Novedad',
    subtitle: 'Anuncia algo a tus jugadores',
    tint: Colors.accent,
    onPress: (nav, venueId) => nav.navigate('Compose', { kind: 'text', asVenueId: venueId }),
  },
  {
    emoji: '🏆',
    title: 'Torneo',
    subtitle: 'Publica un torneo de tu club',
    tint: '#F2C94C',
    onPress: (nav, venueId) => nav.navigate('Compose', { kind: 'text', asVenueId: venueId }),
  },
  {
    emoji: '🎟️',
    title: 'Oferta',
    subtitle: 'Promo, bono o descuento',
    tint: '#C99AF2',
    onPress: (nav, venueId) => nav.navigate('Compose', { kind: 'text', asVenueId: venueId }),
  },
  {
    emoji: '📷',
    title: 'Foto',
    subtitle: 'Comparte fotos de tu club',
    tint: '#4CC3FF',
    onPress: (nav, venueId) => nav.navigate('Compose', { kind: 'photo', asVenueId: venueId }),
  },
];

export const PublishHubScreen = ({
  navigation,
}: PublishStackScreenProps<'PublishHub'>) => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  // undefined = cargando · null = no es sede · string = id de la sede
  const [venueId, setVenueId] = useState<string | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMyVenue(userId)
        .then((v) => !cancelled && setVenueId(v?.id ?? null))
        .catch(() => !cancelled && setVenueId(null));
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const isVenue = !!venueId;
  const options = isVenue ? VENUE_OPTIONS : PLAYER_OPTIONS;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <Text style={styles.eyebrow}>CREAR</Text>
        <Text style={styles.title}>¿Qué quieres publicar?</Text>
        {isVenue ? (
          <Text style={styles.hint}>Novedades, torneos y ofertas de tu club.</Text>
        ) : null}

        {venueId === undefined ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <View style={styles.list}>
            {options.map((o) => (
              <Pressable
                key={o.title}
                onPress={() => o.onPress(navigation, venueId ?? undefined)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconWrap, { backgroundColor: o.tint + '22', borderColor: o.tint + '55' }]}>
                  <Text style={styles.emoji}>{o.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{o.title}</Text>
                  <Text style={styles.rowSub}>{o.subtitle}</Text>
                </View>
                <IconChevron size={16} color={Colors.textFaint} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 18 },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: Colors.accent, fontWeight: '500' },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 6 },
  hint: { color: Colors.textMuted, fontSize: 13, marginTop: 6 },
  loading: { marginTop: 40, alignItems: 'center' },
  list: { marginTop: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
  },
  rowPressed: { opacity: 0.75 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
});
