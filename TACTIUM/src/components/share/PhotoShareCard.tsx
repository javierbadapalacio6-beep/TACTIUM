import React from 'react';
import { View, Text, Image, StyleSheet, Share, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';

// Tarjeta "estilo Strava" (F7): la foto del partido con el resultado y la
// marca TACTIUM superpuestos. Se comparte como imagen compuesta cuando el
// binario incluye view-shot; si no, degradamos a foto + texto por el share
// nativo (WhatsApp la muestra como imagen con caption).

interface Props {
  photoUri: string;
  /** Línea grande sobre la foto (p. ej. "CD Tactium 2 – 1 Pádel Río"). */
  title: string;
  /** Línea secundaria (p. ej. "Amistoso · 7 jul 2026"). */
  subtitle?: string;
  /** Línea de detalle (p. ej. "6-4 6-3 · P1"). */
  detail?: string;
}

export const PhotoShareCard = React.forwardRef<View, Props>(
  ({ photoUri, title, subtitle, detail }, ref) => (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      {/* Velo inferior para legibilidad del resultado sobre la foto */}
      <LinearGradient
        colors={['transparent', 'rgba(4,10,8,0.55)', 'rgba(4,10,8,0.92)']}
        style={styles.veil}
      />
      <View style={styles.overlay}>
        <View style={styles.brandRow}>
          <TactiumMark size={22} gradient />
          <Text style={styles.brandName}>TACTIUM</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        <Text style={styles.url}>tactium.io</Text>
      </View>
    </View>
  ),
);
PhotoShareCard.displayName = 'PhotoShareCard';

/**
 * Comparte la tarjeta como imagen COMPUESTA (foto + resultado). Si la
 * captura no está disponible en este binario, comparte la foto original
 * con el texto como caption (fallback transparente para el usuario).
 */
export async function sharePhotoCard(
  ref: React.RefObject<View | null>,
  photoUri: string,
  text: string,
): Promise<void> {
  let uri = photoUri;
  try {
    uri = await captureRef(ref, { format: 'jpg', quality: 0.92 });
  } catch {
    // view-shot no disponible en este binario → foto original + texto.
  }
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? ({ url: uri, message: text } as never)
        : ({ message: text, url: uri } as never),
    );
  } catch {
    // cancelado por el usuario
  }
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 380,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  detail: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 1,
  },
  url: {
    fontFamily: Fonts.mono,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 10,
  },
});
